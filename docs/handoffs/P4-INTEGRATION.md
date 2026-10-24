# P4 integration handoff

Implemented in branch feat/p4-persisted-advocate-workflow. This file is a concrete request to the other owners; it does not imply they have approved or implemented these changes. No external messages were sent.

P2:

- Keep app.ts, dependencies, migration and packages under your ownership. P4 needs no additional dependency or migration: it uses the initial plans table and injected Database.
- Once your market repositories and P3 are real, set persistence=postgres only when all repositories are durable. Wire `createWorkflowService(deps, market, logistics, { logisticsForGeneration: scopedDeps => createLogisticsService(scopedDeps) })`. If P3 uses a separate repository factory, pass the same durable repository into both logistics instances. Never capture the unscoped deps in external work.
- Extend scripts/export-contracts.ts to include listingSchema, orderSchema, tripSchema, quoteSnapshotSchema, planSchema and generationResultSchema. P4 supplies a supplemental exporter until that owner change lands.
- Normalize advocate model output to the tool-call object in docs/CONTRACTS.md. No raw provider reasoning or credentials belong in results or traces.
- Current Database/MarketRepository/LogisticsService read methods lack cancellation. Add signal-aware adapters or server-side query timeouts. P4 already bounds response time using abort races, but a late insert can persist after the response deadline.
- Backend hosting is Render, with api as service root, Node 24, npm ci && npm run build, npm start, and same-region Render Postgres. See DEPLOYMENT.md.

P3:

- getQuote currently has no backing store in the starter. Implement authoritative lookup and shared persistent quote/trip storage before live generation; send any quote-table migration to P2.
- Confirm canonical ruleOutcomes keys in CONTRACTS.md. P4 fails closed if any required key is missing/false; no claim is made that these new keys have already been agreed.
- All generation model/routing calls must use injected scoped dependencies and the evaluate AbortSignal. Preserve source IDs, full base/modified road geometry and safe integer amounts. extraTimeS includes operational overhead.
- Two batches share six routing calls, two concurrent routes, and two total logistics model turns. Persist each valid quote before returning its summary. No routes are fabricated during provider outage.

P1:

- Synthetic full envelopes are in contracts/fixtures/workflow-responses.json. Use plan.quoteSnapshot for fare/gross/net and pending-confirmation language after acceptance.
- Empty complete searches and incomplete/deadline results are distinct. Workflow envelope mode now follows generation/stored plan mode, including deterministic_fallback.
- Missing plan=404; expired/stale/conflicting decision=409. Same decision is idempotent; no quantities are reserved.

Validation: run npm test and npm run build in api/. Set P4_TEST_DATABASE_URL to an authorized disposable local database for the PostgreSQL test. It creates/drops only its own randomly named schema, runs the existing migration there, reads a saved plan in a separate Node process, and tests competing decisions with independent workflow instances. Market/logistics remain injected fakes in that test; the real provider-backed end-to-end gate remains with P2/P3 integration.


Follow-up migration fix requested by the user: scripts/migrate.ts now uses scripts/migration-connection.ts to allow at least 2 seconds per Node address attempt and 20 seconds for connection setup, preserving TLS verification and cleaning up failed connections. The hosted Neon migration command was verified successfully. P2 should account for the same cross-region connection timing when implementing shared API PostgreSQL adapters; no app.ts/dependencies.ts wiring was changed by this fix.


UI rebase follow-up: P4 integrated the new frontend with the proposal sourceSnapshot/mode fields and an additive optional Plan.searchComplete field. New plans persist that field in the existing review JSONB; old plans remain readable with unknown completeness. No migration or shared wiring edit is needed. Frontend plan warnings/locations/minimums, fallback metadata, regeneration URLs and expiry/conflict controls are covered by full-response fixture tests. The default HTTP API still uses P2/P3 stubs; these UI changes do not turn simulated proposals into live quotes.
