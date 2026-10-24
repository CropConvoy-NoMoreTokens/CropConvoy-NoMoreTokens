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
