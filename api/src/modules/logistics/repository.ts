import { z } from 'zod';
import type { Database } from '../../core/dependencies.js';
import type { Listing, Order } from '../../core/contracts.js';
import { ApiError } from '../../core/errors.js';
import { weightDistanceTripSchema, weightDistanceQuoteSchema, listingSchema, orderSchema, type WeightDistanceTrip, type WeightDistanceQuote } from './contracts.js';
import { calculateProceeds } from './pricing.js';

export interface LogisticsRepository {
  listTrips():Promise<WeightDistanceTrip[]>;
  saveTrip(trip:WeightDistanceTrip):Promise<void>;
  getListing(id:string):Promise<Listing>;
  getOrder(id:string):Promise<Order>;
  saveQuote(quote:WeightDistanceQuote):Promise<void>;
  getQuote(id:string):Promise<WeightDistanceQuote>;
}
function numeric(v:unknown):number {
  if(typeof v==='string' && !/^-?\d+(\.\d+)?$/.test(v)) throw new Error('Invalid stored numeric value');
  const n=typeof v==='number'?v:typeof v==='string'?Number(v):NaN;
  if(!Number.isFinite(n)) throw new Error('Invalid stored numeric value');
  return n;
}
function iso(v:unknown):string {
  const d=v instanceof Date?v:new Date(String(v));
  if(!Number.isFinite(d.getTime())) throw new Error('Invalid stored timestamp');
  return d.toISOString();
}
function object(v:unknown):Record<string,unknown> {return z.record(z.string(),z.unknown()).parse(v);}
function point(r:Record<string,unknown>, prefix:string) {return {lat:numeric(r[prefix+'_lat']),lng:numeric(r[prefix+'_lng'])};}
function tripFromRow(r:Record<string,unknown>):WeightDistanceTrip {
  return weightDistanceTripSchema.parse({
    id:r.id,demoTransporterId:r.demo_transporter_id,start:point(r,'start'),end:point(r,'end'),
    departureAt:iso(r.departure_at),availableKg:numeric(r.available_kg),corridorM:numeric(r.corridor_m),
    maxExtraDistanceM:numeric(r.max_extra_distance_m),maxExtraTimeS:numeric(r.max_extra_time_s),
    baseMinor:numeric(r.base_minor),perKmMinor:numeric(r.per_km_minor),handlingMinor:numeric(r.handling_minor),
    ratePerKgKmMinor:numeric(r.rate_per_kg_km_minor),pricingVersion:r.pricing_version,
    status:r.status,createdAt:iso(r.created_at),routeGeoJSON:r.route_geojson,
    routeDistanceM:numeric(r.route_distance_m),routeDurationS:numeric(r.route_duration_s),
    routeProvider:r.route_provider,routeProfile:r.route_profile,
  });
}
export function createPostgresLogisticsRepository(db:Database):LogisticsRepository {
  async function record(sql:string,id:string) {
    const {rows}=await db.query(sql,[id]);
    if(!rows[0]) throw new ApiError(404,'NOT_FOUND','Logistics source record not found');
    return object(rows[0].record);
  }
  return {
    async listTrips() {
      const {rows}=await db.query("SELECT to_jsonb(t) AS record FROM trips t WHERE status='open' AND pricing_version='weight-distance-v2' ORDER BY departure_at, id LIMIT 101");
      return rows.map(row=>tripFromRow(object(row.record)));
    },
    async saveTrip(t) {
      weightDistanceTripSchema.parse(t);
      await db.query(`INSERT INTO trips
        (id,demo_transporter_id,start_lat,start_lng,end_lat,end_lng,departure_at,available_kg,
         route_geojson,route_distance_m,route_duration_s,route_provider,route_profile,corridor_m,
         max_extra_distance_m,max_extra_time_s,base_minor,per_km_minor,handling_minor,
         rate_per_kg_km_minor,pricing_version,status,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [t.id,t.demoTransporterId,t.start.lat,t.start.lng,t.end.lat,t.end.lng,t.departureAt,t.availableKg,
         JSON.stringify(t.routeGeoJSON),t.routeDistanceM,t.routeDurationS,t.routeProvider,t.routeProfile,t.corridorM,
         t.maxExtraDistanceM,t.maxExtraTimeS,t.baseMinor,t.perKmMinor,t.handlingMinor,
         t.ratePerKgKmMinor,t.pricingVersion,t.status,t.createdAt]);
    },
    async getListing(id) {
      const r=await record('SELECT to_jsonb(l) AS record FROM listings l WHERE id=$1',id);
      if(r.status!=='open') throw new ApiError(409,'SOURCE_NOT_OPEN','Listing is no longer open');
      return listingSchema.parse({id:r.id,demoFarmerId:r.demo_farmer_id,crop:r.crop,quantityKg:numeric(r.quantity_kg),
        pickup:point(r,'pickup'),readyAt:iso(r.ready_at),minNetMinor:numeric(r.min_net_minor),
        confirmed:r.seller_declared,status:r.status,createdAt:iso(r.created_at)});
    },
    async getOrder(id) {
      const r=await record('SELECT to_jsonb(o) AS record FROM orders o WHERE id=$1',id);
      if(r.status!=='open') throw new ApiError(409,'SOURCE_NOT_OPEN','Buyer order is no longer open');
      return orderSchema.parse({id:r.id,demoBuyerId:r.demo_buyer_id,crop:r.crop,remainingKg:numeric(r.remaining_kg),
        pricePerKgMinor:numeric(r.price_per_kg_minor),delivery:point(r,'delivery'),deadlineAt:iso(r.deadline_at),
        allowsPartial:r.allows_partial,status:r.status,createdAt:iso(r.created_at)});
    },
    async saveQuote(q) {
      weightDistanceQuoteSchema.parse(q);
      await db.query(`INSERT INTO logistics_quotes (id,listing_id,order_id,trip_id,snapshot,generated_at,expires_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [q.quoteId,q.listingId,q.orderId,q.tripId,JSON.stringify(q),q.generatedAt,q.expiresAt]);
    },
    async getQuote(id) {
      const {rows}=await db.query('SELECT snapshot FROM logistics_quotes WHERE id=$1',[id]);
      if(!rows[0]) throw new ApiError(404,'NOT_FOUND','Validated logistics quote not found');
      if((rows[0].snapshot as {pricingVersion?:unknown}|null)?.pricingVersion!=='weight-distance-v2') {
        throw new ApiError(409,'PRICING_VERSION_CHANGED','This quote uses an older tariff; generate a new quote');
      }
      const q=weightDistanceQuoteSchema.parse(rows[0].snapshot);
      const amounts=calculateProceeds({...{
        quantityKg:q.quantityKg,pricePerKgMinor:q.pricePerKgMinor,baseMinor:q.baseMinor,handlingMinor:q.handlingMinor,
        minNetMinor:0,extraDistanceM:q.extraDistanceM,perKmMinor:q.perKmMinor,routeCarryDistanceM:q.routeCarryDistanceM,
        ratePerKgKmMinor:q.ratePerKgKmMinor,pricingVersion:q.pricingVersion,
      }});
      if(q.quoteId!==id || ['grossMinor','transportMinor','netMinor','shipmentChargeMinor','detourChargeMinor']
        .some(k=>q[k as keyof WeightDistanceQuote]!==amounts[k as keyof typeof amounts])) {
        throw new ApiError(503,'INVALID_STORED_QUOTE','Stored quote amounts or ID do not match its inputs');
      }
      return q;
    },
  };
}
