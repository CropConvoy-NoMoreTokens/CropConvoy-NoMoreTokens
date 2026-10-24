import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { generationResultSchema, planSchema, type ApiResponse, type Listing, type Order } from '../src/core/contracts.js';
import { setup, fixture } from './workflow-fixtures.js';
import { demoAuthHeaders, loginDemoAccounts, type DemoTokens } from './fixtures/demo-auth.js';

const databaseUrl = process.env.P4_TEST_DATABASE_URL;
const local = databaseUrl && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname);
test('P2/P3/P4 PostgreSQL modules integrate over HTTP and survive API process restarts',
  { skip: !local, timeout: 40_000 }, async t => {
    const database = `p4_http_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
    let pool: Pool | undefined; let child: ChildProcess | undefined; let created = false; let base = '';
    const providerStages: string[] = [];
    const stop = async () => {
      if (!child) return;
      const running = child; child = undefined;
      if (running.exitCode !== null || running.signalCode !== null) return;
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => running.kill('SIGKILL'), 3000);
        running.once('exit', () => { clearTimeout(timer); resolve(); }); running.kill('SIGTERM');
      });
    };
    t.after(async () => {
      await stop(); await pool?.end();
      // Only this generated, local test database is removed; never user application data.
      if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      await admin.end();
    });
    await admin.query(`CREATE DATABASE "${database}"`); created = true;
    const url = new URL(databaseUrl!); url.pathname = `/${database}`;
    pool = new Pool({ connectionString: url.toString() });
    const migrate = () => promisify(execFile)(process.execPath,
      ['--import', 'tsx', fileURLToPath(new URL('../scripts/migrate.ts', import.meta.url))],
      { env: { ...process.env, DATABASE_URL: url.toString() } });
    const firstMigration = await migrate();
    assert.match(firstMigration.stdout, /Applied 002_demo_auth.sql/);
    assert.match(firstMigration.stdout, /Applied 002_weight_distance_logistics.sql/);
    const repeatedMigration = await migrate();
    assert.match(repeatedMigration.stdout, /Already applied 001_initial.sql/);
    assert.match(repeatedMigration.stdout, /Already applied 002_demo_auth.sql/);
    assert.match(repeatedMigration.stdout, /Already applied 002_weight_distance_logistics.sql/);
    const tr = setup().trip;
    await pool.query(`INSERT INTO trips (id,demo_transporter_id,start_lat,start_lng,end_lat,end_lng,departure_at,available_kg,
      route_geojson,route_distance_m,route_duration_s,route_provider,route_profile,corridor_m,max_extra_distance_m,max_extra_time_s,base_minor,per_km_minor,handling_minor,rate_per_kg_km_minor,pricing_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [tr.id,tr.demoTransporterId,tr.start.lat,tr.start.lng,tr.end.lat,tr.end.lng,tr.departureAt,tr.availableKg,
        JSON.stringify(tr.routeGeoJSON),tr.routeDistanceM,tr.routeDurationS,tr.routeProvider,tr.routeProfile,
        tr.corridorM,tr.maxExtraDistanceM,tr.maxExtraTimeS,tr.baseMinor,tr.perKmMinor,tr.handlingMinor,tr.ratePerKgKmMinor,tr.pricingVersion]);
    const start = async (scenario = 'valid', now = '2026-10-25T03:00:00Z') => {
      await stop(); providerStages.length = 0;
      const running = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./fixtures/p2-workflow-server.ts', import.meta.url))],
        { env: { ...process.env, P4_INTEGRATION_DATABASE_URL: url.toString(), P4_INTEGRATION_SCENARIO: scenario, P4_INTEGRATION_NOW: now },
          stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      child = running;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Integration API startup timed out')), 7000);
        const fail = (error: Error) => { clearTimeout(timer); reject(error); };
        running.once('error', fail);
        running.once('exit', () => fail(new Error('Integration API exited before readiness')));
        running.on('message', (message: { event?: string; port?: number; stage?: string; code?: string }) => {
          if (message.event === 'provider_call') providerStages.push(message.stage!);
          if (message.event === 'startup_failed') fail(new Error(`Integration API failed: ${message.code}`));
          if (message.event === 'listening') { base = `http://127.0.0.1:${message.port}`; clearTimeout(timer); resolve(); }
        });
      });
    };
    let tokens: DemoTokens;
    const request = (path: string, input?: unknown) => fetch(base + path, {
      headers: { ...demoAuthHeaders(tokens, path), ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(input === undefined ? {} : { method: 'POST', body: JSON.stringify(input) }),
    });
    const data = async <T,>(path: string, input?: unknown, status = 200): Promise<ApiResponse<T>> => {
      const response = await request(path, input); assert.equal(response.status, status);
      return await response.json() as ApiResponse<T>;
    };
    const generate = async (id: string) => {
      const envelope = await data('/api/plans/generate', { listingId: id });
      const generated = generationResultSchema.parse(envelope.data);
      assert.equal(generated.mode, envelope.meta.mode); return generated;
    };

    await start();
    tokens = await loginDemoAccounts(base, pool);
    assert.equal((await request('/ready')).status, 200);
    assert.equal((await fetch(base + '/api/orders')).status, 401);
    assert.equal((await fetch(base + '/api/orders', { headers: demoAuthHeaders(tokens, '/api/plans') })).status, 403);
    assert.equal((await request('/api/listings', {
      ...fixture.listingInput, demoFarmerId: fixture.orderInput.demoBuyerId,
    })).status, 403);
    const health = await fetch(base + '/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(health.headers.get('Access-Control-Allow-Origin'), '*');
    assert.match(health.headers.get('Access-Control-Expose-Headers') ?? '', /X-Request-Id/i);
    const extracted = await data<{ draft: { quantityKg: number; minNetMinor: number } }>('/api/harvest/extract', {
      text: '80 kg tomatoes in Dambulla ready 2026-10-25 at 08:00. Minimum net Rs. 16,000.',
      localTimeContext: fixture.extractInput.localTimeContext,
    });
    assert.equal(extracted.data.draft.quantityKg, 80); assert.equal(extracted.data.draft.minNetMinor, 1600000);
    assert.equal(extracted.meta.mode, 'live');
    let listing = (await data<Listing>('/api/listings', fixture.listingInput, 201)).data;
    const order = (await data<Order>('/api/orders', fixture.orderInput, 201)).data;
    const proposed = await generate(listing.id); assert.ok(proposed.plan);
    assert.equal((await fetch(base + `/api/plans/${proposed.plan.id}`)).status, 401);
    assert.equal((await fetch(base + `/api/plans/${proposed.plan.id}`, {
      headers: demoAuthHeaders(tokens, '/api/orders'),
    })).status, 403);
    assert.equal((await fetch(base + `/api/plans/${proposed.plan.id}/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...demoAuthHeaders(tokens, '/api/orders') },
      body: JSON.stringify({ decision: 'accept' }),
    })).status, 403);
    assert.equal(proposed.mode, 'live'); assert.equal(proposed.plan.quoteSnapshot.netMinor, 1665000);
    assert.equal(proposed.plan.sourceSnapshot.order.id, order.id);
    assert.equal(providerStages.filter(stage => stage === 'searchOrders').length, 1);
    assert.equal(providerStages.filter(stage => stage === 'rank').length, 1);
    assert.equal(providerStages.filter(stage => stage === 'review_quotes').length, 1);

    await start(); // New process, new pools and empty test quote caches.
    const retrieved = await data(`/api/plans/${proposed.plan.id}`);
    assert.deepEqual(planSchema.parse(retrieved.data), proposed.plan);
    const accepted = await data(`/api/plans/${proposed.plan.id}/decision`, { decision: 'accept' });
    assert.equal(planSchema.parse(accepted.data).status, 'farmer_accepted_pending_confirmations');
    assert.deepEqual((await data(`/api/plans/${proposed.plan.id}/decision`, { decision: 'accept' })).data, accepted.data);
    assert.equal((await request(`/api/plans/${proposed.plan.id}/decision`, { decision: 'reject' })).status, 409);

    assert.equal((await request('/api/plans/generate', {listingId:listing.id})).status,409);
    listing = (await data<Listing>('/api/listings', fixture.listingInput, 201)).data;
    const stale = await generate(listing.id); assert.ok(stale.plan);
    await pool.query('UPDATE orders SET price_per_kg_minor=price_per_kg_minor+1 WHERE id=$1', [order.id]);
    assert.equal((await request(`/api/plans/${stale.plan.id}/decision`, { decision: 'accept' })).status, 409);
    await pool.query('UPDATE orders SET price_per_kg_minor=$2 WHERE id=$1', [order.id, order.pricePerKgMinor]);
    const expiring = await generate(listing.id); assert.ok(expiring.plan);
    await start('valid', '2026-10-25T03:15:00Z');
    assert.equal((await request(`/api/plans/${expiring.plan.id}/decision`, { decision: 'accept' })).status, 409);

    await start();
    await pool.query('UPDATE listings SET min_net_minor=1700000 WHERE id=$1', [listing.id]);
    const low = await generate(listing.id);
    assert.equal(low.plan, null); assert.equal(low.searchComplete, true);
    assert.ok(low.rejections.some(rejection => rejection.codes.includes('BELOW_MINIMUM_NET')));
    await pool.query('UPDATE listings SET min_net_minor=$2 WHERE id=$1', [listing.id, listing.minNetMinor]);

    await start('unknown_market');
    const fallback = await generate(listing.id); assert.ok(fallback.plan);
    assert.equal(fallback.mode, 'deterministic_fallback'); assert.equal(fallback.searchComplete, true);
    assert.ok(fallback.trace.some(entry => entry.role === 'market' && entry.action === 'deterministic_fallback'));

    await start('advocate_hang');
    const partial = await generate(listing.id); assert.ok(partial.plan);
    assert.equal(partial.searchComplete, false); assert.equal(partial.plan.searchComplete, false);
    assert.equal(partial.mode, 'deterministic_fallback');
    await start();
    const restartedPartial = await data(`/api/plans/${partial.plan.id}`);
    assert.equal(restartedPartial.meta.mode, 'deterministic_fallback');
    assert.equal(planSchema.parse(restartedPartial.data).searchComplete, false);

    await pool.query('UPDATE orders SET remaining_kg=79 WHERE id=$1', [order.id]);
    const empty = await generate(listing.id);
    assert.equal(empty.plan, null); assert.equal(empty.searchComplete, true);
    await pool.query('UPDATE orders SET remaining_kg=$2 WHERE id=$1', [order.id, order.remainingKg]);
    await start('routing_unavailable');
    const unfinished = await generate(listing.id);
    assert.equal(unfinished.plan, null); assert.equal(unfinished.searchComplete, false);
    assert.ok(unfinished.rejections.some(rejection => rejection.codes.includes('ROUTING_UNAVAILABLE')));

    // All production modules now run together; only provider HTTP responses are synthetic.
    await start('integrated');
    let fullListing = (await data<Listing>('/api/listings', { ...fixture.listingInput, crop: 'carrot',
      pickup: { lat: 7, lng: 80.2 }, readyAt: '2026-10-25T03:00:00Z' }, 201)).data;
    const fullOrder = (await data<Order>('/api/orders', { ...fixture.orderInput, crop: 'carrot',
      delivery: { lat: 7, lng: 80.4 } }, 201)).data;
    const fullTripInput = { ...fixture.tripInput, start: { lat: 7, lng: 80 }, end: { lat: 7, lng: 80.6 },
      departureAt: '2026-10-25T04:00:00Z', ratePerKgKmMinor: 20, pricingVersion: 'weight-distance-v2' };
    const fullTrip = (await data<{ id: string }>('/api/trips', fullTripInput, 201)).data;
    await data('/api/trips', fullTripInput, 201);
    const full = await generate(fullListing.id); assert.ok(full.plan);
    assert.equal(full.mode, 'live'); assert.equal(full.searchComplete, true);
    assert.ok(full.plan.quoteSnapshot.shipmentChargeMinor > 0);
    assert.equal(full.plan.quoteSnapshot.detourChargeMinor, 60000);
    assert.equal(full.plan.expiresAt, full.plan.quoteSnapshot.expiresAt);
    assert.ok(full.trace.every(entry => entry.outcome.length <= 500 && !entry.outcome.includes('UNTRUSTED_MODEL_DETAIL')));
    assert.equal((await pool.query('SELECT id FROM logistics_quotes WHERE id=$1', [full.plan.quoteSnapshot.quoteId])).rowCount, 1);
    await start('integrated');
    assert.deepEqual(planSchema.parse((await data(`/api/plans/${full.plan.id}`)).data), full.plan);
    assert.equal(planSchema.parse((await data(`/api/plans/${full.plan.id}/decision`, { decision: 'accept' })).data).status,
      'farmer_accepted_pending_confirmations');

    fullListing=(await data<Listing>('/api/listings',{...fixture.listingInput,crop:'carrot',pickup:{lat:7,lng:80.2},readyAt:'2026-10-25T03:00:00Z'},201)).data;
    const realStale = await generate(fullListing.id); assert.ok(realStale.plan);
    await pool.query('UPDATE trips SET rate_per_kg_km_minor=21 WHERE id=$1', [realStale.plan.tripId]);
    assert.equal((await request(`/api/plans/${realStale.plan.id}/decision`, { decision: 'accept' })).status, 409);
    await pool.query('UPDATE trips SET rate_per_kg_km_minor=20 WHERE id=$1', [realStale.plan.tripId]);
    const ttl = await generate(fullListing.id); assert.ok(ttl.plan);
    await start('integrated', '2026-10-25T03:05:00Z');
    assert.equal((await request(`/api/plans/${ttl.plan.id}/decision`, { decision: 'accept' })).status, 409);

    await start('integrated_unknown_logistics');
    const logisticsFallback = await generate(fullListing.id); assert.ok(logisticsFallback.plan);
    assert.equal(logisticsFallback.mode, 'deterministic_fallback');
    assert.ok(logisticsFallback.trace.some(entry => entry.role === 'logistics' && entry.action === 'deterministic_fallback'));
    assert.ok(!logisticsFallback.trace.some(entry => entry.role === 'market' && entry.action === 'deterministic_fallback'));

    await start('integrated_deadline');
    const logisticsPartial = await generate(fullListing.id); assert.ok(logisticsPartial.plan);
    assert.equal(logisticsPartial.searchComplete, false);
    assert.equal(logisticsPartial.plan.searchComplete, false);
    assert.equal(logisticsPartial.mode, 'deterministic_fallback');
    await start('integrated');
    assert.equal(planSchema.parse((await data(`/api/plans/${logisticsPartial.plan.id}`)).data).searchComplete, false);

    await start('integrated_no_route');
    const noRoute = await generate(fullListing.id);
    assert.equal(noRoute.plan, null); assert.equal(noRoute.searchComplete, true);
    assert.ok(noRoute.rejections.some(rejection => rejection.codes.includes('NO_ROAD_ROUTE')));
    await start('integrated_routing_outage');
    const roadOutage = await generate(fullListing.id);
    assert.equal(roadOutage.plan, null); assert.equal(roadOutage.searchComplete, false);
    assert.ok(roadOutage.rejections.some(rejection => rejection.codes.includes('ROUTING_UNAVAILABLE')));
    assert.equal((await pool.query('SELECT available_kg FROM trips WHERE id=$1', [fullTrip.id])).rows[0].available_kg, fixture.tripInput.availableKg);
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1', [fullOrder.id])).rows[0].remaining_kg, 100);

    assert.equal((await pool.query('SELECT quantity_kg FROM listings WHERE id=$1', [listing.id])).rows[0].quantity_kg, 80);
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1', [order.id])).rows[0].remaining_kg, 100);
    assert.equal((await pool.query('SELECT available_kg FROM trips WHERE id=$1', [tr.id])).rows[0].available_kg, 120);
  });
