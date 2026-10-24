import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Dependencies } from '../../core/dependencies.js';
import { createMarketRepository } from './repository.js';

test('PostgreSQL repository parameterizes inserts and maps bigint/timestamps safely', async () => {
  const farmerId = randomUUID();
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const deps = { persistence: 'postgres', db: { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    return { rows: [{ id: randomUUID(), demo_farmer_id: farmerId, crop: 'tomato', quantity_kg: 80,
      pickup_lat: 6.9, pickup_lng: 79.9, ready_at: new Date('2026-10-25T04:00:00Z'),
      min_net_minor: '9007199254740991', seller_declared: true, status: 'open',
      created_at: new Date('2026-10-24T00:00:00Z') }] };
  } } } as unknown as Dependencies;
  const result = await createMarketRepository(deps).createListing({ demoFarmerId: farmerId,
    crop: 'tomato', quantityKg: 80, pickup: { lat: 6.9, lng: 79.9 },
    readyAt: '2026-10-25T04:00:00.000Z', minNetMinor: Number.MAX_SAFE_INTEGER, confirmed: true });
  assert.equal(result.minNetMinor, Number.MAX_SAFE_INTEGER);
  assert.equal(result.readyAt, '2026-10-25T04:00:00.000Z');
  assert.match(calls[0].sql, /VALUES \(\$1,\$2,\$3/);
  assert.equal(calls[0].values?.[1], farmerId);
  assert.equal(calls[0].values?.[7], Number.MAX_SAFE_INTEGER);
});
