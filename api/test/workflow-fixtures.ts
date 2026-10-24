import { readFile } from 'node:fs/promises';
import type { Dependencies } from '../src/core/dependencies.js';
import type { Listing, Order, Trip, QuoteSnapshot } from '../src/core/contracts.js';
import type { MarketRepository } from '../src/modules/market/repository.js';
import type { LogisticsService } from '../src/modules/logistics/service.js';
import { createWorkflowService, type WorkflowOptions } from '../src/modules/workflow/service.js';
import { requiredRules } from '../src/modules/advocate/service.js';

export const fixture = JSON.parse(await readFile(new URL('../../contracts/fixtures/happy-path.json', import.meta.url), 'utf8'));
export const results = JSON.parse(await readFile(new URL('../../contracts/fixtures/module-results.json', import.meta.url), 'utf8'));
export function setup() {
  let now = new Date('2026-10-25T03:00:00Z');
  const createdAt = '2026-10-24T03:00:00Z';
  const listing: Listing = { ...fixture.listingInput, id: fixture.ids.listingId, status: 'open', createdAt };
  const order: Order = { ...fixture.orderInput, id: fixture.ids.orderId, status: 'open', createdAt };
  // Deliberately synthetic geometry: only injected tests use it, never a live road claim.
  const trip: Trip = { ...fixture.tripInput, id: fixture.ids.tripId, status: 'open', createdAt,
    routeGeoJSON: { type: 'LineString', coordinates: [[80.65, 7.95], [80.63, 7.25]] },
    routeDistanceM: 60_000, routeDurationS: 3600, routeProvider: 'synthetic-test-only', routeProfile: 'test' };
  const quote: QuoteSnapshot = { quoteId: fixture.ids.quoteId, listingId: listing.id, orderId: order.id,
    tripId: trip.id, quantityKg: 80, pricePerKgMinor: 22000, baseMinor: 35000, perKmMinor: 10000,
    ratePerKgKmMinor: 0, pricingVersion: 'weight-distance-v2', routeCarryDistanceM: 100000,
    shipmentChargeMinor: 0, detourChargeMinor: 60000, expiresAt: '2026-10-25T03:15:00Z',
    handlingMinor: 0, grossMinor: 1760000, transportMinor: 95000, netMinor: 1665000,
    baseGeometry: structuredClone(trip.routeGeoJSON), modifiedGeometry: structuredClone(trip.routeGeoJSON),
    baseDistanceM: 60000, modifiedDistanceM: 66000, extraDistanceM: 6000,
    baseDurationS: 3600, modifiedDurationS: 4200, extraTimeS: 1200,
    pickupAt: '2026-10-25T04:00:00Z', deliveryAt: '2026-10-25T06:00:00Z', generatedAt: now.toISOString(),
    ruleOutcomes: Object.fromEntries(requiredRules.map(rule => [rule, true])) };
  const deps: Dependencies = {
    clock: { now: () => new Date(now) }, mode: 'deterministic_fallback', persistence: 'memory', maxPlanMs: 1000,
    db: { async query() { throw new Error('Unexpected DB call'); }, async ping() {}, async close() {} },
    llm: { async complete(input) { const value = input.input as { quotes: Array<{ quoteId: string }> };
      return { tool: 'review_quotes', arguments: { selectedQuoteId: value.quotes[0]?.quoteId ?? null, requestAlternative: false } }; } },
    routing: { async route() { throw new Error('Unexpected route call'); } },
  };
  const market: MarketRepository = { async getListing() { return structuredClone(listing); },
    async listOrders() { return [structuredClone(order)]; },
    async createListing() { throw new Error('Unexpected create'); }, async createOrder() { throw new Error('Unexpected create'); } };
  const logistics: LogisticsService = { async listTrips() { return [structuredClone(trip)]; },
    async createTrip() { throw new Error('Unexpected create'); },
    async getQuote() { return structuredClone(quote); }, async evaluate() { return structuredClone(results.logistics); } };
  const options: WorkflowOptions = { async findMarket() { return structuredClone(results.market); }, logisticsForGeneration: () => logistics };
  return { listing, order, trip, quote, deps, market, logistics, options,
    setNow(value: string) { now = new Date(value); },
    workflow() { return createWorkflowService(deps, market, logistics, options); } };
}
