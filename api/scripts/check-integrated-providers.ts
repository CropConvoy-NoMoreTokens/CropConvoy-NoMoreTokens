import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { createDependencies, type Dependencies } from '../src/core/dependencies.js';
import { generationResultSchema, planSchema, type Trip, type Listing, type Order, type ApiResponse } from '../src/core/contracts.js';
import { configurePostgresNetworking, postgresPoolConfig } from '../src/core/postgres.js';

config({ quiet: true });
// Real provider calls, but all records belong to a generated LOCAL test database.
const testUrl = process.env.P4_TEST_DATABASE_URL;
if (!testUrl || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(testUrl).hostname))
  throw new Error('Set P4_TEST_DATABASE_URL to a disposable local PostgreSQL instance');
if (!process.env.ROUTING_BASE_URL) throw new Error('Set ROUTING_BASE_URL to an approved OSRM-compatible provider');
configurePostgresNetworking();
const database = `cropconvoy_live_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool(postgresPoolConfig(testUrl));
const url = new URL(testUrl); url.pathname = `/${database}`;
let created = false;
let deps: Dependencies | undefined;
let server: Server | undefined;
let base = '';
async function stop() {
  if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  await deps?.db.close(); server = undefined; deps = undefined;
}
async function start() {
  deps = createDependencies({ databaseUrl: url.toString(), stub: false, maxPlanMs: 45000,
    llmApiKey: process.env.LLM_API_KEY, llmModel: process.env.LLM_MODEL, llmBaseUrl: process.env.LLM_BASE_URL || undefined,
    routingBaseUrl: process.env.ROUTING_BASE_URL, routingProfile: process.env.ROUTING_PROFILE || 'driving' });
  await deps.db.ping();
  server = createApp(deps, ['http://localhost:5173']).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function request<T>(path: string, input?: unknown, status = 200): Promise<ApiResponse<T>> {
  const response = await fetch(base + path, input === undefined ? { signal: AbortSignal.timeout(50000) } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(50000),
  });
  const payload = await response.json() as ApiResponse<T> & { error?: { code?: string } };
  if (response.status !== status) throw Object.assign(new Error('Integrated HTTP check failed'), { code: payload.error?.code ?? `HTTP_${response.status}` });
  return payload;
}
try {
  await admin.query(`CREATE DATABASE "${database}"`); created = true;
  await promisify(execFile)(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./migrate.ts', import.meta.url))],
    { env: { ...process.env, DATABASE_URL: url.toString() } });
  await start();
  const now = Date.now();
  const trip = (await request<Trip>('/api/trips', {
    demoTransporterId: randomUUID(), start: { lat: 7.4863, lng: 80.3647 }, end: { lat: 6.9271, lng: 79.8612 },
    departureAt: new Date(now + 3600000).toISOString(), availableKg: 120, corridorM: 3000,
    maxExtraDistanceM: 10000, maxExtraTimeS: 3600, baseMinor: 35000, perKmMinor: 10000,
    ratePerKgKmMinor: 20, pricingVersion: 'weight-distance-v2', handlingMinor: 0,
  }, 201)).data;
  const coords = trip.routeGeoJSON.coordinates;
  const pickup = coords[Math.floor((coords.length - 1) / 3)];
  const delivery = coords[Math.floor((coords.length - 1) * 2 / 3)];
  const listing = (await request<Listing>('/api/listings', {
    demoFarmerId: randomUUID(), crop: 'tomato', quantityKg: 80,
    pickup: { lng: pickup[0], lat: pickup[1] }, readyAt: new Date(now + 1800000).toISOString(),
    minNetMinor: 1600000, confirmed: true,
  }, 201)).data;
  const order = (await request<Order>('/api/orders', {
    demoBuyerId: randomUUID(), crop: 'tomato', remainingKg: 100, pricePerKgMinor: 22000,
    delivery: { lng: delivery[0], lat: delivery[1] }, deadlineAt: new Date(now + 86400000).toISOString(), allowsPartial: true,
  }, 201)).data;
  const generated = generationResultSchema.parse((await request('/api/plans/generate', { listingId: listing.id })).data);
  if (!generated.plan) throw Object.assign(new Error('No validated live-provider proposal'), {
    code: generated.rejections.flatMap(rejection => rejection.codes).join(',') || 'INCOMPLETE_GENERATION',
  });
  const plan = generated.plan;
  const accepted = planSchema.parse((await request(`/api/plans/${plan.id}/decision`, { decision: 'accept' })).data);
  if (accepted.status !== 'farmer_accepted_pending_confirmations') throw new Error('Unexpected acceptance state');
  await stop(); await start();
  const restored = planSchema.parse((await request(`/api/plans/${plan.id}`)).data);
  if (restored.status !== accepted.status || restored.quoteSnapshot.transportMinor !== plan.quoteSnapshot.transportMinor)
    throw new Error('Stored proposal changed after API restart');
  const unchangedListing = (await request<Listing>(`/api/listings/${listing.id}`)).data;
  const unchangedOrder = (await request<Order[]>('/api/orders')).data.find(row => row.id === order.id);
  const unchangedTrip = (await request<Trip[]>('/api/trips')).data.find(row => row.id === trip.id);
  if (unchangedListing.quantityKg !== 80 || unchangedOrder?.remainingKg !== 100 || unchangedTrip?.availableKg !== 120)
    throw new Error('Decision changed source quantities');
  console.log(JSON.stringify({ event: 'integrated_live_provider_check', passed: true,
    realRoadGeometry: true, database: 'disposable_local', mode: generated.mode, searchComplete: generated.searchComplete,
    routeDistanceM: trip.routeDistanceM, carryingDistanceM: plan.quoteSnapshot.routeCarryDistanceM,
    transportMinor: plan.quoteSnapshot.transportMinor, netMinor: plan.quoteSnapshot.netMinor,
    status: restored.status, restartPreservedPlan: true }));
} catch (error) {
  console.error(JSON.stringify({ event: 'integrated_live_provider_check', passed: false,
    code: String((error as { code?: string; name?: string }).code ?? (error as Error).name) }));
  process.exitCode = 1;
} finally {
  await stop();
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
