# Integration status — 24 October 2026

The dev branch also includes the synthetic-data Insights price/planting extension, served by a separate CPU/CUDA Python service through the Node /api/ml proxy.

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

## Separate CPU ML service and proxy

The Node API now proxies five fixed public Insights endpoints to ML_API_BASE_URL and authenticates upstream with a server-only ML_API_KEY. Local api/.env points to http://localhost:8001; the browser uses only VITE_API_BASE_URL. Inputs and upstream schemas are validated, response memory/deadlines are bounded, and marketplace authentication remains separate. CPU is the default serving device; CUDA configuration still rejects unexpected fallback. No retraining or dataset changes were performed.

Local validation: 88 API tests passed with PostgreSQL enabled and no skips; 92 frontend tests passed; all 74 ML tests passed on CPU, including the 108 forecast combinations. Both production builds passed. A separate-process check ran the compiled Node server against the actual key-protected CPU ML server and verified health, catalog, history, forecast and planting results. Shared-key failure, invalid payloads, redirects, model outages and timeout handling are covered. No hosted records or infrastructure were changed. Render free-tier memory/latency remain to be verified on deployment; see ML-DEPLOYMENT.md.

## Previous Price-Prediction integration verification

Merged feat/Price-Prediction commit `e50807e` into dev. Both independent production builds passed on Node 24. All 85 API tests passed with PostgreSQL integration enabled and no skips; all 88 frontend tests passed. The marketplace contract export remained unchanged.

Installed the pinned ML dependencies in a temporary Python 3.12 environment. Twenty-two hardware-independent ML tests passed; fifty tests requiring the CUDA fixture were deselected because this Mac has no NVIDIA GPU. Native service startup confirmed predictions return 503 while history remains accessible. GPU inference, training and hosted ML deployment were not verified.

Fixed a cross-platform startup error: training recorded dataset hashes using Windows CRLF bytes, while Git checks out LF. Dataset hashes now use a versioned LF normalization shared by training and serving; both CSVs are verified. The old hashes were confirmed to match exactly the same CSV observations with CRLF. Model/preprocessor bytes, data observations and evaluation scores were not changed. Added integrity, changed-data, unavailable-service and calendar regression tests.

The temporary PostgreSQL cluster and Python environment were cleaned up; hosted records were untouched. Hosted Insights requires a separate CUDA service, its frontend CORS origin, and Vercel VITE_ML_API_BASE_URL pointing to its HTTPS endpoint. The Node Render service does not host predictions. No push or deployment was performed.

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
