# Team contract pack

- Runtime validators/types: api/src/core/contracts.ts (P4 owner).
- schemas.json: generated request, agent result, source record, QuoteSnapshot, Plan and GenerationResult JSON Schemas.
- fixtures/happy-path.json: synthetic request inputs and arithmetic example.
- fixtures/module-results.json: synthetic module outputs.
- fixtures/workflow-responses.json: P1 success/empty/incomplete/error envelopes, explicitly synthetic.
- requests.http: manual API smoke requests.
- docs/CONTRACTS.md: endpoint, unit, persistence and owner integration agreement/proposals.

Regenerate all schemas from api/: npm run contracts:export. P4 result schemas are included in the existing exporter; the old supplemental command is no longer required. Cross-record, money and state invariants also run in code.

This is a reference pack, never a production runtime package. API tests may read fixtures from the checkout. No synthetic geometry or quote is a verified road route or live provider result.
