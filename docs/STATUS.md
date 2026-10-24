# Starter status

Update this file as each owner replaces their stubs.

| Area | Current implementation | Remaining / owner |
|---|---|---|
| Repository | Independent api/web packages, lockfiles, ignore rules and handoffs | Team baseline commit/push |
| API | Express routes, body validation/limit, CORS, request IDs and timings, per-process rate limiting, error envelope | Hosting-specific proxy configuration after topology check / P2 |
| Health | /health works; /ready checks all four migrated PostgreSQL tables when configured; Neon readiness verified over HTTP | Hosted proxy topology and deployment check / P2 |
| Contracts | Zod request/initial-result validators, TypeScript domain types, schemas, fixtures, HTTP examples, getQuote handoff | Full quote/plan runtime validators / P4 |
| Listings/orders | Validated create/read using PostgreSQL when DATABASE_URL is set; persisted through an API process restart; temporary memory remains for keyless stub mode | Idempotent synthetic seed after P3 validates a real route / P2/P3 |
| Extraction/market | Gemini adapter, constrained extraction, missing-field questions, code-filtered order IDs, deterministic fallback; live Gemini 3.5 Flash-Lite and Neon checks passed | Integrate P3/P4 flow when ready |
| Database | Four-table migration applied to configured Neon database; listing/order persistence verified after reconnect | P3/P4 implement their own repository persistence |
| Trips/routing | Empty list and explicit 503 create stub; routing dependency interface | Provider/corridor validation, persistence, route feasibility / P3 |
| Pricing | Integer minor-unit detour calculation with baseline tests | Integrate into validated quote snapshots / P3 |
| Advocate | Explicit BACKEND_PENDING no-plan response | Grounded full-snapshot review and model tools / P4 |
| Workflow | Connected module stubs and propagated timeout signal; incomplete empty result | Enforced deadline/budgets, partial results, persisted real plans / P4 |
| Decisions | Input validation plus 503 stub | Expiry/source validation, idempotency and conditional updates / P4 |
| Frontend | Role shell, API helper, connection check and stub notice | Forms, maps and full demo screens / P1 |
| Deployment | Documented roots, commands and environment examples | Actual hosting/resources and browser/restart checks / P1/P2 |

The reference plan describes the target behavior. The P2 migration was applied to the configured Neon database. The persistence check used synthetic records and removed them afterward. No route seed or LLM call is represented as live.

## Baseline verification

- API TypeScript production build: passed with Node 24.
- API tests: 12 passed with Node 24 (HTTP validation/stub behavior, fare math, Gemini tool validation, market rejection/fallback, extraction evidence checks, and repository mapping).
- Web TypeScript/Vite production build: passed.
- Built API startup and /health smoke check: passed.
- Contract JSON Schema export and local Markdown link checks: passed.
- PostgreSQL migration, listing/order persistence after a Node 24 API process restart, and /ready over HTTP: passed against configured Neon database. Synthetic check records were removed.
- Gemini model lookup, structured output, tool call, live extraction HTTP, and code-filtered live market matching: passed with Gemini 3.5 Flash-Lite. Routing and deployed browser flow: not run; require remaining team integrations.
