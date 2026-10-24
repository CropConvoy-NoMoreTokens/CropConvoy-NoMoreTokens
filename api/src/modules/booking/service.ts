import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Database, Dependencies } from '../../core/dependencies.js';
import type { AuthUser } from '../../core/auth.js';
import { ApiError } from '../../core/errors.js';
import { createMarketRepository } from '../market/repository.js';
import { createPostgresLogisticsRepository } from '../logistics/repository.js';
import { decode } from '../workflow/repository.js';
import { sourceRejectionCodes } from '../workflow/validation.js';
import type { Plan } from '../../core/contracts.js';

export const historyQuery = z.object({ listingId: z.uuid().optional(), status: z.enum(['pending','history','all']).default('all'), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(500).optional() });
const cursorSchema = z.object({ at: z.iso.datetime(), id: z.uuid() });
const pending = 'farmer_accepted_pending_confirmations';
const mutable = ['proposed', pending];
const fail = (message: string) => new ApiError(409, 'PLAN_CONFLICT', message);
const deadline = (p: any) => Math.min(Date.parse(p.expires_at), Date.parse(p.quote_snapshot.expiresAt ?? p.expires_at), Date.parse(p.review.booking?.approvalExpiresAt ?? p.expires_at), Date.parse(p.quote_snapshot.pickupAt ?? p.expires_at));
const effective = (p: any, now: number) => mutable.includes(p.status) && deadline(p) <= now ? 'expired' : p.status;

