import type { PoolConfig } from 'pg';
import { configurePostgresNetworking, postgresPoolConfig } from '../src/core/postgres.js';

export const configureMigrationNetworking = configurePostgresNetworking;
export function migrationPoolConfig(connectionString: string | undefined): PoolConfig {
  return { ...postgresPoolConfig(connectionString), max: 1 };
}
