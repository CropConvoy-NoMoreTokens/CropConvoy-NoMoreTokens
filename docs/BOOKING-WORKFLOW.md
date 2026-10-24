# Saved proposals and three-party approvals

Implemented locally. This document supersedes older notes that describe buyer/driver confirmations as unimplemented.

## Enable the new database schema

From api/, run `npm run db:migrate`, then restart the API. Migration 003 is required; readiness checks its unique active-listing index. Restart/refresh the frontend after pulling these changes. Environment secrets remain server-only.

Migration preserves saved plans, backfills pending buyer/driver decisions for historical farmer acceptances, resolves expired/duplicate active records, and permits zero remaining kg. Unknown historical acceptance timestamps remain unknown. Do not edit or re-run migration SQL manually outside its migration ledger.

## User flow

1. Farmer generates a proposal and accepts it before its quote deadline.
2. The matching buyer and driver open Approvals → Pending and review its details. Each explicitly approves or rejects.
3. First approval records only that actor's agreement. Both approvals plus a final successful availability check confirm the booking.
4. Confirmation atomically reduces buyer demand and vehicle capacity, marks the harvest booked and closes the trip. This version supports one shipment per trip even if kg remain.
5. Farmer opens My harvests → Open harvest → Proposal history → Open proposal to find decisions again after login or API restart. The harvest card also shows its latest saved proposal status.
6. Buyers/drivers find completed, declined, expired and unavailable proposals under Approvals → History. Manual refresh reloads state from PostgreSQL.

Pending decisions do not reserve resources. Another booking may make a pending proposal unavailable. The server checks this again under locks. An unchanged retry returns the saved result without deducting capacity twice. Conflicting repeats return 409. Post-confirmation cancellation, payments, pooled loads and live tracking are not included.

## Expiry and stored prices

Approval must finish before the existing plan/quote deadline and pickup time. Accepting does not extend a quote. Expired/pending results stay discoverable, and confirmed bookings remain confirmed after the original quote expiry. History summaries tolerate older pricing; incompatible legacy details remain read-only and require regeneration.

## APIs

- GET /api/plans?listingId=UUID&status=all|pending|history&limit=20&cursor=… returns `{items,nextCursor,pendingCount}` in the existing envelope. Session ownership is applied before pagination/counting. Farmer sees all their suggestions; counterparties see only addressed farmer-accepted results and their later states.
- GET /api/plans/:id remains farmer-only full detail.
- GET /api/approvals/:id returns an owner-authorized, role-specific summary/detail projection.
- POST /api/plans/:id/decision retains the farmer accept/reject body.
- POST /api/plans/:id/buyer-decision and /driver-decision accept `{decision:"approve"|"reject"}` for the addressed account only.

Counterparty projections exclude farmer minimum/net proceeds, internal AI traces and full source snapshots. Driver projections include original/proposed road geometry and transport components.

Approvals require PostgreSQL and API mode. Demo mode supports illustrative farmer history but explicitly cannot confirm shipments.

## Implementation notes

The checked-out pg client owns BEGIN, every booking query and COMMIT/ROLLBACK. A transaction-level advisory lock serializes booking mutations in this small prototype, followed by resource row locks. There are no network/model calls inside this critical section. The partial unique listing index prevents two active/confirmed plans for a harvest. For higher throughput, replace this global booking lock with a carefully tested deterministic resource-lock scheme.

Approval metadata is stored under plans.review.booking rather than new individual columns; it is surfaced as plan.booking. Existing sourceSnapshot/mode/searchComplete metadata are preserved. Non-final source validation compares immutable agreed facts while allowing buyer demand and available kg to change, subject to sufficient availability. Final failure is committed as unavailable before a 409 is returned. Closed trips remain visible to their owner but are excluded from matching.

## Validation

The booking HTTP test creates its own PostgreSQL schema and synthetic provider responses. It covers generation, acceptance, history, counterparty privacy, wrong-account/role rejection, idempotency, conflicting decisions, concurrent final approval, competing harvests for one trip, decline, expiry, restart, cursor pagination, zero remaining capacity/demand and rollback after an injected mid-allocation failure.

Frontend tests cover both approval roles and restoration of a farmer's accepted proposal from saved history. External model behavior, hosted provider behavior and deployment are separate checks; local synthetic-provider tests do not establish those results.
