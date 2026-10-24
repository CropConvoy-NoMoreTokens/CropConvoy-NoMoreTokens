import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProceeds } from './pricing.js';
const fare={quantityKg:80,pricePerKgMinor:22000,baseMinor:35000,extraDistanceM:6000,perKmMinor:10000,
  routeCarryDistanceM:100000,ratePerKgKmMinor:20,handlingMinor:0,minNetMinor:1600000,pricingVersion:'weight-distance-v2' as const};
test('quantity × road carrying distance × kg-km rate plus detour gives the quoted proceeds',()=>{
  assert.deepEqual(calculateProceeds(fare),{grossMinor:1760000,shipmentChargeMinor:160000,detourChargeMinor:60000,
    transportMinor:255000,netMinor:1505000,eligible:false});
});
test('zero detour retains weight-distance carrying charge, base and handling',()=>{
  assert.equal(calculateProceeds({...fare,extraDistanceM:0,handlingMinor:5000}).transportMinor,200000);
});
test('fractional road distance rounds the final carrying and detour components once',()=>{
  const r=calculateProceeds({...fare,routeCarryDistanceM:100123.4,extraDistanceM:6123.4});
  assert.equal(r.shipmentChargeMinor,160197);assert.equal(r.detourChargeMinor,61234);assert.equal(r.transportMinor,256431);
});
test('doubling quantity doubles only carrying charge; detour and fixed charges stay unchanged',()=>{
  const small=calculateProceeds({...fare,quantityKg:40}),large=calculateProceeds(fare);
  assert.equal(large.shipmentChargeMinor,small.shipmentChargeMinor*2);
  assert.equal(large.detourChargeMinor,small.detourChargeMinor);
  assert.equal(large.transportMinor-small.transportMinor,small.shipmentChargeMinor);
});
test('doubling carrying distance doubles only carrying charge',()=>{
  const r=calculateProceeds({...fare,routeCarryDistanceM:200000});
  assert.equal(r.shipmentChargeMinor,320000);assert.equal(r.detourChargeMinor,60000);
});
test('quantity can make net negative without concealing the transport cost',()=>{
  const r=calculateProceeds({...fare,quantityKg:1});
  assert.equal(r.shipmentChargeMinor,2000);assert.equal(r.transportMinor,97000);assert.equal(r.netMinor,-75000);
});
test('legacy rates/versions, invalid distances, zero/fractional quantity and unsafe amounts fail',()=>{
  for(const patch of [{extraDistanceM:-1},{routeCarryDistanceM:Infinity},{routeCarryDistanceM:NaN},
    {ratePerKgKmMinor:undefined},{pricingVersion:'detour-v0'},{pricingVersion:'hybrid-v1'},
    {quantityKg:1.5},{quantityKg:0},{pricePerKgMinor:Number.MAX_SAFE_INTEGER},
    {ratePerKgKmMinor:Number.MAX_SAFE_INTEGER},{baseMinor:Number.MAX_SAFE_INTEGER}]){
    assert.throws(()=>calculateProceeds({...fare,...patch} as typeof fare));
  }
  const {ratePerKgKmMinor,...withoutRate}=fare;
  assert.throws(()=>calculateProceeds({...withoutRate,shipmentPerKmMinor:ratePerKgKmMinor} as unknown as typeof fare));
});
