// Integration-only process: real app, Gemini parser and PostgreSQL repositories.
// Provider responses and road geometry are synthetic; never used by production.
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { createDependencies, type Dependencies } from '../../src/core/dependencies.js';
import { tripSchema, type QuoteSnapshot, type Trip } from '../../src/core/contracts.js';
import { ApiError } from '../../src/core/errors.js';
import { createMarketRepository } from '../../src/modules/market/repository.js';
import type { LogisticsService } from '../../src/modules/logistics/service.js';
import { calculateProceeds } from '../../src/modules/logistics/pricing.js';
import { setup } from '../workflow-fixtures.js';
import { createOsrmRoutingClient } from '../../src/modules/logistics/routing.js';
import { meters } from '../../src/modules/logistics/geometry.js';

const scenario = process.env.P4_INTEGRATION_SCENARIO ?? 'valid';
const fixture = setup();
const deps = createDependencies({ databaseUrl: process.env.P4_INTEGRATION_DATABASE_URL,
  stub: false, maxPlanMs: scenario.includes('deadline') ? 2000 : scenario === 'advocate_hang' ? 1000 : 5000,
  llmApiKey: 'synthetic-test-key', llmModel: 'gemini-test-model' });
deps.clock = { now: () => new Date(process.env.P4_INTEGRATION_NOW ?? fixture.deps.clock.now().toISOString()) };

// Only transport is faked: the real OSRM parser and all P3 services run in integrated scenarios.
if (scenario.startsWith('integrated')) {
  let routes = 0;
  deps.routing = createOsrmRoutingClient({ baseUrl: 'https://routing.example.test', provider: 'synthetic-integration',
    fetch: async url => {
      const points = new URL(String(url)).pathname.split('/').at(-1)!.split(';').map(pair => {
        const [lng, lat] = pair.split(',').map(Number); return { lat, lng };
      });
      const modified = points.length === 4;
      if (modified && scenario === 'integrated_deadline' && ++routes === 2) return new Promise<Response>(() => {});
      if (modified && scenario === 'integrated_no_route') return new Response(JSON.stringify({ code: 'NoRoute' }));
      if (modified && scenario === 'integrated_routing_outage') return new Response(JSON.stringify({ code: 'Error' }), { status: 503 });
      const base = meters(points[0], points.at(-1)!);
      const distance = base + (modified ? 6000 : 0);
      const durations = modified ? [1200, 1800, 1200] : [3600];
      return new Response(JSON.stringify({ code: 'Ok', routes: [{
        geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) },
        distance, duration: modified ? 4200 : 3600,
        legs: durations.map(duration => ({ distance: distance / durations.length, duration })),
      }], waypoints: points.map(p => ({ location: [p.lng, p.lat] })) }));
    } });
}

const report = (message: unknown) => { if (process.connected) process.send?.(message); };
const providerResponse = (part: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [part] } }] }),
  { headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, options) => {
  if (new URL(String(url)).hostname !== 'generativelanguage.googleapis.com') throw new Error('Unexpected test provider');
  const body = JSON.parse(String(options?.body));
  const input = JSON.parse(body.contents[0].parts[0].text);
  const tool = body.tools?.[0]?.functionDeclarations?.[0]?.name;
  report({ event: 'provider_call', stage: tool ?? (input.text ? 'extract' : 'rank') });
  if (tool === 'searchOrders') return providerResponse({ functionCall: { name: tool, args: { listingId: input.listingId } } });
  if (tool === 'evaluateTrips') return providerResponse({ functionCall: { name: tool, args: { candidates:
    input.candidates.map((pair: { orderId: string; tripId: string }) => ({ orderId: pair.orderId,
      tripId: scenario === 'integrated_unknown_logistics' ? randomUUID() : pair.tripId })) } } });
  if (input.phase === 'summarize') return providerResponse({ text: JSON.stringify({
    quoteIds: input.toolResults[0].result.quotes.map((q: { quoteId: string }) => q.quoteId),
    explanation: 'UNTRUSTED_MODEL_DETAIL '.repeat(35),
  }) });
  if (tool === 'review_quotes') {
    if (scenario === 'advocate_hang') return new Promise<Response>(() => {});
    return providerResponse({ functionCall: { name: tool,
      args: { selectedQuoteId: input.quotes[0]?.quoteId ?? null, requestAlternative: false } } });
  }
  if (input.searchOrdersResult) return providerResponse({ text: JSON.stringify({ candidateOrderIds:
    scenario === 'unknown_market' ? [randomUUID()] : input.searchOrdersResult.eligibleOrders.slice(0, 3).map((order: { id: string }) => order.id) }) });
  if (input.text) return providerResponse({ text: JSON.stringify({ draft: { crop: 'tomato', quantityKg: 80,
    locationText: 'Dambulla', readyAt: fixture.listing.readyAt, minNetMinor: 1600000 } }) });
  throw new Error('Unexpected test model request');
};

