# Deployment handoff — Railway API and Vercel UI

The integrated app is tested locally. No hosting resources or remote branch updates were created as part of integration.

## Railway API

- Repository root for service: api/. Node 24.
- Install/build: npm ci && npm run build. Start: npm start.
- API listens on 0.0.0.0 and Railway's PORT.
- Configure DATABASE_URL, API_STUBS=false, CORS_ORIGINS, ROUTING_BASE_URL, ROUTING_PROFILE=driving, LLM_API_KEY, LLM_MODEL and MAX_PLAN_MS=45000.
- Use the team's reviewed PostgreSQL service. Preserve provider TLS settings; do not disable certificate verification.
- Run npm run db:migrate in a controlled pre-deploy/release step. It applies all unapplied ordered SQL migrations, including 002_weight_distance_logistics.sql. It never resets data at app startup.
- Liveness: /health. Readiness: /ready (requires persistent source/plan/quote tables and the new rate column).
- Configure the verified reverse-proxy trust policy before relying on the IP limiter. Current rate limiting is per process.
- Select a permitted hosted routing provider; the public OSRM demo was used only for a one-off local smoke check.
- Configure an approved HTTPS place provider with `GEOCODING_BASE_URL`. The default public Nominatim endpoint is limited to low-traffic demos; follow its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) and enforce the whole application's request limit across instances.
- Keep all model, database and provider secrets on the backend.
- The farmer image reader accepts raw JPEG/PNG/WebP uploads up to 3 MB; ensure the hosting ingress permits that body size. Images are sent to Gemini for transcription and are not stored by this API.

## Vercel UI

- Root: web/. Vite, Node 24. Build: npm run build. Output: dist.
- Set VITE_DATA_MODE=api and VITE_API_BASE_URL to the Railway public HTTPS API URL.
- Add that Vercel origin to API CORS_ORIGINS. Use explicit preview origins if needed.
- Rebuild after changing VITE_ variables. No backend secrets belong in these variables.
- Current hash routes survive static refresh; no browser-route rewrite is needed.
- Keep map attribution and use a permitted tile provider.

## Verification before demo

- UI calls the configured API; it is not in session-only demo mode.
- Create/read buyer order, trip with full real geometry, and confirmed farmer listing.
- Generate a proposal with quantity-distance rate and complete fare breakdown.
- AI fallback/outage and incomplete search labels remain truthful.
- Acceptance says pending buyer/transporter confirmations; no stock/capacity reservation.
- Restart API and reload a saved proposal.
- Confirm IDs, expiry, kg/meters/seconds/minor-unit conversions and CORS from an actual hosted browser.

See LOCAL-INTEGRATION.md for local run instructions and what was verified. Provider availability/quotas, live model behavior and hosted deployment are separate checks.
