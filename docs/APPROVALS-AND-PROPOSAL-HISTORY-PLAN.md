# Proposal history and three-party approval implementation plan

Prepared 24 October 2026, against the current merged CropConvoy code. This describes proposed work, not implemented functionality.

## Outcome

A farmer can sign back in, open a harvest, and see all its saved proposals and their decisions. An accepted proposal appears in the matching buyer's and driver's approval inboxes. The booking becomes confirmed only after all three parties agree and the database atomically checks availability.

Existing money calculation, road feasibility and AI review remain in place. AI does not grant approvals or control booking status.

## 1. Scope and decisions to implement

- Farmer home remains My harvests / New harvest. Each harvest card shows the latest proposal status; Open harvest reveals its Proposal history, newest first. A separate My proposals tab is unnecessary for this version.
- Buyer navigation: My orders / Approvals / New order.
- Driver navigation: My trips / Approvals / New trip.
- Approval inboxes have Pending and History filters. Counts come from authorized server data, not locally remembered records.
- Only proposals accepted by the farmer are visible to the buyer and driver. Unaccepted AI suggestions are private to the farmer.
- Farmer acceptance and the first counterparty approval do not reserve demand or capacity. Availability is checked again on final approval. Show this limitation on all pending proposals.
- Keep one shipment per confirmed trip for this version. Close the trip at confirmation even when spare kg remain. Multiple independently confirmed pickups would need combined-route scheduling, which the current routing logic does not provide.
- Each harvest can have only one active farmer-accepted or confirmed proposal. Other generated proposals remain in history but cannot create duplicate bookings. Block new generation while an active acceptance exists, and block it permanently for a booked harvest; resolve expired pending acceptance before allowing a fresh search.
- Payments, delivery tracking, negotiation, cancellation after confirmation, email/push notifications and multi-shipment routes are outside this change.

## 2. State and expiry rules

Keep existing statuses for compatibility; extend them as follows:

| Plan status | Meaning | Allowed next action |
| --- | --- | --- |
| proposed | Saved recommendation; farmer has not decided | Farmer accepts or rejects before expiry |
| farmer_accepted_pending_confirmations | Farmer agreed; buyer and/or driver still pending | Matching buyer and driver approve or reject before expiry |
| confirmed | All approvals and availability transaction succeeded | Read-only confirmation in this version |
| rejected | Farmer rejected | Read-only history |
| declined | Buyer or driver rejected | Read-only history; farmer can generate again |
| expired | Decision deadline passed while proposed/pending | Read-only history; generate again |
| unavailable | Final availability or source validation failed | Read-only history; generate again |
| superseded | Another proposal for this harvest was accepted | Read-only history |

Store buyer and driver decisions separately as pending / approved / rejected, with timestamps and actor IDs. Do not infer them solely from overall plan status.

Expiry policy: retain the existing quoted expiry. On farmer acceptance, set approvalExpiresAt to the earliest of the stored plan expiry, quote expiry and pickup time. Never extend an expired price quote silently. Show the deadline explicitly in each inbox. If this is too short for a real workflow, a later version must obtain and approve a fresh quote.

Confirmed/rejected/declined decisions remain readable after the deadline. Time passing must never turn a confirmed booking into an expired proposal. Repeating the same already-recorded decision returns the current result; changing it returns 409. An approved actor cannot later reject within this minimal workflow.

## 3. Database migration

Add the next unused migration filename after inspecting the migration ledger. The repo already has two different 002 files; do not rename migrations already applied.

Extend plans with:

- buyer_decision, driver_decision: constrained text, default pending.
- farmer_accepted_at; buyer_decided_at; driver_decided_at; confirmed_at: nullable timestamps.
- buyer_decided_by, driver_decided_by: nullable UUIDs.
- approval_expires_at: nullable timestamp.
- resolution_code: constrained/code-validated string for expiry, source change or capacity failure.

Extend the plan status constraint. Add indexes supporting listing_id + created_at + id, order_id + status, and trip_id + status. Add a partial unique index on listing_id for statuses farmer_accepted_pending_confirmations and confirmed. A new acceptance must first resolve an expired pending plan under the listing lock so it does not block forever.

Allow orders.remaining_kg and trips.available_kg to reach zero. The existing SQL constraints require values > 0 and would reject a fully allocated booking. Extend listing status to include booked; use the existing closed status for orders/trips. Keep create-input quantity/capacity requirements > 0, while stored-record/output schemas accept zero and the expanded statuses.

Backfill existing farmer-accepted rows from their saved decision: counterparties remain pending; original expiry is preserved. Already-expired pending rows become expired. Do not manufacture approvals. Retain old records and quote snapshots.

No separate bookings table is necessary for this version: a confirmed plan and confirmedAt form the booking record. Use plan ID as the reference.

## 4. Authorized APIs and history

Keep the current farmer decision route. Add:

