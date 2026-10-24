import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLogisticsService} from './service.js';
import {setup} from './test-fixtures.js';
import {RoutingError} from './routing.js';
import {checkRoad} from './feasibility.js';

test('registration stores full road geometry and both rates; no fake route on failure',async()=>{
  const s=setup(),service=createLogisticsService(s.deps,{repository:s.repository});
  const {id,status,createdAt,routeGeoJSON,routeDistanceM,routeDurationS,routeProvider,routeProfile,...input}=s.trip;
  const saved=await service.createTrip(input);
  assert.notEqual(saved.id,id);assert.deepEqual(saved.routeGeoJSON,routeGeoJSON);assert.equal(saved.ratePerKgKmMinor,20);
  assert.equal((await service.listTrips()).length,2);
  s.deps.routing.route=async()=>{throw new RoutingError('NO_ROAD_ROUTE','No route');};
  await assert.rejects(service.createTrip(input),/No route/);
  assert.equal((await service.listTrips()).length,2);
});
test('evaluation saves a weight-distance snapshot, returns it to workflow and handles quote expiry',async()=>{
  const s=setup(),service=createLogisticsService(s.deps,{repository:s.repository});
  const signal=new AbortController().signal;
  const result=await service.evaluate(s.market,signal);
  assert.equal(result.options.length,1);
  const q=await service.getQuote(result.options[0].quoteId);
  assert.equal(q.detourChargeMinor,60000);assert.ok(q.shipmentChargeMinor>20000);
  assert.equal(q.pricingVersion,'weight-distance-v2');
  assert.equal(q.ratePerKgKmMinor,20);
  assert.equal(q.shipmentChargeMinor,Math.round(s.listing.quantityKg*q.routeCarryDistanceM/1000*q.ratePerKgKmMinor));
  assert.equal(q.transportMinor,35000+q.shipmentChargeMinor+q.detourChargeMinor);
  assert.equal(q.netMinor,1760000-q.transportMinor);
  assert.deepEqual(q.baseGeometry,s.trip.routeGeoJSON);
  assert.equal(q.ruleOutcomes.capacity,true);
  assert.equal(service.getRunDiagnostics(signal).mode,'deterministic_fallback');
  assert.equal(service.getRunDiagnostics(signal).searchComplete,true);
  // A second service retrieves the repository-backed quote, not a service-local Map.
  const restarted=createLogisticsService(s.deps,{repository:s.repository});
  assert.deepEqual(await restarted.getQuote(q.quoteId),q);
  s.setNow(new Date(Date.parse(q.expiresAt)+1));
  await assert.rejects(restarted.getQuote(q.quoteId),/new transport quote/);
});
test('invalid capacity/direction/proximity are rejected before road API calls',async()=>{
  for(const code of ['INSUFFICIENT_CAPACITY','WRONG_DIRECTION','PICKUP_TOO_FAR']){
    const s=setup();
    if(code==='INSUFFICIENT_CAPACITY')s.trips.get(s.trip.id)!.availableKg=50;
    if(code==='WRONG_DIRECTION')[s.listing.pickup,s.order.delivery]=[s.order.delivery,s.listing.pickup];
    if(code==='PICKUP_TOO_FAR')s.listing.pickup.lat=8;
    const r=await createLogisticsService(s.deps,{repository:s.repository}).evaluate(s.market,new AbortController().signal);
    assert.equal(r.options.length,0);assert.ok(r.rejections.some(r=>r.codes.includes(code)));assert.equal(s.routingCalls(),0);
  }
});
test('road checks reject detour, time, readiness, deadline and bad snapping',async()=>{
  const cases=['DETOUR_TOO_LARGE','EXTRA_TIME_TOO_LARGE','PRODUCE_NOT_READY','DELIVERY_TOO_LATE','SNAP_TOO_FAR'];
  for(const code of cases){
    const s=setup(),t=s.trips.get(s.trip.id)!;
    if(code==='DETOUR_TOO_LARGE')t.maxExtraDistanceM=100;
    if(code==='EXTRA_TIME_TOO_LARGE')t.maxExtraTimeS=100;
    if(code==='PRODUCE_NOT_READY')s.listing.readyAt='2026-10-24T03:00:00Z';
    if(code==='DELIVERY_TOO_LATE')s.order.deadlineAt='2026-10-24T01:30:00Z';
    if(code==='SNAP_TOO_FAR'){
      const original=s.deps.routing.route;
      s.deps.routing.route=async(p,signal)=>{const r=await original(p,signal);r.snappedPoints=r.snappedPoints.map(x=>({...x,lat:x.lat+0.1}));return r;};
    }
    const r=await createLogisticsService(s.deps,{repository:s.repository}).evaluate(s.market,new AbortController().signal);
    assert.equal(r.options.length,0);assert.ok(r.rejections.some(r=>r.codes.includes(code)),code);
  }
});
test('provider failures are distinguishable from a completed no-match search',async()=>{
  const s=setup();s.deps.routing.route=async()=>{throw new RoutingError('ROUTING_UNAVAILABLE','offline',true);};
  const service=createLogisticsService(s.deps,{repository:s.repository}),signal=new AbortController().signal;
  const r=await service.evaluate(s.market,signal);
  assert.equal(r.options.length,0);assert.ok(r.rejections.some(r=>r.codes.includes('ROUTING_UNAVAILABLE')));
  assert.equal(service.getRunDiagnostics(signal).searchComplete,false);
});
test('routing budget is six in total, cached across alternative attempts',async()=>{
  const s=setup();
  for(let i=0;i<9;i++){const t={...structuredClone(s.trip),id:randomUUID()};s.trips.set(t.id,t);}
  const service=createLogisticsService(s.deps,{repository:s.repository}),signal=new AbortController().signal;
  const a=await service.evaluate(s.market,signal),b=await service.evaluate(s.market,signal);
  assert.equal(a.options.length,6);assert.equal(b.options.length,6);assert.equal(s.routingCalls(),6);
  assert.equal(service.getRunDiagnostics(signal).searchComplete,false);
});
test('live agent can only request allowed candidate tools and cannot author monetary values',async()=>{
  const s=setup();let turns=0;
  s.deps.llm.complete=async request=>{
    turns++;
    if(turns===1)return {toolCalls:[{name:'evaluateTrips',arguments:{candidates:[{orderId:s.order.id,tripId:s.trip.id}]}}]};
    const result=(request.input as {toolResults:Array<{result:{quotes:Array<{quoteId:string}>}}>}).toolResults[0].result;
    return {quoteIds:result.quotes.map(q=>q.quoteId),explanation:'Validated road option is available; pending approvals.'};
  };
  const service=createLogisticsService(s.deps,{repository:s.repository}),signal=new AbortController().signal;
  const r=await service.evaluate(s.market,signal);
  assert.equal(r.options.length,1);assert.equal(turns,2);assert.equal(service.getRunDiagnostics(signal).mode,'live');
  await service.evaluate(s.market,signal);assert.equal(turns,2);
});
test('unknown AI candidate falls back safely without routing invented IDs',async()=>{
  const s=setup();
  s.deps.llm.complete=async()=>({toolCalls:[{name:'evaluateTrips',arguments:{candidates:[{orderId:randomUUID(),tripId:randomUUID()}]}}]});
  const service=createLogisticsService(s.deps,{repository:s.repository}),signal=new AbortController().signal;
  const r=await service.evaluate(s.market,signal);
  assert.equal(r.options.length,1);assert.equal(s.routingCalls(),1);assert.equal(service.getRunDiagnostics(signal).mode,'deterministic_fallback');
});
test('deadline returns saved partial results when an adapter ignores cancellation',async()=>{
  const s=setup();const second={...structuredClone(s.trip),id:randomUUID()};s.trips.set(second.id,second);
  s.deps.maxPlanMs=40;
  const original=s.deps.routing.route;let calls=0;
  s.deps.routing.route=async(p,signal)=>{if(++calls>1)return new Promise(()=>{});return original(p,signal);};
  const service=createLogisticsService(s.deps,{repository:s.repository}),signal=new AbortController().signal;
  const keepAlive=setTimeout(()=>{},300);
  try {
    const r=await service.evaluate(s.market,signal);
    assert.equal(r.options.length,1);assert.equal(s.quotes.size,1);assert.equal(service.getRunDiagnostics(signal).searchComplete,false);
  }finally{clearTimeout(keepAlive);}
});
test('readiness and delivery use route legs plus loading/unloading time',async()=>{
  const s=setup();const r=await s.deps.routing.route([s.trip.start,s.listing.pickup,s.order.delivery,s.trip.end],new AbortController().signal);
  const valid=checkRoad(s.listing,s.order,s.trip,r);
  assert.equal(valid.pickupAt,'2026-10-24T01:20:00.000Z');
  assert.equal(valid.deliveryAt,'2026-10-24T02:00:00.000Z');assert.equal(valid.extraTimeS,1500);
});
