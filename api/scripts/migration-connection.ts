import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import type { PoolConfig } from 'pg';

/** Keep IPv4/IPv6 failover, allowing time for cross-region TCP handshakes. */
export function configureMigrationNetworking(): void {
  setDefaultAutoSelectFamilyAttemptTimeout(Math.max(2000, getDefaultAutoSelectFamilyAttemptTimeout()));
}

export function migrationPoolConfig(connectionString: string | undefined): PoolConfig {
  if (!connectionString) throw new Error('Set DATABASE_URL before running migrations');
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');

  // pg currently treats require as verify-full. Make that behavior explicit,
  // preserving certificate/hostname validation when pg changes its defaults.
  if (url.searchParams.get('sslmode') === 'require' && url.searchParams.get('uselibpqcompat') !== 'true')
    url.searchParams.set('sslmode', 'verify-full');

  return { connectionString: url.toString(), connectionTimeoutMillis: 20_000, max: 1 };
}
