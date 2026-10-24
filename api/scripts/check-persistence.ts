import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDependencies } from '../src/core/dependencies.js';
import { createMarketRepository } from '../src/modules/market/repository.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before checking persistence');
const input = { databaseUrl: process.env.DATABASE_URL, stub: true, maxPlanMs: 45000 };
const farmerId = randomUUID();
const buyerId = randomUUID();
let listingId: string | undefined;
let orderId: string | undefined;
let deps = createDependencies(input);
try {
  await deps.db.ping();
  const market = createMarketRepository(deps);
  listingId = (await market.createListing({ demoFarmerId: farmerId, crop: 'tomato', quantityKg: 80,
    pickup: { lat: 6.9, lng: 79.9 }, readyAt: '2026-11-01T04:00:00.000Z',
    minNetMinor: 10000, confirmed: true })).id;
  orderId = (await market.createOrder({ demoBuyerId: buyerId, crop: 'tomato',
    remainingKg: 100, pricePerKgMinor: 22000, delivery: { lat: 7, lng: 80 },
    deadlineAt: '2026-11-01T10:00:00.000Z', allowsPartial: true })).id;
  await deps.db.close();
  deps = createDependencies(input);
  const afterRestart = createMarketRepository(deps);
  assert.equal((await afterRestart.getListing(listingId)).quantityKg, 80);
  assert.ok((await afterRestart.listOrders()).some(order => order.id === orderId));
  console.log('Neon readiness and listing/order persistence after reconnect: passed');
} finally {
  if (orderId) await deps.db.query('DELETE FROM orders WHERE id = $1 AND demo_buyer_id = $2', [orderId, buyerId]);
  if (listingId) await deps.db.query('DELETE FROM listings WHERE id = $1 AND demo_farmer_id = $2', [listingId, farmerId]);
  await deps.db.close();
}
