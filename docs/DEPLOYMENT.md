# Deployment handoff (not deployed)

The starter has separate service roots and build scripts. These instructions do not mean provider access, quotas, production configuration or live integrations have been verified. Deploy the shell early, then complete actual database/routing/model work before claiming the demo flow works.

## Railway API — P2

1. Create a PostgreSQL database and API service from the team's repository; set service root to api/ and Node runtime to 24.
2. Build: `npm ci && npm run build`. Start: `npm start`. The server binds 0.0.0.0 and PORT.
3. Liveness: /health. Readiness: /ready. The starter returns 503 readiness while memory repositories are active.
4. Set DATABASE_URL via the database reference. Configure CORS_ORIGINS with the actual Vercel origin and any explicit development/preview origins.
5. Run `npm run db:migrate` in a controlled release/predeploy step from the source checkout (it needs scripts/ and db/). The runner is idempotent for the initial migration. Do not run destructive seed/reset commands at startup.
6. Configure LLM_API_KEY, LLM_MODEL, ROUTING_BASE_URL, optional ROUTING_API_KEY, DEMO_MODE=true, MAX_PLAN_MS=45000. P2/P3 still need to implement the adapters that consume model/routing settings.
7. Leave API_STUBS=true for the initial shell. Switch only when implementation is real; replace repository adapters and metadata first. Confirm secrets are absent from logs/browser responses.
8. P2 verifies the hosting proxy chain and configures trust proxy appropriately before relying on IP-based rate limits. The current limiter is per-process only.
9. Generate the public HTTPS API domain and send it to P1.

## Vercel web — P1

1. Service root: web/. Framework: Vite. Node runtime: 24. Build: `npm run build`. Output: dist/.
2. Set VITE_API_BASE_URL to the actual API HTTPS base URL. This is compiled into the browser build; redeploy after changing it.
3. Configure a permitted public tile URL if P1's map implementation requires it. Keep attribution. Never put database/model secrets in VITE_ variables.
4. Current single-page role tabs need no route rewrites. Add an SPA fallback if introducing browser URL routes.

## Verification gate

- Private browser window reaches /health from the deployed UI with correct CORS.
- Real create/read listing, order and trip, then generate/retrieve/decide plan.
- API restart preserves database-backed listing, full geometry and proposal.
- LLM/routing failures return clear errors or explicitly labeled permitted fallback.
- Correct money/route/constraints; farmer acceptance says confirmations pending.
- No provider quota, security/authentication or heavy-truck suitability claims beyond tested behavior.
