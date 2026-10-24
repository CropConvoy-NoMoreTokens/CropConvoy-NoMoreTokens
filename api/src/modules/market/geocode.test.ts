import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation, resolveLocationInputSchema } from './geocode.js';

test('place lookup sends only the place within Sri Lanka and caches the approximate result', async () => {
  const original = globalThis.fetch;
  const seen: URL[] = [];
  globalThis.fetch = async input => {
    seen.push(new URL(String(input)));
    return new Response(JSON.stringify([
      { display_name: 'දඹුල්ල, ශ්‍රී ලංකාව', lat: '7.8742', lon: '80.6511' },
      { display_name: 'Outside Sri Lanka', lat: '40', lon: '80' },
    ]));
  };
  try {
    const place = 'දඹුල්ල';
    const first = await resolveLocation(place);
    assert.deepEqual(first, [{ label: 'දඹුල්ල, ශ්‍රී ලංකාව', point: { lat: 7.8742, lng: 80.6511 } }]);
    assert.deepEqual(await resolveLocation(place), first);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].searchParams.get('q'), place);
    assert.equal(seen[0].searchParams.get('countrycodes'), 'lk');
    assert.equal(seen[0].searchParams.get('limit'), '3');
  } finally { globalThis.fetch = original; }
});

test('place input rejects full descriptions over the lookup limit', () => {
  assert.equal(resolveLocationInputSchema.safeParse({ place: 'x'.repeat(121) }).success, false);
  assert.equal(resolveLocationInputSchema.safeParse({ place: 'No. 12 Dambulla' }).success, false);
});
