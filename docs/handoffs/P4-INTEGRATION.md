# P2/P4 integration handoff

Current branch: feat/p4-persisted-advocate-workflow, rebased on dev with P2 market/platform work. Integration changes preserve the exported module interfaces; no P2 market business implementation or P3 logistics module was rewritten. No external owner messages were sent.

## Integrated

- Advocate validates P2's normalized `{name:'review_quotes', arguments:{selectedQuoteId,requestAlternative}}` response from the real Gemini adapter. The adapter sends full Zod schemas through parametersJsonSchema to preserve UUID/null/strict-object definitions. Unknown tools/IDs or lower-net choices still fail closed with at most one repair.
- Workflow uses P2's exported marketUsedFallback helper and preserves fallback in its observable trace, generation mode and persisted plan. Route handlers set res.locals.responseMode, matching P2's shared reply helper.
- app.ts supplies request-scoped logistics dependencies to the existing P3 factory. Optional logistics/factory injection supports integration tests; production still uses P3's exported service. Custom unbounded test wiring fails closed.
- P2 listing/order and P4 plan repositories use the injected PostgreSQL adapter. The shared API/migration connection configuration fixes cross-region address timeouts while retaining TLS verification. API pooling retains normal concurrency.
- The existing contracts:export script now includes source, quote, plan and generation schemas. The old supplemental exporter remains compatible but is not required.
- P1's UI already supports full quote snapshots, source pins/minimums, fallback metadata, incomplete-search warnings, expiry/conflict handling and pending-confirmation language. Production services do not import the reference pack.

## Remaining P3 work

The rebased branch still contains stub logistics. Implement real trip/road routing, authoritative getQuote storage and a shared durable repository for default/scoped logistics instances. Confirm canonical ruleOutcomes and fare policy against CONTRACTS.md before enabling real quotes. Send new quote-table migrations through P2; the existing plans table needs no P4 migration.

The scoped wrapper enforces six total routing calls, two concurrent routes, two model turns per role, one alternative batch and a maximum 45-second overall response deadline. P3 must use its injected scoped dependencies/signal. Unfinished logistics produces an incomplete LOGISTICS_PENDING result; no road quote is fabricated.

## Verification

Run npm test and npm run build from api/, and npm test / npm run build from web/ with Node 24. Set P4_TEST_DATABASE_URL only to an authorized disposable database for database tests. The combined P2/P4 HTTP/process-restart test requires a local PostgreSQL role with CREATE DATABASE permission: it creates and drops only its own randomly named test database. It exercises the real app, market repositories/matching, Gemini response parser, advocate and workflow; Gemini HTTP replies and logistics/road geometry are controlled test fakes. Other persistence tests isolate their records in a generated schema. No hosted data is modified by these tests.

The Database interface still cannot physically cancel a running SQL query. P4 bounds response time with abort races, but an uncancellable insert may finish after the response deadline. Source quantities are never reserved or decremented, and acceptance remains farmer_accepted_pending_confirmations.
