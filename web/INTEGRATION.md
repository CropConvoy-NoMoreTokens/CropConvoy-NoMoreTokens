# Frontend handoff and backend integration

Integrated on integration/dev-logistics: shared schemas and API mode now support ratePerKgKmMinor, pricingVersion=weight-distance-v2, real stored routes and complete proposal breakdowns. See ../docs/LOCAL-INTEGRATION.md for verified local behavior and startup commands.

## Run

From web/: `npm ci`, then `npm run dev`. No credentials are needed for the default demo. `npm run build` makes the production dist; `npm run preview -- --host 127.0.0.1` serves it. `npm test` runs the interaction, adapter and conversion checks. Hash routes survive static-host refreshes.

All changes for this implementation are inside web/. API/runtime contracts in the parent repository remain owned by P2/P4. Frontend types mirror that agreement locally; no production import crosses service roots. Keep them synchronized when P4 changes the agreement.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| VITE_DATA_MODE | demo | demo or api; invalid values fail explicitly |
| VITE_API_BASE_URL | http://localhost:3001 | HTTP API base, no trailing path prefix |
| VITE_MAP_TILE_URL | standard OSM HTTPS template | Replace with approved production provider |
| VITE_MAP_ATTRIBUTION | linked OpenStreetMap credit | Trusted build-time attribution HTML; include required provider links |

Vite reads these at startup/build time. Restart/rebuild after a change. Do not place database, model or routing secrets in VITE_ variables. OSM tiles are used only as an ordinary low-traffic development basemap, with normal browser caching/referrer and attribution; no bulk requests, prefetching or offline downloads are implemented. A production rollout needs the team's provider approval/contact configuration.

## Service boundary

UI calls CropConvoyService from src/api/types.ts. src/api/service.ts selects the demo or HTTP implementation. HTTP mode never catches a failure and silently produces demo success.

| UI action | API request |
|---|---|
| API-mode sign in / restore / sign out | POST /api/auth/login; GET /api/auth/me; POST /api/auth/logout |
| Review description | POST /api/harvest/extract |
| Publish / reload harvest | POST /api/listings; GET /api/listings/:id |
| List / save buyer order | GET /api/orders; POST /api/orders |
| List / save trip | GET /api/trips; POST /api/trips |
| Find proposal | POST /api/plans/generate |
| Reload proposal | GET /api/plans/:id |
| Accept/reject | POST /api/plans/:id/decision |

Successful responses use {data,meta}. ApiError preserves status/code/fields/requestId. Inputs and field paths match the backend, including nested pickup.lat, delivery.lng and start/end coordinates. Validation errors appear beside fields and in a summary. Conflicts (409) remain errors with regeneration available. Dependency/network/timeout failures keep entered values. Meta stub/fallback state is shown; searchComplete=false never becomes a claim of a completed no-match search.

In API mode the login form submits the public demo credentials to the backend. The bearer token is kept in `cropconvoy.apiToken` sessionStorage and attached to API requests; `/api/auth/me` restores the server-confirmed identity after refresh. A 401 clears the token and returns the user to login. Sign out calls `/api/auth/logout` and clears local state even if the network fails. `cropconvoy.identity` is used only in demo mode and is never treated as API authorization. API mode uses the server's user ID for actor fields. This is prototype access using publicly displayed credentials, not private account security.

## Units and dates

Display prices in LKR; convert decimal rupee strings to integer minor units without floating-point multiplication. 220 rupees/kg becomes 22000. Whole kg and safe bounds are checked. Trip inputs display maximum detour in km/minutes and convert to meters/seconds. All datetime-local fields explicitly mean Asia/Colombo; conversion uses +05:30 and checks against normalized Colombo date parts, independently of browser timezone. API timestamps use UTC ISO Z.

## Demo behavior

Public accounts: farmer / FarmerDemo123!, buyer / BuyerDemo123!, transporter / TransportDemo123!. In demo mode this is a local role chooser, not authorization. Only {role,username} is stored in cropconvoy.identity sessionStorage; no password or token is stored in demo mode. Route guards direct visitors to the matching demo login.

cropconvoy.demo.v1 holds records in sessionStorage; if storage is blocked the current page uses memory. The dataset begins with one synthetic tomato order and one trip. All records are shared across demo roles in the same tab, so a buyer/trip added before switching to farmer can be explored. Closing the tab ends the session under normal browser behavior; browser session restoration can retain sessionStorage.

Extraction is a deterministic demo parser for explicitly stated supported crop, integer kg, Rs/LKR minimum, Dambulla text and a UTC ISO date. It never invents a missing date/price. Publication is always explicit and requires confirmation of the form and pin.

Demo generation is an illustrative UI scenario, not AI/routing or a market/feasibility engine. It filters the sample orders for crop/quantity/partial permission and sample trips for capacity; uses the supplied Rs.950 transport arithmetic example and verifies the minimum. Road, direction and timing are not evaluated; searchComplete remains false and all route geometry/distances/durations remain null. Proposal amounts are clearly labeled. Decisions are simulated, idempotent for the same choice, and reject conflicting/expired decisions. There is no reservation or booking.

Frontend Trip/QuoteSnapshot types permit null geometry/measurements only to represent demo/pending data. Completed API responses should provide the full contract geometry and figures. The UI renders route layers only when valid data exists. No straight-line road substitute is created.

## Backend-ready switch checklist

1. P2/P3/P4 complete their actual integrations and persistence. Confirm the existing endpoint/envelope/field agreement, and provide success, empty, stale and dependency examples.
2. Set VITE_DATA_MODE=api and VITE_API_BASE_URL to the actual API address. Allow this frontend origin in API CORS.
3. Verify extraction → review → confirmed publication → generation → stored snapshot → decision. Refresh both listing and proposal URLs.
4. Verify saved order/trip data survives API restart, route geometry is real, and snapshot money/date units match.
5. Preserve pending buyer/transporter confirmations after acceptance. API-mode authorization comes from the backend session; the browser-supplied actor ID is not authority.
6. Confirm map provider terms/attribution, image loading, HTTPS, error behavior and production build. Use TEST-CHECKLIST.md for the UI regression pass.

Site search is local to static pages/help and records loaded into this app session. There is no unsupported server search call. The floating contact action opens local help because no team email/phone has been provided. There is no fake support form, newsletter subscription or real account registration.


## P4 integration after the UI rebase

Frontend Plan/GenerationResult types now preserve mode, sourceSnapshot and searchComplete. searchComplete is optional on stored plans for compatibility with older proposals; unknown status is shown explicitly. Proposals use stored source pins and farmer minimum, display original/modified quote geometry, and retain fallback mode after listing/retrieval races. Regenerating with no proposal removes the prior plan URL. Expired or server-conflicting decisions are disabled while refresh/regeneration remain available.

The browser regression tests use a copy of P4's full synthetic response envelopes inside src/test/fixtures/workflow-responses.json. The API suite verifies that copy against the checked-in contract pack and runtime schemas. Fixtures are test-only; no production import crosses service roots. Use VITE_DATA_MODE=api in local web/.env and restart Vite to exercise the backend. The default remains the labeled interactive demo. Real provider-backed proposal generation still requires the P2/P3 integrations described in ../docs/handoffs/P4-INTEGRATION.md.