| Endpoint | Purpose |
| --- | --- |
| GET /api/plans?listingId=…&status=…&limit=20&cursor=… | Authorized proposal history or approval inbox; derive role/actor from session |
| GET /api/plans/:id | Authorized detail for the farmer, addressed buyer, or addressed driver |
| POST /api/plans/:id/buyer-decision | Buyer body: decision = approve or reject |
| POST /api/plans/:id/driver-decision | Driver body: decision = approve or reject |

List response: data = { items, nextCursor, pendingCount }, with the existing meta envelope. Validate bounded limit, statuses and cursor; sort by created_at DESC, id DESC. Calculate pendingCount for the current actor, excluding effectively expired rows, independently of pagination.

Server-side joins enforce farmer ownership through listings, buyer ownership through orders, and driver ownership through trips. Never use a client-supplied account ID as authority. A listingId filter narrows an already-authorized query. Unknown or unowned detail IDs return 404; wrong-role decision actions return 403; missing sessions return 401.

Buyer/driver detail must exclude plans still proposed or farmer-rejected. Return only fields needed for their decision: crop, kg, locations, schedule, price/transport amount, relevant route and approval state. Do not expose the farmer's minimum net requirement, internal AI traces, or entire source snapshots to counterparties. Use separate summary/detail response schemas per role.

Farmer history shows all persisted proposals, including expired, rejected, accepted and confirmed. List summaries must not run decision-time feasibility or fail because one legacy snapshot uses older pricing. Mark incompatible legacy details read-only with a regenerate message; do not relabel historical prices as current. Preserve the saved accepted decision and quote amounts.

Read paths calculate effective expiry for proposed/pending rows even if cleanup has not run. No scheduler is required: decision/new-acceptance transactions persist relevant expiry transitions. Failed availability checks must never prevent read-only history access.

## 5. Transactional confirmation — required for correctness

Add a transaction abstraction to core/dependencies.ts backed by one checked-out pg client. BEGIN / queries / COMMIT must use that same client; independent pool.query calls do not form a reliable transaction. Never call model or road providers while holding database locks.

All farmer-acceptance and counterparty-decision mutations use a consistent lock order: listing → order → trip → plan. Read IDs first without locks, then lock and re-read all four records, validate relationships/ownership/state, and apply the transition. Use database time consistently for deadlines.

Farmer acceptance transaction:

1. Validate current quote, source data, minimum proceeds and expiry using the existing code rules.
2. Resolve expired pending plans for that listing; ensure no active/confirmed competing plan exists.
3. Record acceptance, set approval deadline, and supersede other proposed plans for that harvest atomically.
4. Leave demand/capacity unchanged; surface pending confirmations to the farmer.

Buyer/driver decision transaction:

1. Recheck session ownership in the transaction; require farmer acceptance.
2. Return an identical recorded decision idempotently. Reject a conflicting repeat with 409.
3. If past deadline, persist expired; do not approve. If rejecting, persist decision + declined atomically, without touching capacity.
4. If approving and the other actor is still pending, record only this approval.
5. If this is the final approval, revalidate listing open/unbooked, order open with enough remaining kg, trip open with enough available kg, quote deadline, readiness/delivery constraints, route and tariff compatibility, and source relationships.
6. Compare immutable source fields to the saved snapshot. Do not require exact equality of mutable remaining-demand fields: another valid booking may have reduced the same buyer order. Reject material price/location/route/timing changes; never silently recompute a different offer.
7. On success: decrement order demand and trip capacity once, close fully filled order, close the trip for this single-shipment version, mark listing booked, mark plan confirmed, and save final approval + confirmedAt in the same commit.
8. Resolve competing pending plans using the now-booked listing/trip as unavailable. Reads must also recognize unavailable sources if a competing row has not yet been updated. Farmers can generate new options from still-open resources.
9. If availability fails: commit unavailable + reason and make no resource deductions. Return a structured 409 containing the terminal status after commit. Throwing inside the transaction must not accidentally roll back that saved resolution.

Acquire locks for competing rows in a documented deterministic order; test deadlock handling/retry. Keep the unique listing constraint as a final database guard. A retry after a lost response must not decrement kg twice. Scope all decrements and status changes inside the transaction; no compensating partial writes.

## 6. Frontend behavior

### Farmer

- My harvests cards show latest saved proposal status from authorized summary data. Avoid one history request per card; return a latest-proposal summary in the harvest-list API.
- Open harvest loads its saved history automatically. Each row has date, buyer/trip reference, transport estimate, estimated net, status, and Open proposal.
- Pending detail shows a three-person progress strip: Farmer accepted / Buyer pending or approved / Driver pending or approved, plus approval deadline.
- Confirmed detail shows booking reference and agreed amounts. Declined/expired/unavailable detail explains the outcome and offers Find another proposal when the harvest is still available.
- A refresh, new login, copied URL or API restart restores these states from PostgreSQL. History must not depend on remember(), sessionStorage, or the current page's generation result.

