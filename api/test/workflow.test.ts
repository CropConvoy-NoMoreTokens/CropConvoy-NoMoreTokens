import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setup, results } from './workflow-fixtures.js';
import { deterministicReview, reviewOptions, quoteRejectionCodes } from '../src/modules/advocate/service.js';
import { generationResultSchema, quoteSnapshotSchema } from '../src/core/contracts.js';
import { createBudget } from '../src/modules/workflow/budget.js';

const conflict = (error: unknown) => (error as { status: number }).status === 409;
test('fixture generation persists authoritative amounts; decisions are idempotent, conditional and leave sources alone', async () => {
  const f = setup(); const service = f.workflow();
  const result = generationResultSchema.parse(await service.generate(f.listing.id));
  assert.equal(result.outcome, 'proposed');
  assert.equal(result.plan?.quoteSnapshot.netMinor, 1665000);
  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.searchComplete, true);
  const original = structuredClone({ listing: f.listing, order: f.order, trip: f.trip });
  const id = result.plan!.id;
  const retrieved = await service.getPlan(id);
  retrieved.quoteSnapshot.netMinor = 0;
  assert.equal((await service.getPlan(id)).quoteSnapshot.netMinor, 1665000);
  const [a, b] = await Promise.all([service.decide(id, 'accept'), service.decide(id, 'accept')]);
  assert.equal(a.status, 'farmer_accepted_pending_confirmations'); assert.deepEqual(a, b);
  f.setNow('2026-10-26T03:00:00Z');
  assert.deepEqual(await service.decide(id, 'accept'), a);
  await assert.rejects(service.decide(id, 'reject'), conflict);
  assert.deepEqual({ listing: f.listing, order: f.order, trip: f.trip }, original);
});

test('low proceeds and missing or failed hard-rule outcomes cannot be overridden', async () => {
  const f = setup();
  f.listing.minNetMinor = 1700000;
  assert.equal(deterministicReview({ listing: f.listing, quotes: [f.quote] }).selectedQuoteId, null);
  const result = await f.workflow().generate(f.listing.id);
  assert.equal(result.plan, null); assert.equal(result.searchComplete, true);
  assert.ok(result.rejections[0].codes.includes('BELOW_MINIMUM_NET'));
  f.listing.minNetMinor = 1600000;
  delete f.quote.ruleOutcomes.snapping;
  assert.ok(quoteRejectionCodes(f.listing, f.quote).includes('HARD_RULE_FAILED'));
  f.quote.ruleOutcomes.snapping = false;
  assert.equal((await f.workflow().generate(f.listing.id)).plan, null);
});

test('money mismatches, unsafe multiplication and unknown source IDs are rejected', async () => {
  const f = setup();
  f.quote.netMinor++;
  assert.ok(quoteRejectionCodes(f.listing, f.quote).includes('INVALID_MONEY'));
  f.quote.pricePerKgMinor = Number.MAX_SAFE_INTEGER;
  assert.ok(quoteRejectionCodes(f.listing, f.quote).includes('INVALID_MONEY'));
  f.quote.listingId = randomUUID();
  assert.equal((await f.workflow().generate(f.listing.id)).plan, null);
});

test('runtime schemas reject malformed geometry, unsafe amounts, non-UTC dates and unknown fields', () => {
  const f = setup(); assert.equal(quoteSnapshotSchema.safeParse(f.quote).success, true);
  for (const changes of [{ grossMinor: 1.5 }, { transportMinor: Number.MAX_SAFE_INTEGER + 1 },
    { pickupAt: '2026-10-25T04:00:00+00:00' }, { baseGeometry: { type: 'LineString', coordinates: [[80, 7]] } },
    { booking: true }]) assert.equal(quoteSnapshotSchema.safeParse({ ...f.quote, ...changes }).success, false);
});

