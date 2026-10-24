# Integration status — 24 October 2026

The dev branch integrates sm-fixes proposal history, buyer/driver approvals and workspace tabs with the existing harvest photo upload, Sinhala location lookup and persisted workflow. Farmer listing ownership comes from the authenticated session. Browser request logging remains disabled. The latest main navigation, breadcrumbs, dark theme and inline fallback notices are integrated while preserving the workspace tabs and approval/history screens.

| Area | Integrated behavior | Remaining |
|---|---|---|
| Frontend | Role workspaces, source snapshot pins/minimums, versioned carrying/detour breakdown, fallback/partial status, expiry/conflict controls | Hosted browser verification |
| Market/model | PostgreSQL listings/orders, evidence-checked extraction, filtered buyer search, normalized Gemini tools and explicit fallback | Provider availability remains environment-dependent |
| Logistics | Configurable real OSRM adapter, road/stop/constraint checks, weight-distance-v2 fare and durable quotes | Approved provider capacity and deployment configuration |
| Advocate | Integer money/component verification, minimum-net rules, validated quote IDs and best evaluated feasible net | No global-optimum or confirmed-booking claim |
| Workflow | Scoped shared budgets, logistics diagnostics, quote-bounded expiry and saved partial plans | Physical SQL cancellation remains limited by the injected DB interface |
| Decisions | Source/price re-read, legacy tariff rejection, quote/plan expiry in conditional updates, idempotency and 409 conflicts | Hosted approval-flow verification |
| Database | Ordered migration ledger; initial, demo-auth and logistics migrations required; configured database already has tariff and quote schema | Review future schema/legacy tariff upgrades through migrations |
| Authentication | PostgreSQL demo sessions, server-confirmed actor IDs, role/owner checks and API-mode login | Private registration and production identity management |
| Deployment | Render API and Vercel UI guidance | Hosted end-to-end/proxy verification |

## main integration verification

Merged main commit `1e928c1` into dev. Both production builds passed on Node 24; all 85 API tests passed with PostgreSQL integration enabled and no skips; all 74 frontend tests passed. The contract exporter produced no schema changes. Database checks used synthetic provider responses and a disposable local cluster, which was stopped and cleaned up. Hosted data, deployment settings and remote branches were not changed.

## sm-fixes integration verification

Both independent production builds passed on Node 24. All 85 API tests passed with the local PostgreSQL suites enabled and no skips; all 72 frontend tests passed. The database tests cover fresh/repeated migrations, durable quotes/plans/history, role/owner projections, process restarts, repeated/conflicting approvals, competing bookings, exact quantity exhaustion and rollback on allocation failure. Provider responses are synthetic. The disposable PostgreSQL cluster is stopped and its generated data is removed; no hosted records were modified.

Migration `003_booking_approvals.sql` must be applied through `npm run db:migrate` before restarting the deployed API. Pending farmer acceptance reserves nothing; final confirmation after both buyer and driver approval allocates quantities transactionally. No push or deployment was performed.

## Previous auth rebase

Preserved demo authentication together with P3 logistics and P4 workflow wiring. HTTP integration helpers use authenticated roles and server-confirmed actor IDs. Tests and builds were not run for this rebase, as requested; the verification below records earlier work and must be repeated manually.

## Previous verification (before this rebase)

- All 43 frontend tests and both independent production builds passed on Node 24; API tests, fixtures and integration/migration scripts type-checked.
- All 72 API tests passed on Node 24, with every PostgreSQL suite enabled and no skips. Tests cover both migrations, old tariff upgrades, actual P2/P3/P4 services, persisted quotes/plans, separate API processes, repeated/conflicting/stale/expired decisions, model/routing outages and partial results at deadline.
- The combined automated tests fake only external Gemini/OSRM HTTP responses, not the production logistics/business repositories. Long model prose is excluded from persisted trace output; cumulative diagnostics are deduplicated.
- A bounded live Gemini logistics/advocate protocol check passed using explicitly synthetic in-memory routing fixtures and no database writes.
- A second live check used the configured real routing and Gemini services with a disposable local PostgreSQL database: 93,258.7 m original road route, 15,351.8889 m carrying segment, LKR 595.63 transport and LKR 17,004.37 proceeds for the explicitly synthetic 80 kg / LKR 220 per kg test sale. It returned live/complete, recorded farmer_accepted_pending_confirmations, retained the same quote after a new API instance/pool, and left stock/demand/capacity unchanged. The generated local database was removed. No hosted records were written.
- The configured database already has migration 002, logistics_quotes and rate/version columns; no hosted migration was applied by this task.

Repeat the real-provider check from api/ with a dedicated local PostgreSQL URL in P4_TEST_DATABASE_URL: npm run api:integration-check. It requires CREATE DATABASE permission locally, uses the configured provider credentials, and drops only its generated local test database. Do not point test-write suites at an unreviewed hosted/production database.