function syntheticLogistics(scoped: Dependencies): LogisticsService {
  const market = createMarketRepository(scoped);
  const quotes = new Map<string, QuoteSnapshot>();
  const listTrips = async (): Promise<Trip[]> => {
    const { rows } = await scoped.db.query('SELECT * FROM trips ORDER BY id');
    return rows.map(row => tripSchema.parse({ id: row.id, demoTransporterId: row.demo_transporter_id,
      start: { lat: row.start_lat, lng: row.start_lng }, end: { lat: row.end_lat, lng: row.end_lng },
      departureAt: new Date(row.departure_at).toISOString(), availableKg: row.available_kg,
      ratePerKgKmMinor: Number(row.rate_per_kg_km_minor), pricingVersion: row.pricing_version,
      corridorM: row.corridor_m, maxExtraDistanceM: row.max_extra_distance_m, maxExtraTimeS: row.max_extra_time_s,
      baseMinor: Number(row.base_minor), perKmMinor: Number(row.per_km_minor), handlingMinor: Number(row.handling_minor),
      routeGeoJSON: row.route_geojson, routeDistanceM: row.route_distance_m, routeDurationS: row.route_duration_s,
      routeProvider: row.route_provider, routeProfile: row.route_profile, status: row.status,
      createdAt: new Date(row.created_at).toISOString() }));
  };
  return { listTrips, async createTrip() { throw new Error('Test trips must be explicitly seeded'); },
    async getQuote(id) {
      const quote = quotes.get(id);
      if (!quote) throw new ApiError(404, 'NOT_FOUND', 'Test quote not found');
      return structuredClone(quote);
    },
    async evaluate(candidates, signal) {
      signal.throwIfAborted();
      const listing = await market.getListing(candidates.listingId);
      const orders = (await market.listOrders()).filter(order => candidates.candidateOrderIds.includes(order.id));
      const trip = (await listTrips())[0];
      const options = [];
      if (trip) for (const order of orders) {
        const money = calculateProceeds({ quantityKg: listing.quantityKg, pricePerKgMinor: order.pricePerKgMinor,
          baseMinor: trip.baseMinor, perKmMinor: trip.perKmMinor, handlingMinor: trip.handlingMinor,
          ratePerKgKmMinor: trip.ratePerKgKmMinor, pricingVersion: trip.pricingVersion,
          routeCarryDistanceM: fixture.quote.routeCarryDistanceM,
          extraDistanceM: 6000, minNetMinor: listing.minNetMinor });
        const quote: QuoteSnapshot = { ...structuredClone(fixture.quote), quoteId: randomUUID(),
          listingId: listing.id, orderId: order.id, tripId: trip.id, quantityKg: listing.quantityKg,
          pricePerKgMinor: order.pricePerKgMinor, baseMinor: trip.baseMinor, perKmMinor: trip.perKmMinor,
          handlingMinor: trip.handlingMinor, grossMinor: money.grossMinor, transportMinor: money.transportMinor,
          netMinor: money.netMinor, baseGeometry: trip.routeGeoJSON, baseDistanceM: trip.routeDistanceM,
          shipmentChargeMinor: money.shipmentChargeMinor, detourChargeMinor: money.detourChargeMinor,
          ratePerKgKmMinor: trip.ratePerKgKmMinor, pricingVersion: trip.pricingVersion,
          baseDurationS: trip.routeDurationS, modifiedDistanceM: trip.routeDistanceM + 6000,
          modifiedDurationS: trip.routeDurationS + 600, generatedAt: scoped.clock.now().toISOString() };
        quotes.set(quote.quoteId, quote);
        options.push({ orderId: order.id, tripId: trip.id, quoteId: quote.quoteId,
          extraDistanceM: quote.extraDistanceM, deliveryAt: quote.deliveryAt, transportMinor: quote.transportMinor });
      }
      return { options, rejections: [] };
    } };
}

try {
  await deps.db.ping();
  const options = scenario === 'routing_unavailable' || scenario.startsWith('integrated') ? {} : {
    logistics: syntheticLogistics(deps), logisticsForGeneration: syntheticLogistics,
  };
  const server = createApp(deps, ['http://localhost:5173'], options).listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string') report({ event: 'listening', port: address.port });
  });
  process.once('SIGTERM', () => server.close(() => { void deps.db.close().then(() => process.exit(0), () => process.exit(1)); }));
} catch (error) {
  report({ event: 'startup_failed', code: (error as { code?: string }).code ?? 'UNKNOWN' });
  await deps.db.close(); process.exitCode = 1;
}
