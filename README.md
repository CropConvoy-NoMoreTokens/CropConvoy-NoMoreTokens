# CropConvoy

Starter for a four-person, six-hour harvest-to-buyer matching prototype. The project is structured so frontend, market/platform, logistics, and workflow work can start simultaneously.

**Current state:** P1's UI, P2's PostgreSQL/Gemini market API, P3's route-aware logistics, and P4's persisted proposal workflow are integrated. With `DATABASE_URL` configured and migrations applied, API mode signs in through three predefined public demo accounts; see [the auth handoff](docs/handoffs/P2-AUTH-INTEGRATION.md). Production routing, private user registration, and hosted deployment remain unconfigured.

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

Open http://localhost:5173 and choose **Check connection**. API health is http://localhost:3001/health. Local stub mode works without keys or PostgreSQL. API mode requires PostgreSQL, applied migrations and demo login; `/ready` returns 503 when required tables are missing.

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

From api/: `npm test`, `npm run build`, `npm run contracts:export`, then `node --import tsx src/modules/workflow/export-contracts.ts` for the P4 result schemas until P2 folds them into the existing exporter. Set `P4_TEST_DATABASE_URL` to a disposable local PostgreSQL database to enable the persistence/process-restart integration check.

From web/: `npm run build`.

For database setup, read [api/db/README.md](api/db/README.md) and run `npm run db:migrate` from api/ only after configuring DATABASE_URL. Migration execution is separate from server startup.

## Scope guardrails

- One listing, one order, one trip per proposal; entire listing quantity, no splitting.
- LKR minor units: Rs. 220/kg is 22000, not 220. API dates are UTC ISO strings ending in Z; display Asia/Colombo.
- Real road geometry is required before any live transport quote. Fixture coordinates are not a verified corridor.
- Model suggestions cannot override crop, quantity, capacity, date, detour, or net-proceeds rules.
- Farmer acceptance records pending buyer/transporter confirmations. No payments, stock reservation, live GPS, or production identity management is implemented. The predefined demo credentials are public.
- Use synthetic data. Keep stub/fallback status visible and secrets on the server.

Pinned dependencies are recorded in each package and lockfile. Implementation references: [Express](https://expressjs.com/en/starter/installing/), [Vite](https://vite.dev/guide/), [Zod](https://zod.dev/basics), [node-postgres](https://node-postgres.com/features/queries). See the supplied plan for routing/deployment references; provider access and corridor validation remain kickoff work.
