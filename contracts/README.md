# Team contract pack

- Runtime validators/types: api/src/core/contracts.ts (P4 owner).
- schemas.json: generated request, agent result, source record, QuoteSnapshot, Plan and GenerationResult JSON Schemas.
- fixtures/happy-path.json: synthetic request inputs and arithmetic example.
- fixtures/module-results.json: synthetic module outputs.
- fixtures/workflow-responses.json: P1 success/empty/incomplete/error envelopes, explicitly synthetic.
- requests.http: manual API smoke requests.
- docs/CONTRACTS.md: endpoint, unit, persistence and owner integration agreement/proposals.

Regenerate from api/: npm run contracts:export, then node --import tsx src/modules/workflow/export-contracts.ts until P2 folds the additional schemas into the existing exporter. Cross-record, money and state invariants also run in code.

This is a reference pack, never a production runtime package. API tests may read fixtures from the checkout. No synthetic geometry or quote is a verified road route or live provider result.
