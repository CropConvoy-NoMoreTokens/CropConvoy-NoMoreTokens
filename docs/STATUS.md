# Implementation status

Update this file as each owner replaces their stubs.

| Area | Current implementation | Remaining / owner |
|---|---|---|
| Repository | Independent api/web packages, lockfiles, ignore rules and handoffs | Team baseline commit/push |
| API | Express routes, body validation/limit, CORS, request IDs, per-process rate limiting, error envelope | Hosting-specific proxy configuration, request timing / P2 |
| Health | /health works; /ready refuses memory-only app | Real readiness after DB repositories / P2 |
| Contracts | Zod request/source/quote/plan/generation validators, generated schemas, synthetic module and P1 response examples | P2/P3 review of additive fields/rule keys and exporter consolidation |
| Listings/orders | Validated create/read in temporary memory with server UUIDs | PostgreSQL repositories and seed / P2 |
| Extraction/market | Null draft and empty candidate stubs | Live model tools, deterministic matching/fallback / P2 |
| Database | Initial four-table SQL and transactional once-only migration runner | Execute against PostgreSQL; repository mapping / P2 plus module owners |
| Trips/routing | Empty list and explicit 503 create stub; routing dependency interface | Provider/corridor validation, persistence, route feasibility / P3 |
| Pricing | Integer minor-unit detour calculation with baseline tests | Integrate into validated quote snapshots / P3 |
| Advocate | Deterministic full-snapshot rules/money review, best evaluated net, prompt/tool allowlist, two-turn repair/fallback | Real LLM adapter / P2 |
| Workflow | Bounded generation against injected modules, enforced deadline, partial results, memory/Postgres plan storage | Request-scoped logistics wiring and real market/logistics / P2/P3 |
| Decisions | Stored source/quote comparison, expiry, idempotent terminal states, conditional update and 409 conflicts; no quantities changed | Real source repositories / P2/P3 |
| Frontend | Role shell, API helper, connection check and stub notice | Forms, maps and full demo screens / P1 |
| Deployment | Render API/Postgres and Vercel web roots/commands/environment documented | Actual hosting/resources and provider-backed browser/restart checks / P1/P2 |

The reference plan describes the target behavior. This status file describes the actual starter. No external resources were created; no credentials were required. Stub listing/order data disappears on restart. No seed route or LLM call is represented as live.

## Baseline verification

- API TypeScript production build: passed.
- API tests: 4 passed (HTTP validation/stub behavior and three fare cases).
- Web TypeScript/Vite production build: passed.
- Built API startup and /health smoke check: passed.
- Contract JSON Schema export and local Markdown link checks: passed.
- PostgreSQL migration execution, live LLM/routing, deployed browser flow and persistence restart check: not run; require implementation and external service configuration.


## P4 verification

Implemented on feat/p4-persisted-advocate-workflow. The default app still has stub market/logistics and returns an explicitly incomplete empty search; trip creation remains 503. Missing plans now return 404. No external hosting resources were created. Application .env values are never printed or committed.

API production build passed on Node 24. All 26 API tests passed with PostgreSQL enabled, including the separate-process restart check. Contracts were regenerated through the existing exporter plus the supplemental P4 exporter.

Node 24 checks cover full workflow generation/retrieval/decisions against injected fakes, minimum proceeds, wrong model selections/failure, source freshness, expiry, concurrent/repeated/conflicting decisions, routing/model budgets, queued cancellation, deadlines and fallback HTTP metadata. A disposable PostgreSQL 15 database verifies real plan SQL, restart retrieval in a separate process and independent concurrent decisions. Real market/logistics/provider integration and deployed API restart remain unverified because those owners' modules are still stubs. See handoffs/P4-INTEGRATION.md for the exact owner requests.

Hosted database check, 24 October 2026: DATABASE_URL is configured in the ignored api/.env. DNS resolves, but connection attempts from the execution environment fail with ETIMEDOUT, including a retry configured with a 20-second connection timeout. No hosted migrations or test writes were performed. Hosted schema/persistence remains unverified. Configuring the URL alone does not change the default memory persistence adapter.


## Hosted migration connectivity fix — 24 October 2026

The earlier timeout is resolved for the migration command. System, Google and Cloudflare DNS agreed, and direct IPv4 TCP probes succeeded. Node's 250 ms automatic per-address connection timeout was too short on this connection: a read-only PostgreSQL probe succeeded after increasing it to 2,000 ms. The migration command now raises that timeout without lowering a larger operator setting, retains IPv4/IPv6 fallback, allows 20 seconds for overall connection setup, explicitly preserves strict TLS verification for sslmode=require, and closes the pool on connection failure.

The fixed npm run db:migrate completed against the configured Neon database with "Initial migration already applied". The application tables and migration ledger exist. Latest verification: API production build passed; 29 tests passed and the optional isolated PostgreSQL test was skipped in this run. This change fixes the migration command; API repository wiring and live module integration remain separate work.
