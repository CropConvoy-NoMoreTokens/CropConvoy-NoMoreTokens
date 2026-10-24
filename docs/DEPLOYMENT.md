# Deployment handoff — Railway API and Vercel UI

The integrated app is tested locally. No hosting resources or remote branch updates were created as part of integration.

## Render API — P2

1. Create a Node Web Service from the team's repository on Render; set Root Directory to `api` and `NODE_VERSION=24` in the service environment. The current hosted database is Neon Postgres; Render Postgres is an alternative if selected later.
2. Build: `npm ci && npm run build`. Start: `npm start`. The server binds 0.0.0.0 and PORT.
3. Liveness: /health. Readiness: /ready. The starter returns 503 readiness while memory repositories are active.
4. Set DATABASE_URL to the Neon connection URL from its Connect dialog, preserving TLS and channel binding. For Render Postgres, use its same-region internal URL instead. Configure CORS_ORIGINS with the actual Vercel origin and any explicit development/preview origins.
5. Run `npm run db:migrate` from the source checkout (it needs scripts/ and db/). On paid Render services, use the Pre-Deploy Command; otherwise run it from an authorized environment before deployment. The runner is idempotent for the initial migration. Do not run destructive seed/reset commands at startup.
6. Configure LLM_API_KEY, LLM_MODEL, ROUTING_BASE_URL, optional ROUTING_API_KEY, DEMO_MODE=true, MAX_PLAN_MS=45000. P2 Gemini/extraction/market adapters are integrated. P3 must still provide real routing/trip/quote storage.
7. Leave API_STUBS=true for the initial shell. Switch only when implementation is real; replace repository adapters and metadata first. Confirm secrets are absent from logs/browser responses.
8. P2 verifies the hosting proxy chain and configures trust proxy appropriately before relying on IP-based rate limits. The current limiter is per-process only.
9. Use the service's public `https://<service>.onrender.com` URL and send it to P1.

## Vercel UI

- Root: web/. Vite, Node 24. Build: npm run build. Output: dist.
- Set VITE_DATA_MODE=api and VITE_API_BASE_URL to the Railway public HTTPS API URL.
- Add that Vercel origin to API CORS_ORIGINS. Use explicit preview origins if needed.
- Rebuild after changing VITE_ variables. No backend secrets belong in these variables.
- Current hash routes survive static refresh; no browser-route rewrite is needed.
- Keep map attribution and use a permitted tile provider.

## Verification before demo

- Private browser window reaches /health from the deployed UI with correct CORS.
- Real create/read listing, order and trip, then generate/retrieve/decide plan.
- API restart preserves database-backed listing, full geometry and proposal.
- LLM/routing failures return clear errors or explicitly labeled permitted fallback.
- Correct money/route/constraints; farmer acceptance says confirmations pending.
- No provider quota, security/authentication or heavy-truck suitability claims beyond tested behavior.

Render references: [Express deployment](https://render.com/docs/deploy-node-express-app), [monorepo roots](https://render.com/docs/monorepo-support), [pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command), and [Postgres connections](https://render.com/docs/postgresql-creating-connecting). No service or database has been created by this change.

P4 plan persistence uses the existing plans table. P2 PostgreSQL market/Gemini and request-scoped workflow wiring are integrated. P3 real logistics/routing must still land before the real generation verification gate can pass; see [P4 integration requirements](handoffs/P4-INTEGRATION.md).


## Local Neon migration timeout

The migration command supports cross-region connections by allowing at least 2 seconds per address attempt and 20 seconds for total connection setup. It keeps automatic IPv4/IPv6 failover and TLS certificate/hostname verification. `sslmode=require` is normalized to `verify-full` within the shared API/migration configuration, preserving the current pg behavior and removing its compatibility warning; credentials in .env are unchanged.

Run `npm run db:migrate` from api/. An existing migration returns "Initial migration already applied". If ETIMEDOUT persists, check reachability of port 5432 on the current network; increasing only the pool timeout does not fix Node's shorter address-attempt timeout. See [Node address selection](https://nodejs.org/docs/latest-v22.x/api/net.html#netsetdefaultautoselectfamilyattempttimeoutvalue) and [Neon connection troubleshooting](https://neon.com/docs/connect/connection-errors). API pools now use the same connection configuration. P2 listing/order and P4 plan repositories select PostgreSQL when DATABASE_URL is configured; P3 logistics remains pending.