### Buyer

- Approvals card shows harvest/crop, whole kg, agreed purchase price, delivery location/time and transport context.
- Open detail → Approve / Reject → explicit confirmation dialog → saved server result.
- My orders displays current remaining demand and closed/fully matched state accurately.

### Driver

- Approvals card shows pickup/drop-off, kg, schedule, original/proposed road route, carrying/detour/handling breakdown and transport earnings.
- Open detail → Approve / Reject → explicit confirmation dialog → saved server result.
- My trips shows closed/allocated status and remaining kg; closed trips are excluded from new matching.

Reuse the user's existing pill navigation styles. Disable duplicate clicks while saving. After 409, refresh detail and lists; explain the saved reason. After 401, return to login. Use manual refresh and refetch on workspace entry; no sockets or aggressive polling are needed for this version.

## 7. Work breakdown for four people

Budget about 4–6 hours of coordinated parallel work plus deployment verification. This is an estimate, not a guarantee; shipping without race-condition tests is not an acceptable shortcut.

| Owner | Main work | Files / boundary |
| --- | --- | --- |
| P1 frontend | Farmer history, buyer/driver inboxes and detail, badges/dialogs, request handling | web/src/api, pages/workspaces, tests; use agreed mock responses until APIs land |
| P2 platform | Migration, transaction dependency, session authorization for new routes, indexes and deployment migration | api/db, core dependencies/auth, scripts; transaction helper contract first |
| P3 logistics/booking | Locked approval/confirmation operations, availability checks and single-trip allocation | Dedicated booking service/repository module plus concurrency tests; share existing validation helpers |
| P4 workflow/history | Shared response/state schemas, history queries/routes, acceptance integration, fixtures and API integration tests | workflow/contracts; coordinate the shared plan repository with P3 |

First 20–30 minutes: agree on states, role-specific responses, transaction API and migration naming. P4 publishes fixtures; P2 publishes transaction helper signature; P3 defines booking service exports. Do not have multiple owners independently change the same acceptance/repository function.

Suggested sequence:

1. Contracts + SQL design + transaction interface (20–30 min).
2. History/read endpoints and UI history in parallel with migration/auth/booking service (90–150 min).
3. Connect inbox decisions and transactional finalization (60–90 min).
4. Race tests, login/reload walkthrough and regression fixes (45–60 min).
5. Apply migration and deploy/retest on the team's selected API host and Vercel (20–40 min). Confirm whether the current API target is Railway or Render before changing hosting configuration; the repo now contains Render configuration.

Deliver in two usable increments: first persisted farmer history, then approvals + atomic confirmation. Until increment two passes, keep the existing pending-confirmation wording and do not claim a confirmed booking.

## 8. Tests and acceptance criteria

Required automated tests:

- Farmer accepted plan survives logout/login, refresh and API restart and is discoverable without its ID.
- History includes expired/rejected/legacy plans; one incompatible snapshot does not break the list.
- Pagination is stable; ownership filters apply before pagination/counts; no cross-account history/detail or decision access.
- Only farmer-accepted proposals reach counterparties; role-specific responses do not leak private farmer fields.
- Either counterparty may approve first; only both approvals confirm. Either may reject while its own decision is pending.
- Expired proposals cannot be approved; confirmed history remains confirmed after quote expiry.
- Two confirmations competing for one trip cannot both succeed, even when spare kg exist.
- Two plans for one harvest cannot both enter active acceptance/confirmation.
- Concurrent orders consuming the same buyer demand never make remaining kg negative.
- Full-demand/full-capacity allocation can reach zero and is represented correctly in SQL and response schemas.
- Repeated approval, concurrent approve/reject, lost-response retry and process restart never double-decrement resources.
- Source change before final approval gives unavailable/409 with no partial deductions; rollback tests verify all-or-nothing writes.
- Closed/booked sources cannot enter new matching; eligible partially filled buyer demand remains matchable.
- All role views handle empty/error/401/409/loading states and restore saved decisions from the API.

Manual walkthrough after automated tests:

1. Buyer creates order; driver creates trip; farmer publishes harvest and generates a proposal.
2. Farmer accepts, logs out, signs back in, opens My harvests → harvest → Proposal history → accepted proposal.
3. Buyer signs in, opens Approvals and approves. Farmer sees buyer approved / driver pending.
4. Driver signs in, checks route/earnings, approves. All parties see the same confirmed booking ID.
5. Check exact resource counts, reload each role and restart API. Counts and decisions persist.
6. Repeat with rejection, expiry and two competing proposals. No duplicate booking or negative availability is allowed.

Definition of done: these walkthroughs pass against the connected database; both builds and relevant test suites pass; migration and role auth work on the deployed environment; no UI labels pending approvals as confirmed; no real-model/hosting success is claimed solely from mocks.
