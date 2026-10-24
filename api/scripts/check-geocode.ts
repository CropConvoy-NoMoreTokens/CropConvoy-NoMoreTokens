import assert from 'node:assert/strict';
import { resolveLocation } from '../src/modules/market/geocode.js';

const candidates = await resolveLocation('දඹුල්ල');
assert.ok(candidates.length > 0, 'No Sri Lankan result for a Sinhala place name');
assert.ok(candidates.every(place => place.point.lat > 5.8 && place.point.lat < 9.9 &&
  place.point.lng > 79.5 && place.point.lng < 82.1));
console.log(`Sinhala place lookup passed (${candidates.length} candidate${candidates.length === 1 ? '' : 's'})`);
