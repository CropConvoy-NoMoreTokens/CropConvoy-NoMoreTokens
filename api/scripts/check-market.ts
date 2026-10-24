import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDependencies } from '../src/core/dependencies.js';
import { createMarketRepository } from '../src/modules/market/repository.js';
import { findMarket } from '../src/modules/market/service.js';

const { DATABASE_URL: databaseUrl, LLM_API_KEY: llmApiKey, LLM_MODEL: llmModel,
  LLM_BASE_URL: llmBaseUrl } = process.env;
if (!databaseUrl || !llmApiKey || !llmModel) throw new Error('Set DATABASE_URL, LLM_API_KEY, and LLM_MODEL');
const deps = createDependencies({ databaseUrl, llmApiKey, llmModel, llmBaseUrl,
  stub: false, maxPlanMs: 45000 });
const market = createMarketRepository(deps);
const farmerId = randomUUID();
const buyerId = randomUUID();
let listingId: string | undefined;
const orderIds: string[] = [];
try {
  await deps.db.ping();
  const readyAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  listingId = (await market.createListing({ demoFarmerId: farmerId, crop: 'tomato',
    quantityKg: 80, pickup: { lat: 6.9, lng: 79.9 }, readyAt,
    minNetMinor: 10000, confirmed: true })).id;
  const good = await market.createOrder({ demoBuyerId: buyerId, crop: 'tomato',
    remainingKg: 100, pricePerKgMinor: 22000, delivery: { lat: 7, lng: 80 },
    deadlineAt, allowsPartial: true });
  orderIds.push(good.id);
  const excluded = await market.createOrder({ demoBuyerId: buyerId, crop: 'tomato',
    remainingKg: 100, pricePerKgMinor: 23000, delivery: { lat: 7, lng: 80 },
    deadlineAt, allowsPartial: false });
  orderIds.push(excluded.id);
  const result = await findMarket(listingId, deps, market, AbortSignal.timeout(35000));
  assert.deepEqual(result.candidateOrderIds, [good.id]);
  assert.doesNotMatch(result.reasons[good.id], /fallback/i);
  console.log('Live market candidate filter against Neon and Gemini: passed');
} finally {
  for (const id of orderIds) await deps.db.query('DELETE FROM orders WHERE id = $1 AND demo_buyer_id = $2', [id, buyerId]);
  if (listingId) await deps.db.query('DELETE FROM listings WHERE id = $1 AND demo_farmer_id = $2', [listingId, farmerId]);
  await deps.db.close();
}