export function createBookingService(deps: Dependencies) {
  async function owned(db: Database, id: string, user: AuthUser) {
    const {rows} = await db.query(`SELECT p.*, l.demo_farmer_id, o.demo_buyer_id, t.demo_transporter_id FROM plans p JOIN listings l ON l.id=p.listing_id JOIN orders o ON o.id=p.order_id JOIN trips t ON t.id=p.trip_id WHERE p.id=$1`, [id]);
    const p = rows[0];
    if (!p || (user.role==='farmer' ? p.demo_farmer_id : user.role==='buyer' ? p.demo_buyer_id : p.demo_transporter_id) !== user.id || (user.role!=='farmer' && ['proposed','rejected','superseded'].includes(p.status))) throw new ApiError(404,'NOT_FOUND','Proposal not found');
    return p;
  }
  function summary(p: any, user: AuthUser, now: number) {
    const q=p.quote_snapshot, sources=p.review.sourceSnapshot;
    return { id:p.id, listingId:p.listing_id, orderId:p.order_id, tripId:p.trip_id, quantityKg:p.quantity_kg,
      status:effective(p,now), createdAt:new Date(p.created_at).toISOString(), expiresAt:new Date(p.expires_at).toISOString(),
      booking:p.review.booking ?? (p.status===pending ? {buyer:'pending',driver:'pending',approvalExpiresAt:new Date(p.expires_at).toISOString()} : null),
      crop:sources?.listing?.crop ?? 'produce', pickup:sources?.listing?.pickup, delivery:sources?.order?.delivery,
      pickupAt:q.pickupAt, deliveryAt:q.deliveryAt, pricePerKgMinor:q.pricePerKgMinor, grossMinor:q.grossMinor, transportMinor:q.transportMinor,
      ...(user.role==='farmer' ? {netMinor:q.netMinor} : {}),
      ...(user.role==='transporter' ? { baseGeometry:q.baseGeometry, modifiedGeometry:q.modifiedGeometry, baseMinor:q.baseMinor, shipmentChargeMinor:q.shipmentChargeMinor, detourChargeMinor:q.detourChargeMinor, handlingMinor:q.handlingMinor, routeCarryDistanceM:q.routeCarryDistanceM, ratePerKgKmMinor:q.ratePerKgKmMinor, extraDistanceM:q.extraDistanceM } : {}),
      legacy:q.pricingVersion!=='weight-distance-v2' };
  }
  async function list(user: AuthUser, input: z.infer<typeof historyQuery>) {
    if (deps.persistence!=='postgres') throw new ApiError(503,'PERSISTENCE_REQUIRED','Proposal history requires PostgreSQL');
    const values: unknown[]=[user.id];
    const filters=[` ${user.role==='farmer'?'l.demo_farmer_id':user.role==='buyer'?'o.demo_buyer_id':'t.demo_transporter_id'}=$1`];
    if(user.role!=='farmer') filters.push("p.status NOT IN ('proposed','rejected','superseded')");
    if(input.listingId) { values.push(input.listingId); filters.push(`p.listing_id=$${values.length}`); }
    // Include the quote deadline when computing effective expiry in list/count filters.
    const alive=`LEAST(p.expires_at,COALESCE((p.quote_snapshot->>'expiresAt')::timestamptz,p.expires_at),COALESCE((p.review->'booking'->>'approvalExpiresAt')::timestamptz,p.expires_at)) > $${values.length+1}::timestamptz`;
    values.push(deps.clock.now().toISOString());
    filters.push(`$${values.length}::timestamptz IS NOT NULL`);
    const actorPending=user.role==='farmer'?'true':`COALESCE(p.review->'booking'->>'${user.role==='buyer'?'buyer':'driver'}','pending')='pending'`;
    const pendingFilter=`p.status='${pending}' AND ${alive} AND ${actorPending}`;
    const joins='FROM plans p JOIN listings l ON l.id=p.listing_id JOIN orders o ON o.id=p.order_id JOIN trips t ON t.id=p.trip_id';
    const count=await deps.db.query(`SELECT count(*)::int AS count ${joins} WHERE ${filters.join(' AND ')} AND ${pendingFilter}`,values);
    if(input.status==='pending') filters.push(pendingFilter);
    if(input.status==='history') filters.push(`NOT (${pendingFilter})`);
    if(input.cursor) {
      let cursor; try { cursor=cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,'base64url').toString())); } catch {throw new ApiError(422,'VALIDATION_ERROR','Invalid history cursor');}
      values.push(cursor.at,cursor.id); filters.push(`(p.created_at,p.id)<($${values.length-1}::timestamptz,$${values.length}::uuid)`);
    }
    values.push(input.limit+1);
    const {rows}=await deps.db.query(`SELECT p.* ${joins} WHERE ${filters.join(' AND ')} ORDER BY p.created_at DESC,p.id DESC LIMIT $${values.length}`,values);
    const items=rows.slice(0,input.limit), last=items.at(-1);
    return {items:items.map(p=>summary(p,user,deps.clock.now().getTime())),pendingCount:count.rows[0].count,
      nextCursor:rows.length>input.limit && last ? Buffer.from(JSON.stringify({at:new Date(last.created_at).toISOString(),id:last.id})).toString('base64url'):null};
  }
  async function mutate(id: string, user: AuthUser, decision: 'accept'|'reject'|'approve') {
    if(!deps.db.transaction) throw new ApiError(503,'TRANSACTION_REQUIRED','Booking decisions require transactional PostgreSQL');
    const outcome=await deps.db.transaction(async db=>{
      // A single transaction-level lock serializes booking writes in this small prototype.
      // All resource writes happen on this same checked-out client; no provider calls occur here.
      await db.query('SELECT pg_advisory_xact_lock(26102402)');
      const p=await owned(db,id,user);
      for(const [table,ref] of [['listings',p.listing_id],['orders',p.order_id],['trips',p.trip_id],['plans',id]]) await db.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`,[ref]);
      const now=deps.clock.now(), at=now.toISOString();
      const update=async(status:string,booking=p.review.booking)=>{
        await db.query('UPDATE plans SET status=$2,review=$3::jsonb WHERE id=$1',[id,status,JSON.stringify({...p.review,...(booking?{booking}:{})})]);
        return (await db.query('SELECT * FROM plans WHERE id=$1',[id])).rows[0];
      };
      const conflict=async(status:string,reason:string)=>({row:await update(status,p.review.booking ? {...p.review.booking,resolutionCode:reason} : undefined),error:reason});
      const target=decision==='accept'?pending:'rejected';
      if(user.role==='farmer' && (p.status===target || (decision==='accept' && p.status==='confirmed'))) return {row:p};
      const side=user.role==='buyer'?'buyer':'driver';
      const value=decision==='approve'?'approved':'rejected';
      if(user.role!=='farmer' && p.review.booking?.[side]===value) return {row:p};
      if(user.role==='farmer' ? p.status!=='proposed' : p.status!==pending) throw fail('This proposal already has a final decision');
      if(user.role!=='farmer' && p.review.booking?.[side]!=='pending') throw fail('Your decision is already recorded');
      if(deadline(p)<=now.getTime()) return conflict('expired','APPROVAL_EXPIRED');
      if(user.role==='farmer' && decision==='reject') return {row:await update('rejected')};
      if(user.role!=='farmer' && decision==='accept') throw new ApiError(403,'FORBIDDEN','Invalid approval action');
      const booking=user.role==='farmer' ? {buyer:'pending',driver:'pending',farmerAcceptedAt:at,approvalExpiresAt:new Date(deadline(p)).toISOString()} : {...p.review.booking,[side]:value,[side+'DecidedAt']:at,[side+'DecidedBy']:user.id};
      if(user.role!=='farmer' && decision==='reject') return {row:await update('declined',booking)};
      const scoped={...deps,db}, market=createMarketRepository(scoped), logistics=createPostgresLogisticsRepository(db);
      let current;
      try { current={listing:await market.getListing(p.listing_id),order:await logistics.getOrder(p.order_id),trip:(await logistics.listTrips()).find(t=>t.id===p.trip_id)}; } catch(error) { if(error instanceof ApiError && [404,409].includes(error.status)) return conflict('unavailable','SOURCE_OR_AVAILABILITY_CHANGED'); throw error; }
      const old=p.review.sourceSnapshot;
      const comparable=current.trip ? {...current,order:{...current.order,remainingKg:old.order.remainingKg},trip:{...current.trip,availableKg:old.trip.availableKg}} : null;
      const valid=comparable && current.listing.status==='open' && current.order.status==='open' && current.trip?.status==='open' && isDeepStrictEqual(comparable,old) && !sourceRejectionCodes(p.quote_snapshot,current as Plan['sourceSnapshot']).length;
      if(!valid) return conflict('unavailable','SOURCE_OR_AVAILABILITY_CHANGED');
      if(user.role==='farmer') {
        await db.query("UPDATE plans SET status='expired' WHERE listing_id=$1 AND status='farmer_accepted_pending_confirmations' AND expires_at <= $2",[p.listing_id,at]);
        const active=await db.query("SELECT id FROM plans WHERE listing_id=$1 AND status IN ('farmer_accepted_pending_confirmations','confirmed')",[p.listing_id]);
        if(active.rows.length) throw fail('Another proposal for this harvest is already accepted');
        await db.query("UPDATE plans SET status='superseded' WHERE listing_id=$1 AND id<>$2 AND status='proposed'",[p.listing_id,id]);
        return {row:await update(pending,booking)};
      }
      if(booking.buyer!=='approved' || booking.driver!=='approved') return {row:await update(pending,booking)};
      await db.query("UPDATE orders SET remaining_kg=remaining_kg-$2,status=CASE WHEN remaining_kg=$2 THEN 'closed' ELSE 'open' END WHERE id=$1",[p.order_id,p.quantity_kg]);
      await db.query("UPDATE trips SET available_kg=available_kg-$2,status='closed' WHERE id=$1",[p.trip_id,p.quantity_kg]);
      await db.query("UPDATE listings SET status='booked' WHERE id=$1",[p.listing_id]);
      await db.query("UPDATE plans SET status='unavailable' WHERE id<>$1 AND (listing_id=$2 OR trip_id=$3) AND status IN ('proposed','farmer_accepted_pending_confirmations')",[id,p.listing_id,p.trip_id]);
      return {row:await update('confirmed',{...booking,confirmedAt:at})};
    });
    if('error' in outcome && outcome.error) throw fail(outcome.error);
    return user.role==='farmer' ? {...decode(outcome.row),status:effective(outcome.row,deps.clock.now().getTime()) as Plan['status']} : summary(outcome.row,user,deps.clock.now().getTime());
  }
  return {list,mutate,async farmerPlan(id:string,user:AuthUser){const p=await owned(deps.db,id,user);return {...decode(p),status:effective(p,deps.clock.now().getTime()) as Plan['status']};},async detail(id:string,user:AuthUser){return summary(await owned(deps.db,id,user),user,deps.clock.now().getTime());}};
}