test('model unknown IDs and lower-net choices repair once then use code-selected highest net', async () => {
  const f = setup(); f.deps.mode = 'live';
  const lower = { ...f.quote, quoteId: randomUUID(), netMinor: f.quote.netMinor - 100, transportMinor: f.quote.transportMinor + 100,
    handlingMinor: 100 };
  let calls = 0;
  f.deps.llm.complete = async () => { calls++; return { tool: 'review_quotes', arguments: { selectedQuoteId: lower.quoteId, requestAlternative: false } }; };
  const review = await reviewOptions({ listing: f.listing, quotes: [lower, f.quote] }, f.deps, new AbortController().signal);
  assert.equal(calls, 2); assert.equal(review.selectedQuoteId, f.quote.quoteId); assert.ok(review.reasonCodes.includes('MODEL_FALLBACK'));
  calls = 0;
  f.deps.llm.complete = async () => { calls++; return { tool: 'review_quotes', arguments: { selectedQuoteId: randomUUID(), requestAlternative: false } }; };
  const result = await f.workflow().generate(f.listing.id);
  assert.equal(calls, 2); assert.equal(result.plan?.quoteSnapshot.quoteId, f.quote.quoteId);
  assert.equal(result.mode, 'deterministic_fallback'); assert.equal(result.plan?.mode, result.mode);
});

test('model outage preserves deterministic proposal and exposes fallback metadata', async () => {
  const f = setup(); f.deps.mode = 'live'; f.deps.llm.complete = async () => { throw new Error('provider unavailable'); };
  const result = await f.workflow().generate(f.listing.id);
  assert.equal(result.mode, 'deterministic_fallback'); assert.ok(result.plan);
});

test('no matches return a completed empty result; actual starter remains incomplete', async () => {
  const f = setup(); f.options.findMarket = async () => ({ ...results.market, candidateOrderIds: [] });
  f.logistics.evaluate = async () => { throw new Error('Should not evaluate'); };
  assert.equal((await f.workflow().generate(f.listing.id)).searchComplete, true);
  f.deps.mode = 'stub'; assert.equal((await f.workflow().generate(f.listing.id)).searchComplete, false);
});

test('deadline enforces a hard bound even when an adapter ignores cancellation', async () => {
  const f = setup(); f.deps.maxPlanMs = 60;
  let signal: AbortSignal | undefined;
  f.logistics.evaluate = async (_input, received) => { signal = received; return new Promise(() => {}); };
  const start = performance.now(); const result = await f.workflow().generate(f.listing.id);
  assert.ok(performance.now() - start < 500); assert.equal(signal?.aborted, true);
  assert.equal(result.plan, null); assert.equal(result.searchComplete, false);
});

test('deadline during advocate retains evaluated proposal with incomplete search and deterministic review', async () => {
  const f = setup(); f.deps.mode = 'live'; f.deps.maxPlanMs = 100;
  f.deps.llm.complete = async () => new Promise(() => {});
  const result = await f.workflow().generate(f.listing.id);
  assert.equal(result.searchComplete, false); assert.equal(result.mode, 'deterministic_fallback'); assert.ok(result.plan);
});

test('stale listing, order, trip and expired plans give 409; unchanged rejection is repeatable', async () => {
  for (const change of [(f: ReturnType<typeof setup>) => f.listing.pickup.lat++,
    (f: ReturnType<typeof setup>) => f.order.pricePerKgMinor++,
    (f: ReturnType<typeof setup>) => f.trip.departureAt = '2026-10-25T03:01:00Z',
    (f: ReturnType<typeof setup>) => f.setNow('2026-10-25T03:15:00Z')]) {
    const f = setup(); const service = f.workflow(); const result = await service.generate(f.listing.id);
    change(f); await assert.rejects(service.decide(result.plan!.id, 'accept'), conflict);
  }
  const f = setup(); const service = f.workflow(); const id = (await service.generate(f.listing.id)).plan!.id;
  const rejected = await service.decide(id, 'reject'); assert.equal(rejected.status, 'rejected');
  assert.deepEqual(await service.decide(id, 'reject'), rejected); await assert.rejects(service.decide(id, 'accept'), conflict);
});

