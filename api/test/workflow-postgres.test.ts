import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { setup } from './workflow-fixtures.js';
import { planSchema } from '../src/core/contracts.js';

const databaseUrl = process.env.P4_TEST_DATABASE_URL;
test('PostgreSQL stores full plans across a new process and arbitrates concurrent decisions', { skip: !databaseUrl }, async t => {
  const schema = `p4_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: databaseUrl });
  // Identifier is generated here, never derived from request input.
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); });
  await pool.query(await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8'));
  const f = setup(); const { listing: l, order: o, trip: tr } = f;
  await pool.query(`INSERT INTO listings (id,demo_farmer_id,crop,quantity_kg,pickup_lat,pickup_lng,ready_at,min_net_minor)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [l.id,l.demoFarmerId,l.crop,l.quantityKg,l.pickup.lat,l.pickup.lng,l.readyAt,l.minNetMinor]);
  await pool.query(`INSERT INTO orders (id,demo_buyer_id,crop,remaining_kg,price_per_kg_minor,delivery_lat,delivery_lng,deadline_at,allows_partial)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [o.id,o.demoBuyerId,o.crop,o.remainingKg,o.pricePerKgMinor,o.delivery.lat,o.delivery.lng,o.deadlineAt,o.allowsPartial]);
  await pool.query(`INSERT INTO trips (id,demo_transporter_id,start_lat,start_lng,end_lat,end_lng,departure_at,available_kg,
    route_geojson,route_distance_m,route_duration_s,route_provider,route_profile,corridor_m,max_extra_distance_m,max_extra_time_s,base_minor,per_km_minor,handling_minor)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [tr.id,tr.demoTransporterId,tr.start.lat,tr.start.lng,tr.end.lat,tr.end.lng,tr.departureAt,tr.availableKg,
      JSON.stringify(tr.routeGeoJSON),tr.routeDistanceM,tr.routeDurationS,tr.routeProvider,tr.routeProfile,
      tr.corridorM,tr.maxExtraDistanceM,tr.maxExtraTimeS,tr.baseMinor,tr.perKmMinor,tr.handlingMinor]);
  f.deps.persistence = 'postgres';
  f.deps.db = { query: (sql, values) => pool.query(sql, values), async ping() {}, async close() {} };
  const first = f.workflow(); const generated = await first.generate(l.id); assert.ok(generated.plan);
  const id = generated.plan.id;
  const { stdout } = await promisify(execFile)(process.execPath,
    ['--import', 'tsx', new URL('./fixtures/read-plan.ts', import.meta.url).pathname, id],
    { env: { ...process.env, P4_TEST_SCHEMA: schema } });
  const restarted = planSchema.parse(JSON.parse(stdout));
  assert.deepEqual(restarted, generated.plan);
  const second = f.workflow();
  assert.deepEqual(await second.getPlan(id), restarted);
  const concurrent = await Promise.allSettled([first.decide(id, 'accept'), second.decide(id, 'reject')]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  const saved = await second.getPlan(id);
  const decision = saved.status === 'rejected' ? 'reject' : 'accept';
  assert.deepEqual(await first.decide(id, decision), saved);
  f.deps.mode = 'live'; f.deps.maxPlanMs = 500;
  f.deps.llm.complete = async () => new Promise(() => {});
  const partial = await first.generate(l.id);
  assert.ok(partial.plan);
  assert.equal(partial.plan.searchComplete, false);
  assert.equal((await second.getPlan(partial.plan.id)).searchComplete, false);
  // Older JSONB reviews remain readable, without inventing a completeness claim.
  await pool.query("UPDATE plans SET review = review - 'searchComplete' WHERE id = $1", [partial.plan.id]);
  assert.equal((await second.getPlan(partial.plan.id)).searchComplete, undefined);
  f.deps.mode = 'deterministic_fallback';
  const expired = await first.generate(l.id); f.setNow('2026-10-25T03:15:00Z');
  await assert.rejects(second.decide(expired.plan!.id, 'accept'), (error: unknown) => (error as { status: number }).status === 409);
  const unchanged = await pool.query('SELECT quantity_kg FROM listings WHERE id=$1', [l.id]);
  const demand = await pool.query('SELECT remaining_kg FROM orders WHERE id=$1', [o.id]);
  const capacity = await pool.query('SELECT available_kg FROM trips WHERE id=$1', [tr.id]);
  assert.equal(unchanged.rows[0].quantity_kg, 80); assert.equal(demand.rows[0].remaining_kg, 100); assert.equal(capacity.rows[0].available_kg, 120);
});
