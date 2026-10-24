import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProceeds } from './pricing.js';
const fare={quantityKg:80,pricePerKgMinor:22000,baseMinor:35000,extraDistanceM:6000,perKmMinor:10000,
  routeCarryDistanceM:100000,shipmentPerKmMinor:1000,handlingMinor:0,minNetMinor:1600000,pricingVersion:'hybrid-v1' as const};
test('hybrid fare prices carrying segment and added detour with exact rupee example',()=>{
  assert.deepEqual(calculateProceeds(fare),{grossMinor:1760000,shipmentChargeMinor:100000,detourChargeMinor:60000,
    transportMinor:195000,netMinor:1565000,eligible:false});
});
test('zero detour retains carrying charge, base and handling',()=>{
  assert.equal(calculateProceeds({...fare,extraDistanceM:0,handlingMinor:5000}).transportMinor,140000);
});
test('fractional distance rounds each displayed component once',()=>{
  const r=calculateProceeds({...fare,routeCarryDistanceM:100123.4,extraDistanceM:6123.4});
  assert.equal(r.shipmentChargeMinor,100123);assert.equal(r.detourChargeMinor,61234);assert.equal(r.transportMinor,196357);
});
test('weight does not secretly multiply the fare; net can be negative',()=>{
  assert.equal(calculateProceeds({...fare,quantityKg:1}).transportMinor,195000);
  assert.equal(calculateProceeds({...fare,quantityKg:1}).netMinor,-173000);
});
test('legacy/missing fields, invalid distances and unsafe arithmetic fail',()=>{
  for(const patch of [{extraDistanceM:-1},{routeCarryDistanceM:Infinity},{routeCarryDistanceM:NaN},
    {shipmentPerKmMinor:undefined},{pricingVersion:'detour-v0'},{quantityKg:1.5},
    {pricePerKgMinor:Number.MAX_SAFE_INTEGER},{baseMinor:Number.MAX_SAFE_INTEGER}]){
    assert.throws(()=>calculateProceeds({...fare,...patch} as typeof fare));
  }
});
