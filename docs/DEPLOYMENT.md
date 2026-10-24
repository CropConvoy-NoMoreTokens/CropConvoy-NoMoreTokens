# Deployment handoff — Render API and Vercel UI

The modules are integrated and locally verified, including real configured routing and Gemini calls. This does not mean the application has been deployed or its production proxy/provider capacity has been verified.

## Render API

- Use the repository's api/ root, Node 24, build `npm ci && npm run build`, and start `npm start`. The server binds 0.0.0.0 and PORT.
- Configure DATABASE_URL for the selected database. The current database is Neon; use its connection URL with TLS/channel binding. Render Postgres is an alternative if chosen later, using its same-region internal URL.
- Apply `npm run db:migrate` from api/ before serving traffic. Both 001 and 002 are required. Use Render's paid-service Pre-Deploy Command where available, or run migrations from an authorized source checkout. The migration ledger makes repeated runs idempotent; never reset/seed records on server startup.
- Existing legacy trips remain detour-v0 and must be republished with an explicit kg-km rate; old rates are not converted. If a standalone hybrid-v1 schema was applied previously, review P3's upgrade handoff before applying the fresh migration.
- Configure API_STUBS=false, LLM_API_KEY, LLM_MODEL, optional LLM_BASE_URL, an approved ROUTING_BASE_URL, ROUTING_PROFILE=driving, MAX_PLAN_MS=45000 and exact CORS_ORIGINS. Keep all credentials in server settings. Never place them in VITE_ variables.
- Liveness is /health. Readiness is /ready and checks source/plan/quote tables plus the tariff column; readiness alone does not prove provider availability.
- Verify Render's proxy chain before changing Express trust proxy or relying on the prototype's per-process IP limiter.

## Vercel UI

- Use web/ as root, Vite preset, Node 24, build `npm run build`, output dist/.
- Set VITE_DATA_MODE=api and VITE_API_BASE_URL to the Render HTTPS API URL. Restart/rebuild after changing VITE_ settings. The default demo is explicitly simulated and does not call the API.
- Configure the approved public map tiles and attribution. Hash routing needs no SPA fallback rewrite.

## Verification

Run both production builds and suites independently. On deployed URLs, verify CORS/request IDs, listing/order/trip creation, returned full route geometry, versioned carrying/detour charges, generation/retrieval, expiry/stale conflicts, pending farmer acceptance and persistence after an API process restart. No stock/demand/capacity is reserved or decremented.

`P4_TEST_DATABASE_URL=<disposable local PostgreSQL> npm run api:integration-check` runs the bounded real-provider check using configured routing/Gemini and a generated local database. It never writes the hosted DATABASE_URL and removes its local database afterward. The local role needs CREATE DATABASE permission. Ordinary automated tests mock only external provider responses in the combined real-module flow.

References: [Render Express deployment](https://render.com/docs/deploy-node-express-app), [pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command), [Postgres connections](https://render.com/docs/postgresql-creating-connecting), and [P3/P4 local integration](LOCAL-INTEGRATION.md).