test('competing decisions cannot both succeed', async () => {
  const f = setup(); const service = f.workflow(); const id = (await service.generate(f.listing.id)).plan!.id;
  const outcomes = await Promise.allSettled([service.decide(id, 'accept'), service.decide(id, 'reject')]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
});

test('at most three candidates, one alternative attempt and one displayed alternative', async () => {
  const f = setup(); const ids = [f.order.id, randomUUID(), randomUUID()];
  f.options.findMarket = async () => ({ ...results.market, candidateOrderIds: ids });
  let calls = 0;
  f.logistics.evaluate = async input => { calls++; assert.ok(input.candidateOrderIds.length <= 2); return { options: [], rejections: [] }; };
  assert.equal((await f.workflow().generate(f.listing.id)).plan, null); assert.equal(calls, 2);
  f.options.findMarket = async () => ({ ...results.market, candidateOrderIds: [...ids, randomUUID()] });
  calls = 0; assert.equal((await f.workflow().generate(f.listing.id)).searchComplete, false); assert.equal(calls, 0);
});

test('request-scoped external work limits turns, routes and concurrency; all receive abort signals', async () => {
  const f = setup(); let signals = 0;
  f.deps.llm.complete = async input => { assert.ok(input.signal); signals++; return {}; };
  f.deps.routing.route = async (_points, signal) => { assert.ok(signal); signals++; return {
    geometry: f.trip.routeGeoJSON, distanceM: 1, durationS: 1, legs: [], snappedPoints: [], provider: 'test', profile: 'test' }; };
  const budget = createBudget(f.deps);
  try {
    for (const role of ['market', 'logistics', 'advocate'] as const) {
      for (let i = 0; i < 2; i++) await budget.deps.llm.complete({ role, system: '', input: {}, tools: [], signal: budget.signal });
      await assert.rejects(budget.deps.llm.complete({ role, system: '', input: {}, tools: [], signal: budget.signal }));
    }
    for (let i = 0; i < 6; i++) await budget.deps.routing.route([], budget.signal);
    await assert.rejects(budget.deps.routing.route([], budget.signal)); assert.equal(signals, 12);
  } finally { budget.close(); }
  const second = createBudget(f.deps);
  let active = 0; let maximum = 0;
  f.deps.routing.route = async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return { geometry: f.trip.routeGeoJSON, distanceM: 1, durationS: 1, legs: [], snappedPoints: [], provider: 'test', profile: 'test' };
  };
  try {
    const pending = Array.from({ length: 6 }, () => second.deps.routing.route([], second.signal));
    await assert.rejects(second.deps.routing.route([], second.signal)); await Promise.all(pending);
    assert.equal(maximum, 2);
  } finally { second.close(); }
});

test('live generation fails closed if shared logistics bypasses budget injection', async () => {
  const f = setup(); f.deps.mode = 'live'; delete f.options.logisticsForGeneration;
  await assert.rejects(f.workflow().generate(f.listing.id), (e: unknown) => (e as { code: string }).code === 'BUDGET_WIRING_REQUIRED');
});


test('sources changed during evaluation, closed sources and cached older quotes fail closed', async () => {
  const f = setup();
  // A repository may return object references; generation must take independent copies.
  f.market.getListing = async () => f.listing;
  f.market.listOrders = async () => [f.order];
  f.logistics.listTrips = async () => [f.trip];
  f.logistics.evaluate = async () => { f.order.delivery.lat++; return structuredClone(results.logistics); };
  const stale = await f.workflow().generate(f.listing.id);
  assert.equal(stale.plan, null); assert.ok(stale.rejections[0].codes.includes('SOURCE_CHANGED_DURING_EVALUATION'));
  const old = setup(); old.quote.generatedAt = '2026-10-25T02:59:59Z';
  assert.equal((await old.workflow().generate(old.listing.id)).plan, null);
  const closed = setup(); const service = closed.workflow(); const id = (await service.generate(closed.listing.id)).plan!.id;
  Object.assign(closed.order, { status: 'closed' });
  await assert.rejects(service.decide(id, 'accept'), conflict);
});

