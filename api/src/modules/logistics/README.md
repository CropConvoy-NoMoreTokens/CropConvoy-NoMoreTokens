# Logistics implementation — P3

Implemented on the starter baseline 4e41b81e2b860c8ea2475283ceefac4b78b1f9e7.
Changes stay in api/src/modules/logistics/**. No shared-owner files, lockfiles or hosting resources were changed.

## Implemented

- PostgreSQL trip and quote repositories, including safe bigint mapping, expiry and stored fare verification.
- OSRM-compatible HTTP routing adapter: full GeoJSON, legs, snapped points, validation, caller cancellation and timeouts.
- Trip registration/listing with real stored route geometry; no synthetic route fallback.
- Capacity, crop/demand/partial-fill, simple-route/corridor, pickup order, snapping, readiness, deadline and detour checks.
- Hybrid-v1 tariff: original-route carrying segment + net added detour + base + handling.
- A validated Logistics Agent tool dispatcher using the injected LlmClient. Deterministic fallback is explicitly reported.
- Maximum six routed combinations and two model turns per shared generation signal, including alternative attempts.
- Persisted full quote snapshots for P4's getQuote handoff. Farmer minimum proceeds remain the Advocate's decision.
- Runtime trip schema locally extends the old shared schema; no invented default shipment rate.

## What needs P2/P4 integration

The default starter still runs in stub mode and its routing/LLM adapters are placeholders. This branch implements logistics, not the other owners' live wiring. Stub HTTP behavior remains unchanged.

P2:
1. Copy integration.sql into the next database migration and run it through the existing migration tool. It adds two tariff columns and logistics_quotes. Never apply it to a database without reviewing the target. Legacy trips stay detour-v0 and are excluded until republished with a real shipment rate.
2. Inject createOsrmRoutingClient from ./modules/logistics/routing.js into deps.routing:
   ```ts
   const routing = createOsrmRoutingClient({
     baseUrl: config.routingBaseUrl, // server config; not browser input
     profile: 'driving',            // ordinary car routes, not truck permissions
     timeoutMs: 8000,
     // headers: { Authorization: ... } when your provider requires it
   });
   ```
3. Complete listing/order PostgreSQL repositories. Logistics reads the agreed SQL columns; it cannot read market module's temporary Maps. Set persistence=postgres only when repositories are actually persistent. Set live mode only for configured integrations.
4. LlmClient.complete must normalize provider calls to the protocol in agent.ts. Never allow a model to execute SQL or fabricate tool outcomes. No new SDK is installed by this branch.

P4:
1. Promote the additive hybridTripInputSchema and HybridQuote fields from logistics/contracts.ts into shared contracts. Runtime trip routes already validate the local extension, but generated shared schemas and frontend types are still old.
2. Add shipmentPerKmMinor + pricingVersion to TripInput. Existing perKmMinor remains the extra-detour rate.
3. Quote fields: pricingVersion, shipmentPerKmMinor, routeCarryDistanceM, shipmentChargeMinor, detourChargeMinor, expiresAt. Preserve old quote fields and use both components when recomputing amounts.
4. Preserve method signatures. createLogisticsService additionally exposes getRunDiagnostics(signal). Copy searchComplete, mode and observable trace into the workflow's existing response fields. Do not label an outage as a completed no-match, or AI fallback as live AI.
5. Keep the same AbortSignal across alternative attempts to preserve the budget. Call evaluate, then getQuote for authoritative snapshots. Before acceptance, re-read source records and validate expiry/amounts. No reservation is made here.
6. Refresh fixtures, sample requests and generated JSON schemas once shared fields are promoted.

P1:
- Add shipmentPerKmMinor and pricingVersion to new trip requests.
- Label perKmMinor as extra-detour rate, not shipment rate.
- Convert rupees to integer minor units. Rs.10 = 1000.
- Show charge breakdown and original/proposed routes; model prose is advisory.

## Example tariff payload

Add these fields to the existing full trip request:
```json
{
  "baseMinor": 35000,
  "shipmentPerKmMinor": 1000,
  "perKmMinor": 10000,
  "handlingMinor": 0,
  "pricingVersion": "hybrid-v1"
}
```

100 km carrying and 6 km added detour cost Rs.1,950.
The carrying distance is measured along the ORIGINAL road-route geometry between pickup/delivery projections. It excludes upstream/downstream journey portions. It is not the modified pickup-to-delivery leg, which may already contain detour distance. Polyline distance is an estimate. Weight checks capacity only.

## Public methods

createLogisticsService(deps, optionalOptions):
- listTrips(): hybrid-v1 open trips, ordered by departure (up to 101 prototype records).
- createTrip(input): real road routing, geometry/tariff validation and DB insert.
- evaluate(marketResult, signal): summaries plus rejection codes, no booking/acceptance.
- getQuote(id): validated stored snapshot; missing = 404, expired = 409.
- getRunDiagnostics(signal): observable trace, AI mode, route-attempt count and search completion.

Optional options support a fake repository, timing policy, quote TTL, and timeouts for independent tests. Production defaults use PostgreSQL and injected routing/LLM clients. No hidden in-memory persistence fallback is used.

Default timing: 100 m road-snap tolerance, 600 s loading, 300 s unloading.
pickupAt/deliveryAt are arrival times. Buyer deadline includes completion of unloading. Driver extraTimeS includes loading and unloading. Quote expires after five minutes or at departure/deadline, whichever is sooner. These are configurable prototype policies, not contractual transport promises.

Routing profile must match the stored trip profile/provider. Modified road routing may change corridors; show it as a proposal requiring transporter approval. Self-crossing/looped/ambiguous routes are conservatively rejected, including some overpasses. No traffic, heavy-truck permission, cold-chain or nationwide optimization is claimed.

## LLM adapter protocol

First request supplies real candidates. Normalized response:
```json
{"toolCalls":[{"name":"evaluateTrips","arguments":{"candidates":[{"orderId":"existing UUID","tripId":"existing UUID"}]}}]}
```
The dispatcher validates IDs, executes real evaluation and returns tool results in the second call's input.
Second response:
```json
{"quoteIds":["returned quote UUID"],"explanation":"Brief explanation of tool results"}
```

Returned option order is based on verified net proceeds, not model-selected money or unsupported claims. Explanation is advisory and should never supply numeric UI fields.

## Validation

From api/:
```sh
npm test
npm run build
```

Real PostgreSQL integration test is opt-in. Use a dedicated local/test database: it creates/drops only a randomized logistics_test_* schema, applying the starter migration and integration.sql inside it.
```sh
LOGISTICS_TEST_DATABASE_URL=postgresql://... npm test
```

Real road smoke check on 24 October 2026:
- One-off public OSRM demo request, not a production hosting/provider recommendation.
- Start: {lat:7.4863,lng:80.3647}; end: {lat:6.9271,lng:79.8612}.
- Returned route: 93,258.7 m, 5,873.9 s, 2,160 geometry points.
- On-route test pickup: {lat:7.187781,lng:80.11166}.
- On-route test delivery: {lat:6.99092,lng:79.938911}.
- Original-route carrying segment: approximately 33,052.52 m; modified total remained 93,258.7 m (zero added detour).
- Both full route simplicity and candidate projection checks passed. Results can change with map data.
- The module has NO default routing URL. Choose a permitted hosted provider and verify usage limits before deployment.
- Live LLM integration needs the team's provider/key; tests inject a fake normalized client.

Test coverage includes money rounding/overflow, segment-interior projection, upstream travel exclusion, route loops/reversal,
routing malformed data/outage/cancellation, capacity/time/detour/snapping rejection, expiry, restart lookup,
agent ID injection, budget preservation, partial results at deadline and live HTTP trip validation.
