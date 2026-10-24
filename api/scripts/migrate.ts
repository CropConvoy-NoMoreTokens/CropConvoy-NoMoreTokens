import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { configureMigrationNetworking, migrationPoolConfig } from './migration-connection.js';
import { demoUsers, hashPassword } from '../src/core/auth.js';
configureMigrationNetworking();
const pool = new Pool(migrationPoolConfig(process.env.DATABASE_URL));
let client: PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(26102401)");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../db/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
    const exists = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
    if (exists.rowCount) { console.log('Already applied '+name); continue; }
    await client.query(await readFile(new URL(name, directory), 'utf8'));
    if (name === '002_demo_auth.sql') {
      for (const user of demoUsers) {
        await client.query(
          `INSERT INTO demo_users (id, username, role, password_hash) VALUES ($1,$2,$3,$4)
           ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username, user.role, await hashPassword(user.password)]);
      }
    }
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
    console.log(`Applied ${name}`);
  }
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
