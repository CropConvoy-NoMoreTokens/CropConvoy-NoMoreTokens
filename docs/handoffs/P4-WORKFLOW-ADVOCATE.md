# P4 — advocate/workflow handoff

## Your task (copy to your teammate or coding assistant)

Implement the farmer advocate, bounded workflow, persisted plans, decisions and integration checks. Own api/src/modules/advocate/**, modules/workflow/**, core/contracts.ts, contracts/**, API integration tests and docs/CONTRACTS.md. P2 owns shared infrastructure/wiring/packages/migrations. Read existing contracts and exported functions first. Work immediately against contracts/fixtures/module-results.json and injected module fakes.

Use the agreed LogisticsService.getQuote(quoteId) lookup from P3. LogisticsResult gives summary IDs; workflow loads full QuoteSnapshot records and passes ReviewInput with the listing and quotes into the advocate. Test against a fake LogisticsService immediately. Define runtime schemas for QuoteSnapshot, Plan and generation output. Review hard-rule outcomes and compute/verify money in code. Prefer highest feasible net within the evaluated bounded set; permit one alternative. Never promise a global optimum or accept an LLM-selected unknown quote ID.

Replace the skeleton generate function with at most two model turns per role, three buyer candidates, six routed combinations overall, one alternative attempt, bounded concurrency and a maximum 45-second total deadline. Pass AbortSignal to all external work, enforce the overall deadline, return evaluated partial results with searchComplete=false when appropriate, and distinguish stub/live/deterministic fallback. Persist the selected proposal, full quote snapshot, expiry, review and observable trace. No hidden chain-of-thought in traces. Add advocate prompt/tools and deterministic review implementations.

Implement plan repositories within your module using the injected DB. Send schema changes to P2. GET plan must survive restart. On acceptance, re-read listing/order/trip, compare current data with the authoritative stored quote and check expiry. Use a conditional state update: proposed → farmer_accepted_pending_confirmations or rejected. Repeating a decision returns the same state; a conflicting decision or stale/expired proposal gives 409. Do not decrement demand, stock or capacity and do not call it a booking.

Keep contracts and examples synchronized. Run contracts:export through P2's existing script after agreed Zod changes; services must build independently without importing the root reference pack. Ask P2 for shared service wiring instead of editing app.ts yourself.

## First slice

- Run existing tests, then use the shared fixture IDs with an injected fake clock.
- Review getQuote backing storage and required schema changes with P3/P2.
- Implement deterministic minimum-net review and plan persistence against fakes.
- Add safe decision behavior before connecting live model calls.

## Done when

Full generation/retrieval/decision works against real modules and PostgreSQL, including low proceeds, no-match, model failure, deadline, stale/expired plans, repeated decisions and conflicting decisions. Re-test after an API restart. Keep frontend-facing amounts grounded in stored snapshots; provide P1 with success/empty/error examples.
