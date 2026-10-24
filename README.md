# CropConvoy

Starter for a four-person, six-hour harvest-to-buyer matching prototype. The project is structured so frontend, market/platform, logistics, and workflow work can start simultaneously.

**Current state:** P2 market/extraction, P3 logistics and P4 advocate/workflow are integrated with the role-based UI. PostgreSQL persists listings, orders, trips, authoritative quotes and plans. Generation validates real routing responses, applies the weight-distance-v2 tariff, checks the farmer minimum and preserves bounded-search/fallback status. Acceptance records pending buyer/transporter confirmations, never a booking. Live road generation requires a configured approved ROUTING_BASE_URL; no default road provider or synthetic route fallback is supplied. API mode uses database-backed sessions and role/owner checks for three predefined public demo accounts; see [the auth handoff](docs/handoffs/P2-AUTH-INTEGRATION.md). Private registration and hosted deployment remain outside the prototype.

## Start locally

Use Node 24 and npm. API and web have independent packages and lockfiles; there is intentionally no root npm workspace.

Terminal 1:
```powershell
cd api
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Terminal 2, starting at the repo root:
```powershell
cd web
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Do not overwrite an existing .env. On macOS/Linux use `cp .env.example .env` when creating it for the first time.

Open http://localhost:5173. The rebased UI defaults to an interactive browser demo with explicitly simulated proposals. To use the backend, set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL=http://localhost:3001` in web/.env, then restart Vite and sign in with a public demo account. Apply all database migrations first. API health is http://localhost:3001/health. `/ready` checks the source/plan/quote tables, auth tables and carrying-rate column when PostgreSQL is configured, and returns 503 for missing migrations or memory mode. Configure ROUTING_BASE_URL and ROUTING_PROFILE in api/.env for real road requests.

## Structure

```text
api/
  db/migrations/                    # PostgreSQL bootstrap, auth and logistics migrations
  scripts/                            # P2: migration and schema export tools
  src/
    app.ts                            # P2: single route registration point
    server.ts                         # P2: config, startup, shutdown
    core/                             # P2: adapters, errors, config, HTTP
      contracts.ts                    # P4: agreed types and Zod schemas
    modules/
      market/                         # P2: extraction, orders/listings, search
      logistics/                      # P3: trips, road routing, feasibility, fare
      advocate/                       # P4: farmer minimum and grounded review
      workflow/                       # P4: coordination, plans, decisions
  test/                               # P4: HTTP/integration checks
web/
  src/api/client.ts                   # P1: shared browser API helper
  src/App.tsx                         # P1: landing, login and role workspaces
contracts/                            # P4: fixtures, generated schemas, requests
docs/
  CONTRACTS.md                        # Team interface agreement
  IMPLEMENTATION-PLAN.md              # Supplied six-hour reference plan
  PARALLEL-WORK.md                    # Branch, ownership, merge instructions
  DEPLOYMENT.md                       # Render/Vercel handoff
  STATUS.md                           # What works and what remains
  handoffs/P1-FRONTEND.md
  handoffs/P2-MARKET-PLATFORM.md
  handoffs/P3-LOGISTICS.md
  handoffs/P4-WORKFLOW-ADVOCATE.md
```

## Give teammates their instructions

Share [the parallel-work guide](docs/PARALLEL-WORK.md), [contracts](docs/CONTRACTS.md), and the matching handoff:

| Owner | Handoff | Boundary |
|---|---|---|
| P1 frontend | [P1](docs/handoffs/P1-FRONTEND.md) | web/** |
| P2 market/platform | [P2](docs/handoffs/P2-MARKET-PLATFORM.md) | market, core except contracts.ts, DB, API configuration |
| P3 logistics | [P3](docs/handoffs/P3-LOGISTICS.md) | modules/logistics/** |
| P4 advocate/workflow | [P4](docs/handoffs/P4-WORKFLOW-ADVOCATE.md) | advocate, workflow, contracts, integration tests |

Each handoff includes a copyable task for a teammate or coding assistant. Start from the same baseline commit. Do not wait for another owner to finish: inject fakes against the exported interfaces. Contract changes require a quick agreement, not a second competing definition.

## Validate

From api/: `npm test`, `npm run build`, `npm run contracts:export`. The existing exporter includes P4 quote/plan/generation schemas. Set `P4_TEST_DATABASE_URL` to a disposable local PostgreSQL database to enable persistence/process-restart integration checks. The combined P2/P3/P4 HTTP test requires a local role with CREATE DATABASE permission; it creates and drops only its uniquely named test database and runs real modules while mocking only external model/routing HTTP responses. Also set LOGISTICS_TEST_DATABASE_URL to enable P3 database/upgrade tests.

From web/: `npm run build`.

For database setup, read [api/db/README.md](api/db/README.md) and run `npm run db:migrate` from api/ only after configuring DATABASE_URL. Migration execution is separate from server startup.

## Scope guardrails

- One listing, one order, one trip per proposal; entire listing quantity, no splitting.
- LKR minor units: Rs. 220/kg is 22000, not 220. API dates are UTC ISO strings ending in Z; display Asia/Colombo.
- The weight-distance-v2 fare includes weight × original-route carrying distance × kg-km rate, plus extra-detour rate, base and handling. Legacy rates are never silently converted.
- Real road geometry is required before any live transport quote. Fixture coordinates are not a verified corridor.
- Model suggestions cannot override crop, quantity, capacity, date, detour, or net-proceeds rules.
- Farmer acceptance records pending buyer/transporter confirmations. No payments, stock reservation, live GPS, or production identity management is implemented. The predefined demo credentials are public.
- Use synthetic data. Keep stub/fallback status visible and secrets on the server.

Pinned dependencies are recorded in each package and lockfile. Implementation references: [Express](https://expressjs.com/en/starter/installing/), [Vite](https://vite.dev/guide/), [Zod](https://zod.dev/basics), [node-postgres](https://node-postgres.com/features/queries). See the supplied plan for routing/deployment references; provider access and corridor validation remain kickoff work.
