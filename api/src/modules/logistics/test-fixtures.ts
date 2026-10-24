// Synthetic geometry and actors, exclusively for isolated tests. Not a verified road route.
import {randomUUID} from 'node:crypto';
import type {Listing,Order,MarketResult} from '../../core/contracts.js';
import type {Dependencies,RoutingClient} from '../../core/dependencies.js';
import type {HybridTrip,HybridQuote} from './contracts.js';
import type {LogisticsRepository} from './repository.js';
import {meters} from './geometry.js';
export function setup(){
  let now=new Date('2026-10-24T00:00:00Z');
  const createdAt=now.toISOString();
  const listing:Listing={id:randomUUID(),demoFarmerId:randomUUID(),crop:'tomato',quantityKg:80,
    pickup:{lng:80.2,lat:7},readyAt:'2026-10-24T00:00:00Z',minNetMinor:1600000,confirmed:true,status:'open',createdAt};
  const order:Order={id:randomUUID(),demoBuyerId:randomUUID(),crop:'tomato',remainingKg:100,pricePerKgMinor:22000,
    delivery:{lng:80.4,lat:7},deadlineAt:'2026-10-24T10:00:00Z',allowsPartial:true,status:'open',createdAt};
  const trip:HybridTrip={id:randomUUID(),demoTransporterId:randomUUID(),start:{lng:80,lat:7},end:{lng:80.6,lat:7},
    departureAt:'2026-10-24T01:00:00Z',availableKg:100,corridorM:3000,maxExtraDistanceM:10000,maxExtraTimeS:3600,
    baseMinor:35000,perKmMinor:10000,shipmentPerKmMinor:1000,handlingMinor:0,pricingVersion:'hybrid-v1',
    status:'open',createdAt,routeGeoJSON:{type:'LineString',coordinates:[[80,7],[80.6,7]]},
    routeDistanceM:meters({lng:80,lat:7},{lng:80.6,lat:7}),routeDurationS:3600,routeProvider:'synthetic-test',routeProfile:'driving'};
  const trips=new Map([[trip.id,structuredClone(trip)]]),quotes=new Map<string,HybridQuote>();
  const repository:LogisticsRepository={
    async listTrips(){return structuredClone([...trips.values()]);},
    async saveTrip(t){trips.set(t.id,structuredClone(t));},
    async getListing(){return structuredClone(listing);},
    async getOrder(id){if(id!==order.id)throw new Error('Unknown order');return structuredClone(order);},
    async saveQuote(q){quotes.set(q.quoteId,structuredClone(q));},
    async getQuote(id){const q=quotes.get(id);if(!q)throw new Error('Unknown quote');return structuredClone(q);},
  };
  let routingCalls=0;
  const routing:RoutingClient={async route(points){
    routingCalls++;
    const modified=points.length===4, distanceM=trip.routeDistanceM+(modified?6000:0),durationS=modified?4200:3600;
    return {geometry:{type:'LineString',coordinates:points.map(p=>[p.lng,p.lat])},distanceM,durationS,
      legs:modified?[{distanceM:distanceM/3,durationS:1200},{distanceM:distanceM/3,durationS:1800},{distanceM:distanceM/3,durationS:1200}]
        :[{distanceM,durationS}],snappedPoints:points,provider:'synthetic-test',profile:'driving'};
  }};
  const deps:Dependencies={db:{async query(){throw new Error('No test SQL expected');},async ping(){},async close(){}},
    llm:{async complete(){throw new Error('No test AI provider');}},routing,clock:{now:()=>new Date(now)},
    mode:'live',persistence:'postgres',maxPlanMs:1000};
  const market:MarketResult={listingId:listing.id,candidateOrderIds:[order.id],reasons:{}};
  return {listing,order,trip,trips,quotes,repository,deps,market,
    setNow:(v:Date)=>{now=v;},routingCalls:()=>routingCalls};
}
