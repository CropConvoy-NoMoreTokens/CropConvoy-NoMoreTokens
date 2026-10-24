# CropConvoy contributor instructions

Read README.md, docs/CONTRACTS.md, and your role's handoff before editing.

## Ownership
- P1: web/** (including its lockfile).
- P2: api/src/core/** except contracts.ts, api/src/server.ts, api/src/app.ts, api/src/modules/market/**, api/db/**, api/scripts/**, API configuration and lockfile.
- P3: api/src/modules/logistics/** and its module tests.
- P4: api/src/core/contracts.ts, api/src/modules/advocate/**, api/src/modules/workflow/**, contracts/**, integration tests and docs/CONTRACTS.md. Coordinate shared type changes with all affected owners first.
- Coordinate shared-file changes with their owner. Do not edit another owner's module to integrate it; use the existing exported interfaces.

## Rules
- This is the starter, not a finished marketplace. Preserve explicit stub labels until integrations are real.
- No fabricated road geometry, quotes, live AI claims, or automatic publication from extracted text.
- Inputs use {lat,lng}; GeoJSON uses [lng,lat]. Whole kg; meters; seconds; integer LKR minor units; UTC ISO dates with Z. UI timezone: Asia/Colombo.
- Farmer acceptance means farmer_accepted_pending_confirmations, never a confirmed booking. Do not reserve capacity or demand in this prototype.
- Never put secrets in web/, fixtures, logs, VITE_ variables, or committed .env files.
- Use parameterized SQL; validate external inputs and model outputs. Hard business rules run in code.
- web/ and api/ must build independently; no imports across service roots. Contracts are checked-in reference files, not a shared runtime package.
- Run the relevant build and tests before handing off. Keep sample requests and generated contracts synchronized when an interface changes.
- Do not push, deploy, or create external resources unless requested.
