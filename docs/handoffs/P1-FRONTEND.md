# P1 — frontend handoff

## Your task (copy to your teammate or coding assistant)

Implement CropConvoy's frontend inside web/**. Read README.md, docs/CONTRACTS.md and the supplied plan first. You own web dependencies and its lockfile. Use React/Vite/TypeScript and the existing API helper. The current role tabs and connection check are scaffolding, not finished product screens.

Build farmer text input, extraction review/correction, pickup pin, explicit publication, generation loading/error/empty states, proposal figures and original/modified route display, then accept/reject. Build compact buyer order and transporter trip forms and lists. Use one shared map component with a permitted tile provider and attribution. The map/routing corridor is not verified yet; coordinate with P3. Static role tabs use synthetic UUID actors from contracts/fixtures/happy-path.json.

Work against local sample responses until each endpoint becomes available. Keep fakes inside web/ and visibly label them; do not import contracts files outside the web root or claim a live result. Production builds must remain self-contained. Display the envelope's stub/fallback mode. An incomplete empty search is not proof that no real match exists. Never display a confirmed booking after farmer acceptance; say buyer and transporter confirmations are pending.

Only VITE_API_BASE_URL and any public map setting belong in web/. Format dates in Asia/Colombo and amounts from integer minor units. Send UTC Z timestamps and localTimeContext with extraction. No automatic listing creation from extraction. Required inputs/limits come from the contract pack; coordinate interface changes with P4.

## First slice

- `npm ci` in web/, create .env from .env.example, run `npm run dev`.
- Confirm the connection check reaches API /health.
- Deliver confirmed-listing entry and buyer order entry against the real stub CRUD while P2 works.

## Done when

The deployed browser completes the three-minute demo without developer tools, maps actual returned geometry, distinguishes estimates/pending confirmations, and shows useful validation, dependency, empty and fallback states. Run `npm run build`. Send API/CORS needs to P2; do not edit api/.
