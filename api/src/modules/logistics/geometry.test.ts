import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkCorridor,assertSimpleRoute,meters} from './geometry.js';
import type {LineString} from '../../core/contracts.js';
const line:LineString={type:'LineString',coordinates:[[80,7],[80.6,7]]};
test('projects onto segment interior and bills only the carried route portion',()=>{
  const r=checkCorridor(line,{lng:80.2,lat:7.0001},{lng:80.4,lat:7.0001},100);
  assert.ok(r.pickup.distanceM<20);
  assert.ok(Math.abs(r.routeCarryDistanceM-meters({lng:80.2,lat:7},{lng:80.4,lat:7}))<10);
  const longer:LineString={type:'LineString',coordinates:[[79.8,7],[80,7],[80.6,7],[80.8,7]]};
  const other=checkCorridor(longer,{lng:80.2,lat:7.0001},{lng:80.4,lat:7.0001},100);
  assert.ok(Math.abs(r.routeCarryDistanceM-other.routeCarryDistanceM)<0.01);
});
test('rejects reversed delivery and points outside corridor',()=>{
  assert.throws(()=>checkCorridor(line,{lng:80.4,lat:7},{lng:80.2,lat:7},3000),/WRONG_DIRECTION/);
  assert.throws(()=>checkCorridor(line,{lng:80.2,lat:8},{lng:80.4,lat:7},3000),/PICKUP_TOO_FAR/);
});
test('rejects loops, crossings and overlapping reversal',()=>{
  for(const coordinates of [
    [[80,7],[80.2,7],[80,7]],
    [[80,7],[80.2,7.2],[80,7.2],[80.2,7]],
    [[80,7],[80.4,7],[80.2,7]],
  ])assert.throws(()=>assertSimpleRoute({type:'LineString',coordinates:coordinates as [number,number][]}),/AMBIGUOUS/);
});
test('validateStops passes when points are within snap tolerance', async () => {
  const { validateStops } = await import('./feasibility.js');
  const points = [{ lng: 80.0, lat: 7.0 }, { lng: 80.5, lat: 7.0 }];
  const snapped = [{ lng: 80.0001, lat: 7.0 }, { lng: 80.5001, lat: 7.0 }];
  assert.doesNotThrow(() => validateStops(points, snapped, 100));
});
test('validateStops provides precise stop label, measured distance, and field path on SNAP_TOO_FAR', async () => {
  const { validateStops } = await import('./feasibility.js');
  const { FeasibilityError } = await import('./geometry.js');
  const points = [{ lng: 81.228104, lat: 7.38629 }, { lng: 79.8612, lat: 6.9271 }];
  // Snapped start is ~151m away
  const snapped = [{ lng: 81.229468, lat: 7.386345 }, { lng: 79.8612, lat: 6.9271 }];
  try {
    validateStops(points, snapped, 100, [
      { label: 'Start location', fieldPrefix: 'start' },
      { label: 'Destination', fieldPrefix: 'end' },
    ]);
    assert.fail('Should have thrown FeasibilityError');
  } catch (e) {
    assert.ok(e instanceof FeasibilityError);
    assert.equal(e.code, 'SNAP_TOO_FAR');
    assert.equal(e.status, 422);
    assert.ok(e.message.includes('Start location pin is 151m from the nearest road'));
    assert.ok(e.message.includes('(SNAP_TOO_FAR)'));
    assert.deepEqual(e.fields, [
      {
        path: 'start.lat',
        message: 'Start location pin is 151m away from the nearest road (maximum allowed is 100m). Move the pin closer to a drivable road on the map or select a nearby town.',
      },
    ]);
  }
});
