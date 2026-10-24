import { Pool, type QueryResultRow } from 'pg';
import type { ApiMode, Point, LineString } from './contracts.js';
import { pending } from './errors.js';
import { createGeminiClient } from './llm.js';

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
export function createDependencies(input: { databaseUrl?: string; stub: boolean; maxPlanMs: number;
  llmApiKey?: string; llmModel?: string; llmBaseUrl?: string }): Dependencies {
  const pool = input.databaseUrl ? new Pool({ connectionString: input.databaseUrl, connectionTimeoutMillis: 5000 }) : null;
  return {
    db: {
      async query(sql, values) { if (!pool) return pending('Database connection'); return pool.query(sql, values); },
      async ping() {
        if (!pool) return pending('Database connection');
        const { rows } = await pool.query<{ listings: string | null; orders: string | null; trips: string | null; plans: string | null }>(
          `SELECT to_regclass('public.listings') AS listings, to_regclass('public.orders') AS orders,
            to_regclass('public.trips') AS trips, to_regclass('public.plans') AS plans`);
        if (!rows[0] || Object.values(rows[0]).some(value => value === null))
          throw new Error('Initial database migration has not been applied');
      },
      async close() { await pool?.end(); },
    },
    llm: input.llmApiKey && input.llmModel
      ? createGeminiClient(input.llmApiKey, input.llmModel, input.llmBaseUrl)
      : { async complete() { return pending('LLM configuration'); } },
    routing: { async route() { return pending('Road-routing adapter (P3)'); } },
    clock: { now: () => new Date() }, mode: input.stub ? 'stub' : 'live',
    persistence: pool ? 'postgres' : 'memory', maxPlanMs: input.maxPlanMs,
  };
}
