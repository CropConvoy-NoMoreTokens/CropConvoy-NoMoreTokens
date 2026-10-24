# P2 — market/platform handoff

## Your task (copy to your teammate or coding assistant)

Implement market and shared backend infrastructure. You own api/src/modules/market/**, api/src/core/** except contracts.ts, app.ts, server.ts, api/db/**, api/scripts/**, API packages/lockfile/config. P4 owns core/contracts.ts and the reference contract pack. Read docs/CONTRACTS.md first and keep the existing exported module boundaries working.

Replace the temporary MarketRepository with parameterized PostgreSQL queries. Bootstrap 001_initial.sql once using the migration script; map DB snake_case, timestamp and bigint values to safe typed API responses. Collect P3/P4 schema requirements immediately. Do not implement their repositories for them or reset data at startup.

Implement the shared LlmClient adapter using the provider the team already has access to. Validate the real model ID and tool-calling capability early. Coordinate any interface changes with all backend owners. Propagate AbortSignal/timeouts, validate tool names/arguments/results, bound model turns, and never log credentials. P3 can use a fake adapter until this is ready.

Implement extractHarvest with schema-constrained output, null/missing fields and useful questions. Do not guess a missing price, quantity or exact date. Use explicit localTimeContext; always require farmer confirmation via the publish endpoint. During planning, implement searchOrders tools and findMarket: validate listing and candidate IDs, exact crop, sufficient remaining demand, availability and agreed partial-fill policy; return at most three existing order IDs. Add prompt.ts/tools.ts, fixtures and rejection tests in your module. LLM failure should allow clearly labeled manual entry/deterministic matching, not disguised fixture reasoning.

Wire the adapters supplied by P3 and services supplied by P4 in app.ts/dependencies.ts. Switch persistence metadata/readiness only after repositories are truly PostgreSQL-backed. API_STUBS=false currently fails closed on unfinished modules; setting it is not an implementation. Add deployment configuration as needed. Verify the hosting proxy topology before configuring Express trust proxy/rate limiting. Deploy Render only with the team lead's hosting authorization.

## First slice

- `npm ci`, copy .env.example if no .env exists, run `npm run dev` from api/.
- Run `npm test` and `npm run build` to establish a baseline.
- Confirm DB tables/quote needs with P3/P4, apply migration to a dev database and connect listing/order CRUD.
- Send working health/base URL and environment changes to P1.

## Done when

Confirmed listings/orders persist after restart; extraction asks for missing values; candidate IDs are real and code-filtered; adapter timeouts/fallbacks are honest; API builds and its meaningful tests pass. Verify DATABASE_URL/LLM secrets never reach VITE_ variables. Provide an idempotent synthetic seed once P3 has a real tested route.
