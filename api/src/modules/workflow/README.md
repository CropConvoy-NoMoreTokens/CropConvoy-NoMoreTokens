# P4: workflow

Implements bounded generation, validated authoritative quote lookup, deterministic review, memory/PostgreSQL plan persistence, retrieval and conditional decisions. The factory preserves its first three arguments and accepts optional test/wiring ports. See [integration requirements](../../../../docs/handoffs/P4-INTEGRATION.md).

P2 must inject logisticsForGeneration(scopedDeps) for non-stub candidates so P3 uses request-scoped external-call budgets. Generation fails closed without it. The existing app still wires stub market/logistics; this module does not represent that as a completed search.

The existing plans table stores full quote and source snapshots, review, expiry, mode and observable trace. Repositories validate on write/read, use parameterized SQL and conditional status updates, and never mutate listings/orders/trips. Acceptance re-reads current sources; repeat decisions remain idempotent after expiry.

Run npm test and npm run build from api/. Enable the disposable PostgreSQL/process-restart check with P4_TEST_DATABASE_URL. Never point it at an unapproved database. The test isolates all records in a generated schema and drops only that schema.
