import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { LogisticsResult, MarketResult, TripInput, TraceEntry } from '../../core/contracts.js';
import { marketResultSchema, idSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError, pending } from '../../core/errors.js';
import { weightDistanceTripInputSchema, weightDistanceTripSchema, weightDistanceQuoteSchema, listingSchema, orderSchema,
  type WeightDistanceTrip, type WeightDistanceQuote } from './contracts.js';
import { createPostgresLogisticsRepository, type LogisticsRepository } from './repository.js';
import { assertSimpleRoute, checkCorridor, FeasibilityError } from './geometry.js';
import { checkRoad, checkShipment, defaultTiming, validateStops, type TimingPolicy } from './feasibility.js';
import { calculateProceeds } from './pricing.js';
import { RoutingError, validateRoute } from './routing.js';
import { abortable } from './async.js';
import { investigate, type Candidate } from './agent.js';

export type RunDiagnostics = {
  searchComplete:boolean; mode:'stub'|'live'|'deterministic_fallback';
  routedCombinations:number; trace:TraceEntry[];
};
export interface LogisticsService {
  listTrips():Promise<WeightDistanceTrip[]>;
  createTrip(input:TripInput):Promise<WeightDistanceTrip>;
  evaluate(market:MarketResult,signal:AbortSignal):Promise<LogisticsResult>;
  getQuote(quoteId:string):Promise<WeightDistanceQuote>;
}
export interface InstrumentedLogisticsService extends LogisticsService {
  /** Additive handoff: P4 should copy this into GenerationResult's existing trace/completion fields. */
  getRunDiagnostics(signal:AbortSignal):RunDiagnostics;
}
export type LogisticsOptions = {
  repository?:LogisticsRepository; timing?:Partial<TimingPolicy>;
  quoteTtlMs?:number; routingTimeoutMs?:number; modelTimeoutMs?:number;
};
type Evaluation={quote?:WeightDistanceQuote;codes?:string[]};
type Run = {
  listingId:string; attempts:number; modelTurns:number; signal:AbortSignal; results:Map<string,Evaluation>; diagnostics:RunDiagnostics;
};
export function createLogisticsService(deps:Dependencies, options:LogisticsOptions={}):InstrumentedLogisticsService {
  const repo=options.repository??createPostgresLogisticsRepository(deps.db);
  const policy={...defaultTiming,...options.timing};
  z.object({snapToleranceM:z.number().positive().max(1000),loadingS:z.number().int().nonnegative().max(3600),
    unloadingS:z.number().int().nonnegative().max(3600)}).parse(policy);
  const quoteTtlMs=z.number().int().positive().max(3600000).parse(options.quoteTtlMs??300000);
  const routingTimeoutMs=z.number().int().positive().max(30000).parse(options.routingTimeoutMs??8000);
  const modelTimeoutMs=z.number().int().positive().max(30000).parse(options.modelTimeoutMs??8000);
  const runs=new WeakMap<AbortSignal,Run>();
  function storageReady() {
    if(!options.repository && deps.persistence!=='postgres') pending('PostgreSQL logistics repositories/wiring (P2)');
  }
  async function route(points:Parameters<Dependencies['routing']['route']>[0],parent:AbortSignal) {
    const signal=AbortSignal.any([parent,AbortSignal.timeout(routingTimeoutMs)]);
    try {return validateRoute(await abortable(deps.routing.route(points,signal),signal),points.length);}
    catch(error) {
      parent.throwIfAborted();
      if(signal.aborted) throw new RoutingError('ROUTING_TIMEOUT','Road routing timed out',true);
      if(error instanceof RoutingError) throw error;
      throw new RoutingError('ROUTING_UNAVAILABLE','Road routing is unavailable',true);
    }
  }
  const read=<T>(task:Promise<T>,signal:AbortSignal)=>abortable(task,signal);
  return {
    async listTrips() {
      if(deps.mode==='stub') return [];
      storageReady();
      return repo.listTrips();
    },
    async createTrip(input) {
      if(deps.mode==='stub') return pending('Trip registration requires live road routing and PostgreSQL wiring (P2)');
      storageReady();
      const v=weightDistanceTripInputSchema.parse(input);
      const now=deps.clock.now();
      if(Date.parse(v.departureAt)<=now.getTime()) throw new ApiError(422,'DEPARTURE_IN_PAST','Choose a future departure');
      const signal=AbortSignal.timeout(deps.maxPlanMs);
      const r=await route([v.start,v.end],signal);
      validateStops([v.start,v.end],r.snappedPoints,policy.snapToleranceM);
      assertSimpleRoute(r.geometry);
      const trip=weightDistanceTripSchema.parse({...v,id:randomUUID(),status:'open',createdAt:now.toISOString(),
        routeGeoJSON:r.geometry,routeDistanceM:r.distanceM,routeDurationS:r.durationS,
        routeProvider:r.provider,routeProfile:r.profile});
      await read(repo.saveTrip(trip),signal);
      return trip;
    },
    async getQuote(id) {
      idSchema.parse(id);
      if(deps.mode==='stub') throw new ApiError(404,'NOT_FOUND','No validated quote exists in stub mode');
      storageReady();
      const q=weightDistanceQuoteSchema.parse(await repo.getQuote(id));
      if(q.quoteId!==id) throw new ApiError(503,'INVALID_STORED_QUOTE','Quote ID does not match');
      if(Date.parse(q.expiresAt)<=deps.clock.now().getTime()) throw new ApiError(409,'QUOTE_EXPIRED','Generate a new transport quote');
      return q;
    },
    getRunDiagnostics(signal) {
      const d=runs.get(signal)?.diagnostics;
      return d?structuredClone(d):{searchComplete:false,mode:deps.mode==='stub'?'stub':'deterministic_fallback',
        routedCombinations:0,trace:[]};
    },
    async evaluate(input,parent) {
      parent.throwIfAborted();
      if(deps.mode==='stub') return {options:[],rejections:[]};
      storageReady();
      const market=marketResultSchema.parse(input);
      let run=runs.get(parent);
      if(!run) {
        run={listingId:market.listingId,attempts:0,modelTurns:0,
          signal:AbortSignal.any([parent,AbortSignal.timeout(deps.maxPlanMs)]),results:new Map(),
          diagnostics:{searchComplete:false,mode:'deterministic_fallback',routedCombinations:0,trace:[]}};
        runs.set(parent,run);
      }
      if(run.listingId!==market.listingId) throw new ApiError(422,'INVALID_GENERATION_CONTEXT','A generation signal belongs to one listing');
      const state=run;
      // Reuse the caller's signal as the budget identity across alternative attempts.
      const signal=state.signal;
      const listing=listingSchema.parse(await read(repo.getListing(market.listingId),signal));
      const orders=await read(Promise.all([...new Set(market.candidateOrderIds)].map(id=>repo.getOrder(id))),signal);
      const trips=await read(repo.listTrips(),signal);
      const candidates:Array<Candidate & {carry:number;optimisticNet:number}>=[];
      const rejections:LogisticsResult['rejections']=[];
      const orderMap=new Map(orders.map(raw=>{const o=orderSchema.parse(raw);return [o.id,o];}));
      const tripMap=new Map(trips.slice(0,100).map(raw=>{const t=weightDistanceTripSchema.parse(raw);return [t.id,t];}));
      for(const order of orderMap.values()) for(const trip of tripMap.values()) {
        signal.throwIfAborted();
        try {
          checkShipment(listing,order,trip,deps.clock.now());
          const corridor=checkCorridor(trip.routeGeoJSON,listing.pickup,order.delivery,trip.corridorM);
          const amounts=calculateProceeds({quantityKg:listing.quantityKg,pricePerKgMinor:order.pricePerKgMinor,
            baseMinor:trip.baseMinor,handlingMinor:trip.handlingMinor,minNetMinor:listing.minNetMinor,
            extraDistanceM:0,perKmMinor:trip.perKmMinor,ratePerKgKmMinor:trip.ratePerKgKmMinor,
            routeCarryDistanceM:corridor.routeCarryDistanceM,pricingVersion:trip.pricingVersion});
          candidates.push({orderId:order.id,tripId:trip.id,carry:corridor.routeCarryDistanceM,optimisticNet:amounts.netMinor});
        } catch(error) {
          if(!(error instanceof FeasibilityError)) throw error;
          rejections.push({orderId:order.id,tripId:trip.id,codes:error.codes});
        }
      }
      candidates.sort((a,b)=>b.optimisticNet-a.optimisticNet || a.tripId.localeCompare(b.tripId));
      const candidateMap=new Map(candidates.map(c=>[c.orderId+':'+c.tripId,c]));
      let unavailable=false;
      const evaluate=async(pairs:Candidate[])=>{
        for(const pair of pairs) {
          signal.throwIfAborted();
          const key=pair.orderId+':'+pair.tripId;
          const candidate=candidateMap.get(key);
          if(!candidate) throw new ApiError(422,'UNKNOWN_CANDIDATE','Agent requested a trip outside the candidate set');
          if(state.results.has(key)) continue;
          if(state.attempts>=6) break;
          state.attempts++; // Includes failed requests and survives alternate attempts.
          const trip=tripMap.get(pair.tripId)!, order=orderMap.get(pair.orderId)!;
          try {
            const result=await route([trip.start,listing.pickup,order.delivery,trip.end],signal);
            if(result.provider!==trip.routeProvider || result.profile!==trip.routeProfile) {
              throw new FeasibilityError(['ROUTING_PROFILE_CHANGED']);
            }
            const valid=checkRoad(listing,order,trip,result,policy);
            const amounts=calculateProceeds({quantityKg:listing.quantityKg,pricePerKgMinor:order.pricePerKgMinor,
              baseMinor:trip.baseMinor,handlingMinor:trip.handlingMinor,minNetMinor:listing.minNetMinor,
              extraDistanceM:valid.extraDistanceM,perKmMinor:trip.perKmMinor,ratePerKgKmMinor:trip.ratePerKgKmMinor,
              routeCarryDistanceM:candidate.carry,pricingVersion:trip.pricingVersion});
            const now=deps.clock.now();
            const expiresMs=Math.min(now.getTime()+quoteTtlMs,Date.parse(trip.departureAt),Date.parse(order.deadlineAt));
            if(expiresMs<=now.getTime()) throw new FeasibilityError(['SOURCE_EXPIRED']);
            const q=weightDistanceQuoteSchema.parse({
              quoteId:randomUUID(),listingId:listing.id,orderId:order.id,tripId:trip.id,quantityKg:listing.quantityKg,
              pricePerKgMinor:order.pricePerKgMinor,baseMinor:trip.baseMinor,perKmMinor:trip.perKmMinor,
              handlingMinor:trip.handlingMinor,ratePerKgKmMinor:trip.ratePerKgKmMinor,pricingVersion:trip.pricingVersion,
              routeCarryDistanceM:candidate.carry,shipmentChargeMinor:amounts.shipmentChargeMinor,detourChargeMinor:amounts.detourChargeMinor,
              grossMinor:amounts.grossMinor,transportMinor:amounts.transportMinor,netMinor:amounts.netMinor,
              baseGeometry:trip.routeGeoJSON,modifiedGeometry:valid.route.geometry,
              baseDistanceM:trip.routeDistanceM,modifiedDistanceM:valid.route.distanceM,extraDistanceM:valid.extraDistanceM,
              baseDurationS:trip.routeDurationS,modifiedDurationS:valid.route.durationS,extraTimeS:valid.extraTimeS,
              pickupAt:valid.pickupAt,deliveryAt:valid.deliveryAt,generatedAt:now.toISOString(),expiresAt:new Date(expiresMs).toISOString(),
              ruleOutcomes:{capacity:true,crop:true,demand:true,partialFill:true,corridor:true,direction:true,
                simpleRoute:true,pickupBeforeDelivery:true,detourTime:true,snapping:true,readiness:true,deadline:true,detourDistance:true,extraTime:true,providerProfile:true},
            });
            await read(repo.saveQuote(q),signal);
            state.results.set(key,{quote:q});
            state.diagnostics.trace.push({role:'logistics',action:'evaluate_trip',outcome:trip.id+' validated; quote '+q.quoteId});
          } catch(error) {
            signal.throwIfAborted();
            if(error instanceof RoutingError || error instanceof FeasibilityError) {
              if(error instanceof RoutingError && error.unavailable) unavailable=true;
              const codes=error instanceof FeasibilityError?error.codes:[error.code];
              state.results.set(key,{codes});
              state.diagnostics.trace.push({role:'logistics',action:'evaluate_trip',outcome:trip.id+': '+codes.join(', ')});
            } else throw error; // Database/programming errors are not physical infeasibility.
          }
        }
        return {
          quotes:[...state.results.values()].flatMap(v=>v.quote?[v.quote]:[]),
          rejections:[...state.results].flatMap(([key,v])=>v.codes?[{orderId:key.split(':')[0],tripId:key.split(':')[1],codes:v.codes}]:[]),
        };
      };
      if(candidates.length) {
        const remaining=candidates.filter(c=>!state.results.has(c.orderId+':'+c.tripId)).slice(0,Math.max(0,6-state.attempts));
        if(remaining.length) {
          // Timeout each model turn without giving tool execution a shorter generation deadline.
          const llm={complete:async(args:Parameters<Dependencies['llm']['complete']>[0])=>{
            if(state.modelTurns>=2) throw new Error('Logistics model-turn budget exhausted');
            state.modelTurns++;
            const turn=AbortSignal.any([args.signal,AbortSignal.timeout(modelTimeoutMs)]);
            return abortable(deps.llm.complete({...args,signal:turn}),turn);
          }};
          // The generation signal, not an AI timeout, controls actual routing work/fallback.
          try {
            const report=await investigate(remaining,llm,signal,evaluate);
            state.diagnostics.mode=report.mode;
            state.diagnostics.trace.push({role:'logistics',action:report.mode==='live'?'agent_comparison':'deterministic_fallback',outcome:report.explanation});
          } catch(error) {
            if(!signal.aborted) throw error;
            state.diagnostics.trace.push({role:'logistics',action:'deadline_reached',outcome:'Returning only quotes validated and saved before the deadline'});
          }
        }
      }
      const results=await evaluate([]);
      state.diagnostics.routedCombinations=state.attempts;
      state.diagnostics.searchComplete=!signal.aborted && trips.length<=100 && !unavailable && candidates.every(c=>{
        const r=state.results.get(c.orderId+':'+c.tripId);
        return r && !r.codes?.some(code=>['ROUTING_UNAVAILABLE','ROUTING_TIMEOUT','INVALID_ROUTING_RESPONSE'].includes(code));
      });
      const quotes=results.quotes.filter(q=>market.candidateOrderIds.includes(q.orderId) && Date.parse(q.expiresAt)>deps.clock.now().getTime()).sort((a,b)=>b.netMinor-a.netMinor || a.quoteId.localeCompare(b.quoteId));
      return {options:quotes.map(q=>({orderId:q.orderId,tripId:q.tripId,quoteId:q.quoteId,
        extraDistanceM:q.extraDistanceM,deliveryAt:q.deliveryAt,transportMinor:q.transportMinor})),
        rejections:[...rejections,...results.rejections]};
    },
  };
}
