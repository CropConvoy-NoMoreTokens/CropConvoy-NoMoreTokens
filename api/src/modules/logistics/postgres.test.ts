import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createPostgresLogisticsRepository} from './repository.js';
import {createLogisticsService} from './service.js';
import {setup} from './test-fixtures.js';
import type {Database} from '../../core/dependencies.js';

// Opt-in only: creates/drops its own randomly named schema, never application tables.
test('PostgreSQL stores routes/quotes across connections and rejects corrupted quotes',
  {skip:!process.env.LOGISTICS_TEST_DATABASE_URL},async()=>{
  const url=process.env.LOGISTICS_TEST_DATABASE_URL!;
  const admin=new Pool({connectionString:url});
  const schema='logistics_test_'+randomUUID().replaceAll('-','');
  await admin.query('CREATE SCHEMA '+schema);
  let pool=new Pool({connectionString:url,options:'-c search_path='+schema});
  const db=():Database=>({async query(sql,values){return pool.query(sql,values);},
    async ping(){await pool.query('SELECT 1');},async close(){await pool.end();}});
  try {
    await pool.query(await readFile(new URL('../../../db/migrations/001_initial.sql',import.meta.url),'utf8'));
    await pool.query(await readFile(new URL('./integration.sql',import.meta.url),'utf8'));
    const s=setup();
    await pool.query(`INSERT INTO listings
      (id,demo_farmer_id,crop,quantity_kg,pickup_lat,pickup_lng,ready_at,min_net_minor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.listing.id,s.listing.demoFarmerId,s.listing.crop,s.listing.quantityKg,s.listing.pickup.lat,
       s.listing.pickup.lng,s.listing.readyAt,s.listing.minNetMinor]);
    await pool.query(`INSERT INTO orders
      (id,demo_buyer_id,crop,remaining_kg,price_per_kg_minor,delivery_lat,delivery_lng,deadline_at,allows_partial)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [s.order.id,s.order.demoBuyerId,s.order.crop,s.order.remainingKg,s.order.pricePerKgMinor,
       s.order.delivery.lat,s.order.delivery.lng,s.order.deadlineAt,s.order.allowsPartial]);
    let repository=createPostgresLogisticsRepository(db());
    await repository.saveTrip(s.trip);
    assert.deepEqual((await repository.listTrips())[0].routeGeoJSON,s.trip.routeGeoJSON);
    assert.equal((await repository.getListing(s.listing.id)).quantityKg,80);
    assert.equal((await repository.getOrder(s.order.id)).pricePerKgMinor,22000);
    const service=createLogisticsService(s.deps,{repository});
    const result=await service.evaluate(s.market,new AbortController().signal);
    assert.equal(result.options.length,1);
    const first=await service.getQuote(result.options[0].quoteId);
    await pool.end(); // Fresh connection/repository must read persistent storage.
    pool=new Pool({connectionString:url,options:'-c search_path='+schema});
    repository=createPostgresLogisticsRepository(db());
    assert.deepEqual(await repository.getQuote(first.quoteId),first);
    await pool.query(`UPDATE logistics_quotes SET snapshot=jsonb_set(snapshot,'{transportMinor}','1') WHERE id=$1`,[first.quoteId]);
    await assert.rejects(repository.getQuote(first.quoteId),/amounts or ID/);
    await assert.rejects(pool.query('UPDATE trips SET shipment_per_km_minor=NULL WHERE id=$1',[s.trip.id]),/hybrid_trip_requires_shipment_rate/);
  }finally {
    await pool.end();
    await admin.query('DROP SCHEMA '+schema+' CASCADE');
    await admin.end();
  }
});
