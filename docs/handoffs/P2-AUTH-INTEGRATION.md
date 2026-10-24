# P2 demo authentication handoff

This is prototype access for the existing public farmer, buyer and transporter accounts. Their usernames/passwords are already displayed in the P1 demo UI, so they are not private identities. There is no registration, password reset or production account management.

Run `npm run db:migrate` from `api/` with `DATABASE_URL` configured. Migration 002 creates `demo_users` and `demo_sessions` and inserts the three existing demo IDs once with salted scrypt password hashes. It stores SHA-256 hashes of 32-byte random bearer tokens, not raw tokens. Sessions expire after 12 hours and logout revokes them. `GET /ready` now requires both auth tables as well as the original four tables.

## HTTP interface for P1

All successful responses retain the `{data,meta}` envelope. Credentials and tokens must stay out of URLs, logs and VITE_ variables.

| Request | Body or header | `data` |
|---|---|---|
| `POST /api/auth/login` | `{username,password}` | `{token,tokenType:'Bearer',expiresAt,user:{id,username,role}}` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` | `{id,username,role}` |
| `POST /api/auth/logout` | `Authorization: Bearer <token>` | `{signedOut:true}` |

Login uses the existing public demo credentials in `web/src/api/demo.ts` and is limited to ten attempts per IP per 15 minutes. Invalid credentials return 401. Missing, expired or revoked tokens return 401. Role/owner violations return 403; inaccessible listing/plan IDs return 404. Auth responses set `Cache-Control: no-store`. `/health` and `/ready` remain public. A PostgreSQL-backed `/api` requires a bearer token even if `API_STUBS=true`; the keyless starter's memory mode remains open for its existing tests.

The P1 UI is now connected: it keeps the local role chooser only when `VITE_DATA_MODE=demo`. In API mode it submits credentials to login, stores the bearer token for the browser session, attaches it to API requests, restores state through `/api/auth/me`, and clears it on logout or 401. The UI never treats the local `cropconvoy.identity` value as proof of API authentication. Actor IDs in listing, order and trip bodies come from the server-confirmed user.

## Authorization boundary for P3/P4

The central API middleware permits farmer extraction/listings/plans, buyer orders, and transporter trips. It checks submitted actor IDs, farmer listing ownership and farmer plan ownership. Buyer order responses are filtered to the signed-in buyer. With the current single account per role, trip reads have no cross-account distinction; P3 must scope trip reads if more transporters are added. New API routes fail closed until P2 adds a role rule. P4 owns the shared contract documentation and should update `docs/CONTRACTS.md` to describe this agreed auth interface and the changed meaning of demo actor IDs. Do not use a browser-supplied actor ID as authority in service code.

Verification: `npm test`, `npm run build`, `npm run auth:check`, and `npm run api:restart-check`. The live auth check uses the three seeded accounts and removes its temporary sessions. The restart check uses the seeded IDs and removes its synthetic listing, order and sessions.
