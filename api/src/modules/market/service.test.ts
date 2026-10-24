import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Dependencies } from '../../core/dependencies.js';
import type { Order } from '../../core/contracts.js';
import type { MarketRepository } from './repository.js';
import { extractHarvestWithMode, findMarket } from './service.js';
import { listingFixture, listingId, orderFixture } from './fixtures.js';

function setup(orders: Order[], complete: Dependencies['llm']['complete']) {
  const repository = { async getListing() { return listingFixture; }, async listOrders() { return orders; } } as MarketRepository;
  const deps = { mode: 'live', llm: { complete } } as Dependencies;
  return { repository, deps };
}

test('market rejects invented and ineligible model IDs and uses filtered fallback', async () => {
  const eligible = orderFixture();
  const wrongCrop = orderFixture({ crop: 'potato' });
  const tooSmall = orderFixture({ remainingKg: 79 });
  const noPartial = orderFixture({ allowsPartial: false });
  const expired = orderFixture({ deadlineAt: '2026-10-25T03:00:00.000Z' });
  let calls = 0;
  const { repository, deps } = setup([wrongCrop, tooSmall, noPartial, expired, eligible], async () => {
    calls++;
    return calls === 1 ? { name: 'searchOrders', arguments: { listingId } }
      : { candidateOrderIds: [wrongCrop.id, randomUUID()] };
  });
  const result = await findMarket(listingId, deps, repository, new AbortController().signal);
  assert.deepEqual(result.candidateOrderIds, [eligible.id]);
  assert.match(result.reasons[eligible.id], /Deterministic fallback/);
  assert.equal(calls, 2);
});

test('market accepts only existing eligible IDs and bounds the model to two turns', async () => {
  const choices = [orderFixture(), orderFixture({ pricePerKgMinor: 23000 })];
  let calls = 0;
  const { repository, deps } = setup(choices, async () => {
    calls++;
    return calls === 1 ? { name: 'searchOrders', arguments: { listingId } }
      : { candidateOrderIds: [choices[1].id, choices[0].id] };
  });
  const result = await findMarket(listingId, deps, repository, new AbortController().signal);
  assert.deepEqual(result.candidateOrderIds, [choices[1].id, choices[0].id]);
  assert.equal(calls, 2);
});

test('extraction leaves missing fields null and asks for confirmation', async () => {
  const { deps } = setup([], async () => ({ draft: {
    crop: 'tomato', quantityKg: null, locationText: 'Colombo', readyAt: null, minNetMinor: null,
  } }));
  const result = await extractHarvestWithMode({ text: 'Tomatoes in Colombo',
    localTimeContext: { now: '2026-10-24T00:00:00.000Z', timeZone: 'Asia/Colombo' } }, deps);
  assert.equal(result.mode, 'live');
  assert.deepEqual(result.result.missingFields, ['quantityKg', 'readyAt', 'minNetMinor']);
  assert.equal(result.result.questions.length, 3);
});

test('invalid extraction is clearly labeled fallback', async () => {
  const { deps } = setup([], async () => ({ draft: { crop: 'banana' } }));
  const result = await extractHarvestWithMode({ text: 'fruit',
    localTimeContext: { now: '2026-10-24T00:00:00.000Z', timeZone: 'Asia/Colombo' } }, deps);
  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.result.draft.crop, null);
});

test('extraction discards guessed quantity, exact date and minimum proceeds', async () => {
  const { deps } = setup([], async () => ({ draft: {
    crop: 'tomato', quantityKg: 80, locationText: 'Dambulla',
    readyAt: '2026-10-25T02:30:00.000Z', minNetMinor: 1600000,
  } }));
  const result = await extractHarvestWithMode({ text: 'Tomatoes in Dambulla ready tomorrow morning.',
    localTimeContext: { now: '2026-10-24T04:30:00.000Z', timeZone: 'Asia/Colombo' } }, deps);
  assert.deepEqual(result.result.missingFields, ['quantityKg', 'readyAt', 'minNetMinor']);
});

test('a fractional kilogram statement cannot be misread as a whole kilogram', async () => {
  const { deps } = setup([], async () => ({ draft: {
    crop: 'tomato', quantityKg: 5, locationText: null, readyAt: null, minNetMinor: null,
  } }));
  const result = await extractHarvestWithMode({ text: 'I have 2.5 kg of tomatoes.',
    localTimeContext: { now: '2026-10-24T00:00:00.000Z', timeZone: 'Asia/Colombo' } }, deps);
  assert.equal(result.result.draft.quantityKg, null);
});
