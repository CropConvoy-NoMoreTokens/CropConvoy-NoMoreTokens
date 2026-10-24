import type { CropConvoyService, Result, Listing, Order, Trip, Plan, ListingInput, OrderInput, TripInput, ExtractInput, ExtractResult, GenerationResult, QuoteSnapshot } from './types';
import { ApiError } from './client';
import { colomboToUtc, tomorrowAt } from '../lib/format';
export const DEMO_IDS = { farmer: '11111111-1111-4111-8111-111111111111', buyer: '22222222-2222-4222-8222-222222222222', transporter: '33333333-3333-4333-8333-333333333333' };
export const demoAccounts = [
  { role: 'farmer' as const, label: 'Farmer', username: 'farmer', password: 'FarmerDemo123!' },
  { role: 'buyer' as const, label: 'Buyer', username: 'buyer', password: 'BuyerDemo123!' },
  { role: 'transporter' as const, label: 'Transporter', username: 'transporter', password: 'TransportDemo123!' },
];
type Store = { listings: Listing[]; orders: Order[]; trips: Trip[]; plans: Plan[] };
const key = 'cropconvoy.demo.v1';
const uuid = () => crypto.randomUUID();
function seed(): Store {
  const createdAt = new Date().toISOString();
  const order: Order = { id: '55555555-5555-4555-8555-555555555555', demoBuyerId: DEMO_IDS.buyer, crop: 'tomato', remainingKg: 200, pricePerKgMinor: 22000, delivery: { lat: 7.2906, lng: 80.6337 }, deadlineAt: colomboToUtc(tomorrowAt(20)), allowsPartial: true, status: 'open', createdAt };
  const trip: Trip = { id: '66666666-6666-4666-8666-666666666666', demoTransporterId: DEMO_IDS.transporter, start: { lat: 7.95, lng: 80.65 }, end: { lat: 7.25, lng: 80.63 }, departureAt: colomboToUtc(tomorrowAt(9)), availableKg: 120, corridorM: 3000, maxExtraDistanceM: 10000, maxExtraTimeS: 3600, baseMinor: 35000, perKmMinor: 10000, ratePerKgKmMinor: 20, pricingVersion: 'weight-distance-v2', handlingMinor: 0, status: 'open', createdAt, routeGeoJSON: null, routeDistanceM: null, routeDurationS: null, routeProvider: 'demo_route_pending', routeProfile: 'pending' };
  return { listings: [], orders: [order], trips: [trip], plans: [] };
}
export function createDemoService(storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage): CropConvoyService {
  let memory = seed();
  try { const saved = JSON.parse(storage.getItem(key) || 'null'); if (saved && Array.isArray(saved.listings) && Array.isArray(saved.orders) && Array.isArray(saved.trips) && Array.isArray(saved.plans)) memory = saved; } catch { /* Storage can be unavailable in private browsing. */ }
  const save = () => { try { storage.setItem(key, JSON.stringify(memory)); } catch { /* In-memory operation remains available. */ } };
  const result = async <T,>(data: T): Promise<Result<T>> => ({ data: structuredClone(data), meta: { mode: 'demo', persistence: 'session', requestId: uuid() } });
  const getListing = (id: string) => { const row = memory.listings.find(x => x.id === id); if (!row) throw new ApiError('That listing could not be found in this demo session.', 404, 'NOT_FOUND'); return row; };
  const getPlan = (id: string) => { const row = memory.plans.find(x => x.id === id); if (!row) throw new ApiError('That proposal could not be found in this demo session.', 404, 'NOT_FOUND'); return row; };
  return {
    mode: 'demo',
    async extract(input: ExtractInput) {
      const text = input.text;
      const quantity = text.match(/(?:^|[^\d.\-])(\d+)\s*kg\b/i);
      const price = text.match(/(?:Rs\.?|LKR)\s*([\d,]+(?:\.\d{1,2})?)(?![\d.])/i);
      const crop = /tomato/i.test(text) ? 'tomato' : /potato/i.test(text) ? 'potato' : /carrot/i.test(text) ? 'carrot' : null;
      const iso = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/);
      const draft: ExtractResult['draft'] = { crop, quantityKg: quantity ? Number(quantity[1]) : null, minNetMinor: price ? Math.round(Number(price[1].replaceAll(',', '')) * 100) : null, locationText: /Dambulla/i.test(text) ? 'Dambulla' : null, readyAt: iso && Number.isFinite(Date.parse(iso[0])) ? iso[0] : null };
      const missingFields = Object.entries(draft).filter(([, value]) => value === null).map(([name]) => name);
      return result({ draft, missingFields, questions: missingFields.length ? ['Please complete the missing fields and confirm the pickup pin. Demo extraction only reads explicitly stated values.'] : ['Review all details and confirm your pickup pin before publishing.'] });
    },
    async createListing(input: ListingInput) { const row: Listing = { ...input, id: uuid(), status: 'open', createdAt: new Date().toISOString() }; memory.listings.push(row); save(); return result(row); },
    async getListing(id) { return result(getListing(id)); },
    async listOrders() { return result(memory.orders); },
    async createOrder(input: OrderInput) { const row: Order = { ...input, id: uuid(), status: 'open', createdAt: new Date().toISOString() }; memory.orders.push(row); save(); return result(row); },
    async listTrips() { return result(memory.trips); },
    async createTrip(input: TripInput) { const row: Trip = { ...input, id: uuid(), status: 'open', createdAt: new Date().toISOString(), routeGeoJSON: null, routeDistanceM: null, routeDurationS: null, routeProvider: 'demo_route_pending', routeProfile: 'pending' }; memory.trips.push(row); save(); return result(row); },
    async generate(listingId) {
      const listing = getListing(listingId);
      const order = memory.orders.filter(x => x.crop === listing.crop && x.remainingKg >= listing.quantityKg && x.allowsPartial).sort((a, b) => b.pricePerKgMinor - a.pricePerKgMinor)[0];
      const trip = memory.trips.find(x => x.availableKg >= listing.quantityKg);
      const trace: GenerationResult['trace'] = [{ role: 'workflow', action: 'demo_scenario', outcome: 'Illustrative price calculation only. Road, direction and timing feasibility have not been evaluated.' }];
      const empty: GenerationResult = { outcome: 'no_feasible_plan', plan: null, alternatives: [], rejections: [], trace, searchComplete: false, mode: 'demo' };
      if (!order || !trip) return result(empty);
      // Supplied fixture's Rs. 950 transport example, never presented as a road-validated quote.
      const transportMinor = 95000;
      const grossMinor = listing.quantityKg * order.pricePerKgMinor;
      if (!Number.isSafeInteger(grossMinor) || grossMinor - transportMinor < listing.minNetMinor) { trace.push({ role: 'advocate', action: 'sample_minimum_check', outcome: 'The sample proceeds do not meet the farmer minimum.' }); return result(empty); }
      const createdAt = new Date().toISOString();
      const quote: QuoteSnapshot = { routeCarryDistanceM: null, shipmentChargeMinor: null, detourChargeMinor: null, expiresAt: new Date(Date.now()+300000).toISOString(), quoteId: uuid(), listingId, orderId: order.id, tripId: trip.id, quantityKg: listing.quantityKg, pricePerKgMinor: order.pricePerKgMinor, baseMinor: 35000, perKmMinor: 10000, ratePerKgKmMinor: 20, pricingVersion: 'weight-distance-v2', handlingMinor: 0, grossMinor, transportMinor, netMinor: grossMinor - transportMinor, baseGeometry: null, modifiedGeometry: null, baseDistanceM: null, modifiedDistanceM: null, extraDistanceM: null, baseDurationS: null, modifiedDurationS: null, extraTimeS: null, pickupAt: listing.readyAt, deliveryAt: order.deadlineAt, generatedAt: createdAt, ruleOutcomes: { sampleMinimumMet: true, roadValidationComplete: false } };
      const plan: Plan = { id: uuid(), listingId, orderId: order.id, tripId: trip.id, quantityKg: listing.quantityKg, status: 'proposed', quoteSnapshot: quote, review: { verdict: 'recommend', selectedQuoteId: quote.quoteId, reasonCodes: ['DEMO_SCENARIO', 'ROUTE_PENDING'], explanation: 'This sample estimate lets you explore the workflow. It is not a shipment offer or a validated transport quote.' }, trace, expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), createdAt };
      memory.plans.push(plan); save();
      return result({ ...empty, outcome: 'proposed', plan });
    },
    async getPlan(id) { return result(getPlan(id)); },
    async decide(id, decision) {
      const plan = getPlan(id);
      const target = decision === 'accept' ? 'farmer_accepted_pending_confirmations' : 'rejected';
      if (plan.status === target) return result(plan);
      if (plan.status !== 'proposed') throw new ApiError('This proposal already has a different decision.', 409, 'CONFLICT');
      if (Date.parse(plan.expiresAt) <= Date.now()) throw new ApiError('This proposal has expired. Generate a new one.', 409, 'STALE_PLAN');
      plan.status = target; save(); return result(plan);
    },
  };
}
