# Starter status

Update this file as each owner replaces their stubs.

| Area | Current implementation | Remaining / owner |
|---|---|---|
| Repository | Independent api/web packages, lockfiles, ignore rules and handoffs | Team baseline commit/push |
| API | Express routes, body validation/limit, CORS, request IDs, per-process rate limiting, error envelope | Hosting-specific proxy configuration, request timing / P2 |
| Health | /health works; /ready refuses memory-only app | Real readiness after DB repositories / P2 |
| Contracts | Zod request/initial-result validators, TypeScript domain types, schemas, fixtures, HTTP examples, getQuote handoff | Full quote/plan runtime validators / P4 |
| Listings/orders | Validated create/read in temporary memory with server UUIDs | PostgreSQL repositories and seed / P2 |
| Extraction/market | Null draft and empty candidate stubs | Live model tools, deterministic matching/fallback / P2 |
| Database | Initial four-table SQL and transactional once-only migration runner | Execute against PostgreSQL; repository mapping / P2 plus module owners |
| Trips/routing | Empty list and explicit 503 create stub; routing dependency interface | Provider/corridor validation, persistence, route feasibility / P3 |
| Pricing | Integer minor-unit detour calculation with baseline tests | Integrate into validated quote snapshots / P3 |
| Advocate | Explicit BACKEND_PENDING no-plan response | Grounded full-snapshot review and model tools / P4 |
| Workflow | Connected module stubs and propagated timeout signal; incomplete empty result | Enforced deadline/budgets, partial results, persisted real plans / P4 |
| Decisions | Input validation plus 503 stub | Expiry/source validation, idempotency and conditional updates / P4 |
| Frontend | Role shell, API helper, connection check and stub notice | Forms, maps and full demo screens / P1 |
| Deployment | Documented roots, commands and environment examples | Actual hosting/resources and browser/restart checks / P1/P2 |

The reference plan describes the target behavior. This status file describes the actual starter. No external resources were created; no credentials were required. Stub listing/order data disappears on restart. No seed route or LLM call is represented as live.

## Baseline verification

- API TypeScript production build: passed.
- API tests: 4 passed (HTTP validation/stub behavior and three fare cases).
- Web TypeScript/Vite production build: passed.
- Built API startup and /health smoke check: passed.
- Contract JSON Schema export and local Markdown link checks: passed.
- PostgreSQL migration execution, live LLM/routing, deployed browser flow and persistence restart check: not run; require implementation and external service configuration.
