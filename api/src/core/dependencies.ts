import { Pool, type QueryResultRow } from 'pg';
import type { ApiMode, Point, LineString } from './contracts.js';
import { pending } from './errors.js';
import { createOsrmRoutingClient } from '../modules/logistics/routing.js';
import { createGeminiClient } from './llm.js';
import { configurePostgresNetworking, postgresPoolConfig } from './postgres.js';

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  transaction?<T>(work: (db: Database) => Promise<T>): Promise<T>;
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
  llmApiKey?: string; llmModel?: string; llmBaseUrl?: string; routingBaseUrl?: string; routingProfile?: string }): Dependencies {
  if (input.databaseUrl) configurePostgresNetworking();
  const pool = input.databaseUrl ? new Pool(postgresPoolConfig(input.databaseUrl)) : null;
  return {
    db: {
      async query(sql, values) { if (!pool) return pending('Database connection'); return pool.query(sql, values); },
      async transaction(work) {
        if (!pool) return pending('Database transaction');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const db: Database = { query: (sql, values) => client.query(sql, values), async ping() {}, async close() {} };
          const value = await work(db);
          await client.query('COMMIT'); return value;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      async ping() {
        if (!pool) return pending('Database connection');
        const { rows } = await pool.query<Record<string, string | null>>(
          `SELECT to_regclass('public.listings') AS listings, to_regclass('public.orders') AS orders,
            to_regclass('public.trips') AS trips, to_regclass('public.plans') AS plans,
            to_regclass('public.logistics_quotes') AS quotes, to_regclass('public.plans_one_active_listing') AS booking_migration,
            to_regclass('public.demo_users') AS demo_users, to_regclass('public.demo_sessions') AS demo_sessions,
            (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='trips' AND column_name='rate_per_kg_km_minor') AS tariff`);
        if (!rows[0] || Object.values(rows[0]).some(value => value === null))
          throw new Error('Database migrations are incomplete; apply all migrations before serving traffic');
      },
      async close() { await pool?.end(); },
    },
    llm: input.llmApiKey && input.llmModel
      ? createGeminiClient(input.llmApiKey, input.llmModel, input.llmBaseUrl)
      : { async complete() { return pending('LLM configuration'); } },
    routing: input.routingBaseUrl ? createOsrmRoutingClient({baseUrl:input.routingBaseUrl,profile:input.routingProfile}) :
      { async route() { return pending('ROUTING_BASE_URL configuration'); } },
    clock: { now: () => new Date() }, mode: input.stub ? 'stub' : 'live',
    persistence: pool ? 'postgres' : 'memory', maxPlanMs: input.maxPlanMs,
  };
}
