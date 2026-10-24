import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running migrations');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
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
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
