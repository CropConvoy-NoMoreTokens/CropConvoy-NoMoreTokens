import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { configureMigrationNetworking, migrationPoolConfig } from './migration-connection.js';
configureMigrationNetworking();
const pool = new Pool(migrationPoolConfig(process.env.DATABASE_URL));
let client: PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(26102401)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const name = '001_initial.sql';
  const exists = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
  if (!exists.rowCount) {
    await client.query(await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
    console.log(`Applied ${name}`);
  } else console.log('Initial migration already applied');
  await client.query('COMMIT');
} catch (error) {
  // Preserve the original error if rollback also fails after a disconnect.
  try { await client?.query('ROLLBACK'); } catch { /* Connection already lost. */ }
  const code = (error as { code?: string }).code;
  // Do not log the connection URL, client object, or raw provider error details.
  console.error(JSON.stringify({ event: 'migration_failed', code: code ?? 'UNKNOWN',
    message: code === 'ETIMEDOUT' ? 'Database connection timed out. Check network access to PostgreSQL port 5432.' :
      'Database migration failed. Check connectivity, credentials and migration state.' }));
  process.exitCode = 1;
}
finally { client?.release(); await pool.end(); }
