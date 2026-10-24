# CropConvoy frontend

Complete React/Vite/TypeScript frontend for the P1 role: agricultural landing page, original generated images, demo login, farmer harvest/proposal flow, buyer orders, transporter trips, dark/light themes and accessible shared controls.

## Run locally

Use Node 24. From this web/ directory:

```powershell
npm ci
npm run dev
```

Open the printed local URL. Demo is the default and needs no backend or credentials. To customize settings, create .env from .env.example once; do not overwrite an existing .env.

| Role | Username | Password |
|---|---|---|
| Farmer | farmer | FarmerDemo123! |
| Buyer | buyer | BuyerDemo123! |
| Transporter | transporter | TransportDemo123! |

Choose an account on the login screen to autofill. In default demo mode, records are shared across roles within this browser tab's session and the credentials only select a local role. In API mode, the same public credentials are verified against the predefined database users; the API supplies the authenticated role and checks access to its routes.

Try the farmer sample: Review details → confirm pickup and harvest → Publish harvest → Confirm publication → Find a proposal → review sample proceeds → accept/reject. A simulated acceptance still says pending buyer/transporter confirmations. Demo pricing and route limitations are visible throughout.

## Commands

- `npm test`: component interactions, demo/HTTP adapters, map failure/coordinate mapping, reduced-motion behavior and money/date conversions.
- `npm run build`: type-check and production Vite build.
- `npm run preview -- --host 127.0.0.1`: serve the production build locally.
- `npm run test:watch`: focused development tests.
- `npm run assets -- --hero <file> --farmer <file> --buyer <file> --transport <file>`: rebuild responsive images from generated originals.

## Handoff references

- [INTEGRATION.md](INTEGRATION.md): backend-ready switch, endpoints, units, errors, demo limitations and environment settings.
- [THEME.md](THEME.md): palette, typography, spacing, component states and motion.
- [ASSETS.md](ASSETS.md): built-in image-generation prompts/provenance and final paths.
- [TEST-CHECKLIST.md](TEST-CHECKLIST.md): control inventory and observed verification results.

The frontend implementation stays inside web/. Set VITE_DATA_MODE=api and VITE_API_BASE_URL to test the backend; API errors never silently become demo success. Hash routing needs no static-host rewrite configuration.

The development-only responsive harness at /qa/responsive.html renders the real app in same-origin frames with 360/390/768/1440px viewports, theme controls and 200% text enlargement. It is not part of the production Vite entrypoints.
