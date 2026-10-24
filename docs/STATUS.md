# Integration status — 24 October 2026

integration/dev-logistics combines the frontend dev branch, P2 market/platform, P3 logistics and P4 workflow/advocate.

| Area | Integrated behavior | Remaining |
|---|---|---|
| Frontend | Role workspaces, map pins/routes, API adapters, kg-km rate input and fare breakdown | Hosted browser verification |
| Market | PostgreSQL listings/orders, extraction, filtered buyer search, labelled fallback | Live model validation in integrated environment |
| Logistics | Stored full routes, capacity/proximity/direction/road/timing checks, weight-distance-v2 fare and persistent quotes | Approved production routing provider |
| Advocate | Full-snapshot hard-rule checks, quantity-distance money verification and code-selected best evaluated net | Live integrated model check |
| Workflow | Request-scoped budgets, validated handoff, quote-bounded expiry, persistent plans, source freshness and conditional decisions | Hosted restart verification |
| Database | Ordered migration ledger; 001 + 002 tested on dedicated local PostgreSQL | Apply reviewed migrations to team deployment database |
| Readiness | PostgreSQL source/plan/quote tables and kg-km tariff column required | Hosting proxy topology configuration |
| Authentication | Demo role chooser only | Real identity/authorization outside MVP |
| Deployment | Railway API/database and Vercel setup documented | Not deployed or pushed by this integration |

Verification: 62 backend tests passed including optional PostgreSQL suites; 35 UI tests passed; API and UI production builds passed. Browser API-mode test used a real stored road route and generated a proposal, recorded farmer acceptance, and preserved it after an API restart. The local model adapter was intentionally unconfigured, so AI results were labelled deterministic fallback.

See LOCAL-INTEGRATION.md for exact scope, test environment, commands and limitations. Prior individual-branch provider checks are not treated as evidence that this local integration has a live model connection.
