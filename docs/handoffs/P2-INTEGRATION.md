# P2 integration handoff

Demo database login and API authorization were added later on `feat/demo-auth`; see [P2-AUTH-INTEGRATION.md](P2-AUTH-INTEGRATION.md). P1's API-mode login and bearer headers are now integrated on the same branch.

P2 owns shared API wiring, environment, migrations, market, and the Gemini adapter. The P1 UI now calls the shared auth interface in API mode. P3/P4 modules and core/contracts.ts remain under their owners.

## Working local API

- Base URL: http://localhost:3001
- GET /health returns 200. GET /ready returns 200 when Neon and all four migrated tables are accessible.
- Listings and orders use PostgreSQL when DATABASE_URL is set. The initial migration was applied to the configured Neon database and verified with synthetic records after a Node 24 API process restart. The temporary check records were removed.
- POST /api/harvest/extract uses Gemini when API_STUBS=false and LLM_API_KEY / LLM_MODEL are set. Gemini 3.5 Flash-Lite passed model lookup, JSON output, and function calling checks. The originally configured Gemini 3.8 Flash model lookup worked, but generation timed out in this environment.
- GET /api/orders and POST /api/orders are ready for P1; POST /api/listings requires confirmed:true and GET /api/listings/:id retrieves the persisted row.
- Do not put DATABASE_URL or LLM_API_KEY in web/ or any VITE_ variable. P1 needs only VITE_API_BASE_URL=http://localhost:3001 for local work.

## P3/P4 integration requests

- P3: keep createLogisticsService and registerRoutes exports. Put the validated road RoutingClient factory in modules/logistics and send its export name/options to P2 for dependencies.routing wiring. Confirm whether getQuote needs a durable quotes table, including snapshot and expiry fields. The current four-table migration has no standalone quotes table; plans.quote_snapshot stores only selected proposals.
- P4: keep createWorkflowService and registerRoutes exports. Confirm any additional plans columns or indexes before P2 writes a second migration. Avoid editing the applied 001_initial.sql. The workflow already receives MarketRepository and LogisticsService in app.ts.
- P4: use the exported marketUsedFallback(result) helper when generation uses deterministic market fallback. Set the response mode to deterministic_fallback (reply reads res.locals.responseMode) and retain the fallback reasons in observable trace. Do not label a fallback plan live.
- P3/P4: agree quote lifetime and how LogisticsService.getQuote returns a full authoritative QuoteSnapshot. The existing contract has getQuote(quoteId), and P4 must use it before persisting a plan.
- Contract changes belong to P4 and require a quick agreement with affected owners. P2 can rerun npm run contracts:export after agreed changes.

No route provider or proxy topology is verified yet. Keep Express trust proxy at its default until the hosting topology is checked. Trip registration and plan generation remain P3/P4 stubs. Seed data awaits a real tested corridor from P3.
