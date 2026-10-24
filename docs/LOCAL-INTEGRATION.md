# Connected UI/backend integration

Local integration branch: integration/dev-logistics.
Combines dev (57d67b3), market/platform-handoff (cd57e54), feat/p4-persisted-advocate-workflow (d142974), and logistics weight-distance-v2.
No remote branch was changed by the integration work.

## Changes made to connect the modules

- Promoted the kg-km tariff fields to shared trip/quote schemas; synchronized frontend types/validation and generated contracts.
- Added carrying-rate input and proposal fare breakdown.
- Connected the configurable OSRM routing adapter in createDependencies and request-scoped logistics in the workflow.
- Normalized Gemini tool-call responses for Logistics and Advocate.
- Matched logistics hard-rule names with Advocate requirements, compared both price components, propagated fallback/search completeness and bounded plan expiry by quote expiry.
- Avoided counting cheap proximity/capacity rejections against the six routed-combination limit.
- Added migration 002 for tariff/quote storage and made the migration runner execute unapplied SQL files in order.
- Kept demo and API modes separate. API mode now uses database-backed demo login and role/owner checks; the predefined credentials are public and are not production identities.

## Run locally

Use Node 24. Install each package independently:
```sh
npm --prefix api ci
npm --prefix web ci
```

Create api/.env from its example if absent. Configure these server-only values:
```dotenv
API_STUBS=false
DATABASE_URL=<your PostgreSQL connection URL>
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ROUTING_BASE_URL=<approved OSRM-compatible provider origin>
ROUTING_PROFILE=driving
LLM_API_KEY=<team model key>
LLM_MODEL=<team model ID>
```
No production routing URL or credentials are committed. Without LLM credentials, extraction asks for manual completion and market/logistics/advocate use explicitly labelled deterministic fallback. Routing/database failures never produce demo-success substitutes.

From api/, run npm run db:migrate, then npm run dev.
The migration runner applies `001_initial.sql`, `002_demo_auth.sql`, and `002_weight_distance_logistics.sql` once each using its filename ledger and transaction.
If the older standalone hybrid-v1 SQL was already applied to your database, review the upgrade-hybrid-v1.sql handoff and migration ledger first rather than blindly applying the fresh 002.

Create web/.env.local with:
```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:3001
```
From web/, run npm run dev. Restart Vite after changing VITE_ settings.
Never put model/database secrets in frontend variables.

## Local verification on 24 October 2026

- 62 backend tests passed with both optional PostgreSQL suites enabled.
- 35 UI tests passed. Both production builds passed.
- Real OSRM route returned for Kurunegala–Colombo; full original route stored.
- Seeded synthetic buyer/listing/trip in a dedicated local PostgreSQL database.
- Browser requested a proposal through API mode: 80 kg × ~33.05 km × Rs.0.20/kg/km = Rs.528.84 carrying; base Rs.350; zero detour/handling; transport Rs.878.84; proceeds Rs.16,721.16.
- Browser acceptance stored farmer_accepted_pending_confirmations, not a booking.
- API restart preserved saved listing, quote and accepted plan.
- External road routing was real; model calls were deterministic fallback because this local test intentionally supplied no LLM key.
- Hosted Render/Vercel integration and live model behavior are not verified by these results.
- Browser verification loaded a saved API-seeded harvest; ready-date manual entry in the browser automation was inconclusive. Existing UI form/validation tests pass.

## Repeatable tests

From api/:
```sh
npm test
npm run build
npm run contracts:export
```
For dedicated test databases, set LOGISTICS_TEST_DATABASE_URL and P4_TEST_DATABASE_URL before npm test.
Those opt-in tests create/drop their own randomly named test schemas or local databases. The process-restart suite requires a local role with CREATE DATABASE permission. Never use an unreviewed production database for test writes.

From web/: npm test; npm run build.
The local integrated-http test uses actual services and PostgreSQL with explicitly synthetic routing and unavailable model adapters; the separate browser smoke used a real road provider.


## Latest P3/P4 rebase integration

Conflict resolutions retain P3 routing configuration, readiness/migration checks and versioned fare fields together with P2/P4 injection, PostgreSQL/TLS settings and fallback reporting. The advocate consumes the existing normalized name/arguments tool response directly. Proposal UI keeps both the new charge breakdown and the stored source minimum/pins. Quote expiry is enforced in the UI, service and conditional SQL update. Model comparison prose is excluded from stored traces.

The combined test now runs real P2/P3/P4 modules and the actual migration CLI twice (fresh apply and ledger idempotency), restarts API processes, and checks positive carrying charges, saved quote lookup, stale rates, five-minute expiry, logistics-only model fallback, deadline partial quotes, NoRoute and routing outages. External HTTP replies are synthetic. The separately configured live Gemini logistics/advocate protocol smoke passed on explicitly synthetic in-memory routing inputs and created no database records. The configured database already has migration 002 and its rate/version/quote schema. After ROUTING_BASE_URL was configured, a fresh live-provider check passed against a disposable local database with real OSRM/Gemini calls and persisted pending acceptance after restarting the API service.


Repeat the current live-provider check with `P4_TEST_DATABASE_URL=postgresql://... npm run api:integration-check` from api/. It creates/migrates/removes only a generated local database; it never writes the configured hosted DATABASE_URL. Actual routing and model calls are bounded. The live result was mode=live/searchComplete=true, 93,258.7 m original route, LKR 595.63 transport and LKR 17,004.37 estimated proceeds for the synthetic 80 kg sale. This is a tested integration example, not a shipment offer, verified heavy-truck route or production SLA.

## Authentication rebase

The latest rebase retains the session middleware, auth readiness tables and server-confirmed UI identity alongside scoped logistics/workflow wiring. HTTP integration suites and the provider check now sign in as each role and reuse sessions after restarting the API. Fixed business clocks remain deterministic; isolated test session expiry is set against PostgreSQL time. Browser workflow tests restore the farmer through /api/auth/me and verify bearer headers. Contract requests include named role logins. No tests, builds, migrations or provider checks were run during this rebase; the results above describe earlier verification.
