import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProceeds } from './pricing.js';
test('incremental detour pricing and farmer minimum use integer minor units', () => {
  assert.deepEqual(calculateProceeds({ quantityKg: 80, pricePerKgMinor: 22000, baseMinor: 35000,
    extraDistanceM: 6000, perKmMinor: 10000, handlingMinor: 0, minNetMinor: 1700000 }),
    { grossMinor: 1760000, transportMinor: 95000, netMinor: 1665000, eligible: false });
});
test('zero detour retains base and handling charges', () => {
  assert.equal(calculateProceeds({ quantityKg: 80, pricePerKgMinor: 22000, baseMinor: 35000,
    extraDistanceM: 0, perKmMinor: 10000, handlingMinor: 5000, minNetMinor: 0 }).transportMinor, 40000);
});
test('fractional road meters round only the final distance charge', () => {
  assert.equal(calculateProceeds({ quantityKg: 80, pricePerKgMinor: 22000, baseMinor: 35000,
    extraDistanceM: 6123.4, perKmMinor: 10000, handlingMinor: 0, minNetMinor: 0 }).transportMinor, 96234);
});
