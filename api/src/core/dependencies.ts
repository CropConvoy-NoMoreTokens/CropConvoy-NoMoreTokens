import { Pool, type QueryResultRow } from 'pg';
import type { ApiMode, Point, LineString } from './contracts.js';
import { pending } from './errors.js';
import { createOsrmRoutingClient } from '../modules/logistics/routing.js';
import { createGeminiClient } from './llm.js';
import { configurePostgresNetworking, postgresPoolConfig } from './postgres.js';

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
  llmApiKey?: string; llmModel?: string; llmBaseUrl?: string; routingBaseUrl?: string; routingProfile?: string }): Dependencies {
  if (input.databaseUrl) configurePostgresNetworking();
  const pool = input.databaseUrl ? new Pool(postgresPoolConfig(input.databaseUrl)) : null;
