# P2/P4 integration handoff

Current branch: feat/p4-persisted-advocate-workflow, rebased on dev with P2 market/platform work. Integration changes preserve the exported module interfaces; no P2 market business implementation or P3 logistics module was rewritten. No external owner messages were sent.

## Integrated

- Advocate validates P2's normalized `{name:'review_quotes', arguments:{selectedQuoteId,requestAlternative}}` response from the real Gemini adapter. The adapter sends full Zod schemas through parametersJsonSchema to preserve UUID/null/strict-object definitions. Unknown tools/IDs or lower-net choices still fail closed with at most one repair.
- Workflow uses P2's exported marketUsedFallback helper and preserves fallback in its observable trace, generation mode and persisted plan. Route handlers set res.locals.responseMode, matching P2's shared reply helper.
- app.ts supplies request-scoped logistics dependencies to the existing P3 factory. Optional logistics/factory injection supports integration tests; production still uses P3's exported service. Custom unbounded test wiring fails closed.
- P2 listing/order and P4 plan repositories use the injected PostgreSQL adapter. The shared API/migration connection configuration fixes cross-region address timeouts while retaining TLS verification. API pooling retains normal concurrency.
- The existing contracts:export script now includes source, quote, plan and generation schemas. The old supplemental exporter remains compatible but is not required.
- P1's UI already supports full quote snapshots, source pins/minimums, fallback metadata, incomplete-search warnings, expiry/conflict handling and pending-confirmation language. Production services do not import the reference pack.
- The latest dev authentication is preserved: PostgreSQL-backed routes require role/owner-checked bearer sessions, source actor IDs come from server-confirmed identities, and auth tables remain part of readiness. HTTP/process-restart tests and the provider smoke now authenticate all three roles and reuse sessions after restart; browser workflow tests restore API identity before loading a plan. Request examples and the contract agreement describe the same boundary. Tests/builds were not run for this rebase, as requested.

## P3 integration complete

P3 routing/trip/quote repositories and diagnostics are now integrated through existing exports. Shared contracts and frontend fields require weight-distance-v2. The combined application preserves canonical hard rules, both monetary components, authoritative quote expiry and fallback/completeness diagnostics. Full model explanation prose is excluded from stored traces. Deadline handling gives P3 bounded time to return already saved partial quotes, followed by P4 snapshot retrieval/persistence; no new model/routing work starts after the search deadline.

The scoped wrapper still enforces six total routing calls, two concurrent routes, two model turns per role, one alternative batch and a maximum 45-second overall response deadline. Both missing providers and provider outages are explicit failures/incomplete results, never fabricated geometry. Migrations 001/002 are required; old tariffs are excluded and never reinterpreted.

## Verification

Run npm test and npm run build from api/, and npm test / npm run build from web/ with Node 24. Set P4_TEST_DATABASE_URL only to an authorized disposable database for database tests. The combined P2/P4 HTTP/process-restart test requires a local PostgreSQL role with CREATE DATABASE permission: it creates and drops only its own randomly named test database. It exercises the real app, market repositories/matching, Gemini response parser, advocate and workflow; Only external Gemini/OSRM HTTP replies are controlled test fakes in the combined flow; all business modules and repositories execute. Other persistence tests isolate their records in a generated schema. No hosted data is modified by these tests.

The Database interface still cannot physically cancel a running SQL query. P4 bounds response time with abort races, but an uncancellable insert may finish after the response deadline. Source quantities are never reserved or decremented, and acceptance remains farmer_accepted_pending_confirmations.

The new api:integration-check command separately exercised real configured routing and Gemini providers against a generated local database. It verified proposal/quote persistence, pending acceptance and unchanged source quantities after an API service restart. The test database is removed; no hosted records are written.
