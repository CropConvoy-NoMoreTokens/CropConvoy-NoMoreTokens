# P4: workflow

Implements bounded generation, validated authoritative quote lookup, deterministic review, memory/PostgreSQL plan persistence, retrieval and conditional decisions. The factory preserves its first three arguments and accepts optional test/wiring ports. See [integration requirements](../../../../docs/handoffs/P4-INTEGRATION.md).

The app injects logisticsForGeneration(scopedDeps), so P3 external work uses request-scoped budgets. Explicit test adapters must provide that factory as well; unbounded custom logistics fails closed. P2 market/PostgreSQL/Gemini modules are integrated. P3 logistics is integrated through its factory, durable quote lookup and run diagnostics. Missing/unavailable routing returns an honest incomplete result; physical NoRoute rejections can complete normally.

The existing plans table stores full quote and source snapshots, review, expiry, mode and observable trace. Repositories validate on write/read, use parameterized SQL and conditional status updates, and never mutate listings/orders/trips. Acceptance re-reads current sources; repeat decisions remain idempotent after expiry.

Run npm test and npm run build from api/. Enable the disposable PostgreSQL/process-restart check with P4_TEST_DATABASE_URL. Never point it at an unapproved database. The plan repository check isolates records in a generated schema. The combined P2/P4 HTTP check additionally requires a local PostgreSQL role with CREATE DATABASE permission and creates/drops only its own generated test database. Its Gemini HTTP replies and road/logistics outputs are explicitly synthetic.

Quotes and plans are bounded by authoritative expiry; service and conditional SQL updates enforce both. Cumulative diagnostics are deduplicated and model explanation prose is replaced with fixed public outcomes. On the soft search deadline, already saved P3 quotes can still be loaded/persisted within the hard deadline.
