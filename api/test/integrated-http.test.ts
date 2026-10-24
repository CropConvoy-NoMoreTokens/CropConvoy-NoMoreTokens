import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import type {AddressInfo} from 'node:net';
import {createMarketRepository} from '../src/modules/market/repository.js';
import {createApp} from '../src/app.js';
import {setup} from '../src/modules/logistics/test-fixtures.js';
import {demoUsers} from '../src/core/auth.js';
import {demoAuthHeaders,loginDemoAccounts,seedDemoAccounts} from './fixtures/demo-auth.js';

test('real modules integrate over HTTP: persist sources, route, quote, review, accept and reload',
  {skip:!process.env.LOGISTICS_TEST_DATABASE_URL},async()=>{
  const url=process.env.LOGISTICS_TEST_DATABASE_URL!;
  const admin=new Pool({connectionString:url});
  const schema='integrated_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE SCHEMA '+schema);
  const pool=new Pool({connectionString:url,options:'-c search_path='+schema});
  const fixture=setup();
  const deps={...fixture.deps,db:{async query(sql:string,values?:unknown[]){return pool.query(sql,values);},
    async ping(){await pool.query('SELECT 1');},async close(){}}};
  let server=createApp(deps,['http://localhost:5173']).listen(0,'127.0.0.1');
  try{
    await pool.query(await readFile(new URL('../db/migrations/001_initial.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('../db/migrations/002_demo_auth.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('../db/migrations/002_weight_distance_logistics.sql',import.meta.url),'utf8'));
    await seedDemoAccounts(pool);
    await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve));
    let base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
    const tokens=await loginDemoAccounts(base,pool);
    const post=async(path:string,body:unknown)=>{
      const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...demoAuthHeaders(tokens,path)},body:JSON.stringify(body)});
      const payload=await r.json();assert.ok(r.ok,JSON.stringify(payload));return payload;
    };
    const {id:_l,status:_ls,createdAt:_lc,...listingInput}=fixture.listing;
    const {id:_o,status:_os,createdAt:_oc,...orderInput}=fixture.order;
    const {id:_t,status:_ts,createdAt:_tc,routeGeoJSON:_g,routeDistanceM:_d,routeDurationS:_s,
      routeProvider:_p,routeProfile:_r,...tripInput}=fixture.trip;
    const listing=(await post('/api/listings',{...listingInput,demoFarmerId:demoUsers[0].id})).data;
    await post('/api/orders',{...orderInput,demoBuyerId:demoUsers[1].id});
    const trip=(await post('/api/trips',{...tripInput,demoTransporterId:demoUsers[2].id})).data;
    assert.ok(trip.routeGeoJSON.coordinates.length>=2);
    const generated=await post('/api/plans/generate',{listingId:listing.id});
    assert.equal(generated.data.outcome,'proposed',JSON.stringify(generated));
    assert.equal(generated.meta.mode,'deterministic_fallback'); // Deliberately no live model in this test.
    const plan=generated.data.plan,q=plan.quoteSnapshot;
    assert.equal(q.pricingVersion,'weight-distance-v2');
    assert.equal(q.shipmentChargeMinor,Math.round(q.quantityKg*q.routeCarryDistanceM/1000*q.ratePerKgKmMinor));
    assert.equal(q.transportMinor,q.baseMinor+q.shipmentChargeMinor+q.detourChargeMinor+q.handlingMinor);
    assert.equal(q.ruleOutcomes.pickupBeforeDelivery,true);
    assert.equal((await post('/api/plans/'+plan.id+'/decision',{decision:'accept'})).data.status,
      'farmer_accepted_pending_confirmations');
    await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    server=createApp(deps,['http://localhost:5173']).listen(0,'127.0.0.1');
    await new Promise<void>(resolve=>server.once('listening',resolve));
    base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
    const harvestsResponse=await fetch(base+'/api/listings?demoFarmerId='+demoUsers[0].id,{headers:demoAuthHeaders(tokens,'/api/listings')});
    assert.equal(harvestsResponse.status,200);
    assert.deepEqual((await harvestsResponse.json()).data.map((row:{id:string})=>row.id),[listing.id]);
    const otherFarmerId=randomUUID();
    const foreignListing=await createMarketRepository(deps).createListing({...listingInput,demoFarmerId:otherFarmerId});
    for (const suffix of ['', '?demoFarmerId='+otherFarmerId, '?demoFarmerId=invalid']) {
      const response=await fetch(base+'/api/listings'+suffix,{headers:demoAuthHeaders(tokens,'/api/listings')});
      assert.equal(response.status,200);
      const rows=(await response.json()).data;
      assert.deepEqual(rows.map((row:{id:string})=>row.id),[listing.id]);
      assert.ok(!rows.some((row:{id:string})=>row.id===foreignListing.id));
    }
    assert.equal((await fetch(base+'/api/listings')).status,401);
    assert.equal((await fetch(base+'/api/listings',{headers:demoAuthHeaders(tokens,'/api/orders')})).status,403);
    const persistedResponse=await fetch(base+'/api/plans/'+plan.id,{headers:demoAuthHeaders(tokens,'/api/plans/'+plan.id)});
    assert.equal(persistedResponse.status,200);
    const persisted=await persistedResponse.json();
    assert.equal(persisted.data.status,'farmer_accepted_pending_confirmations');
    assert.equal(persisted.data.quoteSnapshot.transportMinor,q.transportMinor);
    assert.equal((await post('/api/plans/'+plan.id+'/decision',{decision:'accept'})).data.status,
      'farmer_accepted_pending_confirmations');
    const r=await fetch(base+'/api/plans/'+plan.id+'/decision',{method:'POST',headers:{'Content-Type':'application/json',...demoAuthHeaders(tokens,'/api/plans')},body:JSON.stringify({decision:'reject'})});
    assert.equal(r.status,409);
  }finally{
    if(server.listening)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
  }
});
