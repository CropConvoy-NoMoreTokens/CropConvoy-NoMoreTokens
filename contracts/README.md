# Team contract pack

- Runtime validators and TypeScript domain types: api/src/core/contracts.ts (P4 owns; coordinate changes).
- schemas.json: generated JSON Schema for request inputs and the four initial agent results. Regenerate with `npm run contracts:export` in api/ after agreed schema changes.
- fixtures/happy-path.json: shared request inputs and money example.
- fixtures/module-results.json: synthetic outputs for isolated module tests; never serve these as live AI/routing results.
- requests.http: manual API smoke requests.
- docs/CONTRACTS.md: endpoint, envelope, interface, and unit agreement.

This folder is a reviewable reference pack. Services never import files from it at runtime or during production builds. API tests may read it from the repository checkout. The export script is a maintainer tool, not a deployment step. Full Plan and QuoteSnapshot runtime validators are pending P4 implementation; their initial TypeScript types are already defined.
