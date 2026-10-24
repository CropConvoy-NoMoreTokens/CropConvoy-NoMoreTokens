import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import type { PoolConfig } from 'pg';

/** Give cross-region TCP connections time to establish while retaining address failover. */
export function configurePostgresNetworking(): void {
  setDefaultAutoSelectFamilyAttemptTimeout(Math.max(2000, getDefaultAutoSelectFamilyAttemptTimeout()));
}

export function postgresPoolConfig(connectionString: string | undefined): PoolConfig {
  if (!connectionString) throw new Error('Set DATABASE_URL before connecting to PostgreSQL');
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  // Preserve pg's current verification behavior explicitly across future pg upgrades.
  if (url.searchParams.get('sslmode') === 'require' && url.searchParams.get('uselibpqcompat') !== 'true')
    url.searchParams.set('sslmode', 'verify-full');
  return { connectionString: url.toString(), connectionTimeoutMillis: 20_000 };
}
