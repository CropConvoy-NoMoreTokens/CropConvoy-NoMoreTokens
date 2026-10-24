import { Pool, type QueryResultRow } from 'pg';
import type { ApiMode, Point, LineString } from './contracts.js';
import { pending } from './errors.js';

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
export interface LlmClient {
  // P2 implements provider-specific tool calling; each owner validates returned values.
  complete(input: { role: 'market' | 'logistics' | 'advocate'; system: string; input: unknown;
    tools: Array<{ name: string; description: string; parameters: unknown }>;
    signal: AbortSignal }): Promise<unknown>;
}
export interface RoutingClient {
  route(points: Point[], signal: AbortSignal): Promise<{
    geometry: LineString; distanceM: number; durationS: number;
    legs: Array<{ distanceM: number; durationS: number }>;
    snappedPoints: Point[]; provider: string; profile: string;
  }>;
}
export interface Dependencies {
  db: Database; llm: LlmClient; routing: RoutingClient;
  clock: { now(): Date }; mode: ApiMode; persistence: 'memory' | 'postgres'; maxPlanMs: number;
}
export function createDependencies(input: { databaseUrl?: string; stub: boolean; maxPlanMs: number }): Dependencies {
  const pool = input.databaseUrl ? new Pool({ connectionString: input.databaseUrl, connectionTimeoutMillis: 5000 }) : null;
  return {
    db: {
      async query(sql, values) { if (!pool) return pending('Database connection'); return pool.query(sql, values); },
      async ping() { if (!pool) return pending('Database connection'); await pool.query('SELECT 1'); },
      async close() { await pool?.end(); },
    },
    llm: { async complete() { return pending('LLM adapter (P2)'); } },
    routing: { async route() { return pending('Road-routing adapter (P3)'); } },
    clock: { now: () => new Date() }, mode: input.stub ? 'stub' : 'live',
    // PostgreSQL repositories are not implemented in this starter, even if DATABASE_URL exists.
    persistence: 'memory', maxPlanMs: input.maxPlanMs,
  };
}
