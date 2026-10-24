import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {Pool} from 'pg';
import type {AddressInfo} from 'node:net';
import type {Database} from '../src/core/dependencies.js';
import {createApp} from '../src/app.js';
import {setup} from '../src/modules/logistics/test-fixtures.js';
import {demoUsers} from '../src/core/auth.js';
import {loginDemoAccounts,seedDemoAccounts} from './fixtures/demo-auth.js';

test('booking HTTP: authenticated history, approvals, atomic allocation, competing decisions and persistence', {skip:!process.env.LOGISTICS_TEST_DATABASE_URL}, async()=>{
  const admin=new Pool({connectionString:process.env.LOGISTICS_TEST_DATABASE_URL});
  const schema='booking_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE SCHEMA '+schema);
  const pool=new Pool({connectionString:process.env.LOGISTICS_TEST_DATABASE_URL,options:'-c search_path='+schema});
  const fixture=setup(); let now=fixture.deps.clock.now();
  const db:Database={query:(sql,values)=>pool.query(sql,values),async ping(){},async close(){},async transaction(work){
    const c=await pool.connect();try{await c.query('BEGIN');const value=await work({query:(sql,values)=>c.query(sql,values),async ping(){},async close(){}});await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }};
  const deps={...fixture.deps,db,clock:{now:()=>now}};
  let server=createApp(deps,['http://localhost:5173']).listen(0,'127.0.0.1');
  try{
    const directory=new URL('../db/migrations/',import.meta.url);
    for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort())await pool.query(await readFile(new URL(name,directory),'utf8'));
    await seedDemoAccounts(pool);
    await new Promise<void>(r=>server.listening?r():server.once('listening',r));
    let base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
    const tokens=await loginDemoAccounts(base,pool);
    const request=async(path:string,role:keyof typeof tokens='farmer',body?:unknown)=>{
      const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
      return {status:r.status,body:await r.json()};
    };
    const post=async(path:string,role:keyof typeof tokens,body:unknown)=>{const r=await request(path,role,body);assert.ok(r.status<300,JSON.stringify(r.body));return r.body.data;};
    const {id:_l,status:_ls,createdAt:_lc,...li}=fixture.listing;
    const {id:_o,status:_os,createdAt:_oc,...oi}=fixture.order;
    const {id:_t,status:_ts,createdAt:_tc,routeGeoJSON:_g,routeDistanceM:_d,routeDurationS:_s,routeProvider:_p,routeProfile:_r,...ti}=fixture.trip;
    const sources=async()=>{
      const order=await post('/api/orders','buyer',{...oi,demoBuyerId:demoUsers[1].id});
      const trip=await post('/api/trips','transporter',{...ti,demoTransporterId:demoUsers[2].id});
      return {order,trip};
    };
    const proposal=async()=>{
      const listing=await post('/api/listings','farmer',{...li,demoFarmerId:demoUsers[0].id});
      const generated=await post('/api/plans/generate','farmer',{listingId:listing.id});assert.equal(generated.outcome,'proposed');return generated.plan;
    };
    const source=await sources(); const p=await proposal();
    assert.equal((await request('/api/plans','buyer')).body.data.items.length,0);
    await post(`/api/plans/${p.id}/decision`,'farmer',{decision:'accept'});
    assert.equal((await request('/api/plans?listingId='+p.listingId)).body.data.items[0].id,p.id);
    const inbox=(await request('/api/plans?status=pending','buyer')).body.data;
    assert.equal(inbox.pendingCount,1);assert.equal(inbox.items[0].id,p.id);
    // A separate buyer cannot enumerate, read or approve this buyer's proposal.
    const otherId=randomUUID(),otherToken='Z'.repeat(43);
    await pool.query("INSERT INTO demo_users(id,username,role,password_hash) SELECT $1,'otherbuyer','buyer',password_hash FROM demo_users WHERE id=$2",[otherId,demoUsers[1].id]);
    await pool.query("INSERT INTO demo_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(otherToken).digest('hex'),otherId]);
    const otherHeaders={Authorization:'Bearer '+otherToken,'Content-Type':'application/json'};
    assert.equal((await (await fetch(base+'/api/plans',{headers:otherHeaders})).json()).data.items.length,0);
    assert.equal((await fetch(base+'/api/approvals/'+p.id,{headers:otherHeaders})).status,404);
    assert.equal((await fetch(base+`/api/plans/${p.id}/buyer-decision`,{method:'POST',headers:otherHeaders,body:JSON.stringify({decision:'approve'})})).status,404);
    const serialized=JSON.stringify(inbox);for(const secret of ['netMinor','minNetMinor','sourceSnapshot','trace'])assert.ok(!serialized.includes(secret));
    assert.equal((await request(`/api/plans/${p.id}/driver-decision`,'buyer',{decision:'approve'})).status,403);
    await post(`/api/plans/${p.id}/buyer-decision`,'buyer',{decision:'approve'});
    await post(`/api/plans/${p.id}/buyer-decision`,'buyer',{decision:'approve'});
    assert.equal((await request(`/api/plans/${p.id}/buyer-decision`,'buyer',{decision:'reject'})).status,409);
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1',[source.order.id])).rows[0].remaining_kg,source.order.remainingKg);
    const final=await Promise.all([request(`/api/plans/${p.id}/driver-decision`,'transporter',{decision:'approve'}),request(`/api/plans/${p.id}/driver-decision`,'transporter',{decision:'approve'})]);
    assert.ok(final.every(r=>r.status===200));assert.ok(final.every(r=>r.body.data.status==='confirmed'));
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1',[source.order.id])).rows[0].remaining_kg,source.order.remainingKg-p.quantityKg);
    assert.equal((await pool.query('SELECT available_kg,status FROM trips WHERE id=$1',[source.trip.id])).rows[0].status,'closed');
    assert.equal((await request('/api/trips','transporter')).body.data.find((t:any)=>t.id===source.trip.id).status,'closed');
    await new Promise<void>(r=>server.close(()=>r()));server=createApp(deps,[]).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
    assert.equal((await request('/api/plans?listingId='+p.listingId)).body.data.items[0].status,'confirmed');
    assert.equal((await request('/api/plans/'+p.id)).body.data.booking.buyer,'approved');

    // Two distinct harvests compete for the same single-shipment trip.
    const raceSources=await sources(),a=await proposal(),b=await proposal();
    assert.equal(a.tripId,raceSources.trip.id);assert.equal(b.tripId,raceSources.trip.id);
    for(const plan of [a,b]){await post(`/api/plans/${plan.id}/decision`,'farmer',{decision:'accept'});await post(`/api/plans/${plan.id}/buyer-decision`,'buyer',{decision:'approve'});}
    const race=await Promise.all([request(`/api/plans/${a.id}/driver-decision`,'transporter',{decision:'approve'}),request(`/api/plans/${b.id}/driver-decision`,'transporter',{decision:'approve'})]);
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM plans WHERE trip_id=$1 AND status='confirmed'",[raceSources.trip.id])).rows[0].n,1);

    await sources(); const decline=await proposal();await post(`/api/plans/${decline.id}/decision`,'farmer',{decision:'accept'});await post(`/api/plans/${decline.id}/driver-decision`,'transporter',{decision:'reject'});
    assert.equal((await request('/api/plans/'+decline.id)).body.data.status,'declined');
    const expiry=await proposal();await post(`/api/plans/${expiry.id}/decision`,'farmer',{decision:'accept'});
    now=new Date(Date.parse(expiry.expiresAt)+1000);
    assert.equal((await request(`/api/plans/${expiry.id}/buyer-decision`,'buyer',{decision:'approve'})).status,409);
    assert.equal((await request('/api/plans/'+expiry.id)).body.data.status,'expired');
    assert.equal((await request('/api/plans/'+p.id)).body.data.status,'confirmed');
    // Exact demand/capacity exhaustion and rollback after a mid-allocation failure.
    now=fixture.deps.clock.now();
    await pool.query("UPDATE orders SET status='closed'");await pool.query("UPDATE trips SET status='closed'");
    const zeroOrder=await post('/api/orders','buyer',{...oi,remainingKg:li.quantityKg,demoBuyerId:demoUsers[1].id});
    const zeroTrip=await post('/api/trips','transporter',{...ti,availableKg:li.quantityKg,demoTransporterId:demoUsers[2].id});
    const zero=await proposal();
    await post(`/api/plans/${zero.id}/decision`,'farmer',{decision:'accept'});
    await post(`/api/plans/${zero.id}/buyer-decision`,'buyer',{decision:'approve'});
    await pool.query("CREATE FUNCTION fail_allocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
    await pool.query("CREATE TRIGGER fail_allocation BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION fail_allocation()");
    assert.equal((await request(`/api/plans/${zero.id}/driver-decision`,'transporter',{decision:'approve'})).status,503);
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1',[zeroOrder.id])).rows[0].remaining_kg,li.quantityKg);
    assert.equal((await request('/api/plans/'+zero.id)).body.data.booking.driver,'pending');
    await pool.query('DROP TRIGGER fail_allocation ON trips');
    await post(`/api/plans/${zero.id}/driver-decision`,'transporter',{decision:'approve'});
    assert.equal((await pool.query('SELECT remaining_kg FROM orders WHERE id=$1',[zeroOrder.id])).rows[0].remaining_kg,0);
    assert.equal((await pool.query('SELECT available_kg FROM trips WHERE id=$1',[zeroTrip.id])).rows[0].available_kg,0);
    const history=await request('/api/plans?limit=1');assert.equal(history.body.data.items.length,1);assert.ok(history.body.data.nextCursor);
    assert.notEqual((await request('/api/plans?limit=1&cursor='+history.body.data.nextCursor)).body.data.items[0].id,history.body.data.items[0].id);
  }finally{if(server.listening)await new Promise<void>(r=>server.close(()=>r()));await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