test('workflow selects the highest-net full snapshot among evaluated quotes and bounds alternatives', async () => {
  const f = setup();
  const better = { ...structuredClone(f.quote), quoteId: randomUUID(), extraDistanceM: 5000,
    modifiedDistanceM: 65000, detourChargeMinor: 50000, transportMinor: 85000, netMinor: 1675000 };
  f.logistics.getQuote = async id => structuredClone(id === better.quoteId ? better : f.quote);
  f.logistics.evaluate = async () => ({ options: [f.quote, better].map(q => ({ orderId: q.orderId,
    tripId: q.tripId, quoteId: q.quoteId, extraDistanceM: q.extraDistanceM, deliveryAt: q.deliveryAt,
    transportMinor: q.transportMinor })), rejections: [] });
  const generated = await f.workflow().generate(f.listing.id);
  assert.equal(generated.plan?.quoteSnapshot.quoteId, better.quoteId);
  assert.equal(generated.alternatives.length, 1); assert.equal(generated.alternatives[0].quoteId, f.quote.quoteId);
});


test('abort cancels queued routing without starting extra provider work', async () => {
  const f = setup(); let calls = 0;
  f.deps.routing.route = async () => { calls++; return new Promise(() => {}); };
  const budget = createBudget(f.deps);
  const pending = Array.from({ length: 6 }, () => budget.deps.routing.route([], budget.signal));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2); budget.close();
  const settled = await Promise.allSettled(pending);
  assert.equal(settled.filter(value => value.status === 'rejected').length, 6); assert.equal(calls, 2);
});


test('P1 response examples stay synchronized with runtime result schemas', async () => {
  const examples = JSON.parse(await readFile(new URL('../../contracts/fixtures/workflow-responses.json', import.meta.url), 'utf8'));
  for (const key of ['success', 'empty', 'incomplete']) {
    const result = generationResultSchema.parse(examples[key].data);
    assert.equal(result.mode, examples[key].meta.mode);
  }
  assert.equal(examples.success.data.plan.quoteSnapshot.netMinor, 1665000);
  assert.equal(examples.empty.data.plan, null);
  assert.equal(examples.incomplete.data.searchComplete, false);
});


test('one alternative batch can produce a valid proposal', async () => {
  const f = setup(); let calls = 0;
  f.options.findMarket = async () => ({ ...results.market, candidateOrderIds: [randomUUID(), randomUUID(), f.order.id] });
  f.logistics.evaluate = async input => {
    calls++;
    return input.candidateOrderIds.includes(f.order.id) ? structuredClone(results.logistics) : { options: [], rejections: [] };
  };
  const result = await f.workflow().generate(f.listing.id);
  assert.ok(result.plan); assert.equal(calls, 2);
  assert.ok(result.trace.some(entry => entry.action === 'alternative_evaluation'));
});

test('deadline during later quote retrieval saves earlier evaluated snapshot as deterministic partial result', async () => {
  const f = setup(); f.deps.mode = 'live'; f.deps.maxPlanMs = 100;
  const secondId = randomUUID();
  f.logistics.evaluate = async () => ({ options: [results.logistics.options[0], { ...results.logistics.options[0], quoteId: secondId }], rejections: [] });
  f.logistics.getQuote = async id => id === f.quote.quoteId ? structuredClone(f.quote) : new Promise(() => {});
  const result = await f.workflow().generate(f.listing.id);
  assert.ok(result.plan); assert.equal(result.plan.quoteSnapshot.quoteId, f.quote.quoteId);
  assert.equal(result.searchComplete, false); assert.equal(result.mode, 'deterministic_fallback');
});
