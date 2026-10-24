# P3 — logistics handoff

## Your task (copy to your teammate or coding assistant)

Implement trips, routing, feasibility, fare calculation and the logistics agent inside api/src/modules/logistics/**. Read docs/CONTRACTS.md and preserve createLogisticsService/LogisticsService and registerRoutes. You may add files/tests in your folder. P2 alone edits shared dependencies, migration, app wiring and API lockfile; send requests early. Turf is installed. Use fake db/llm/routing/clock interfaces to work independently.

Choose and smoke-test an approved OSRM-compatible hosted provider on one simple Sri Lankan corridor. No provider/corridor is validated in the starter. Implement a RoutingClient adapter with signal/timeouts, full GeoJSON geometry, meters/seconds, leg timing, snapped points and provider/profile. Give the factory to P2 for dependency injection. Implement your PostgreSQL trip/quote repository in your folder. LogisticsService.getQuote(quoteId) is the agreed full-snapshot handoff to P4; review backing storage with P4 immediately and tell P2 if a schema addition is required.

Trip creation must persist the full real start→end road route. Matching first filters capacity, route proximity, pickup-before-delivery progress and compatible departure/readiness; reject looped/ambiguous routes. Then route start→pickup→delivery→end and validate snap tolerance, actual extra distance/time including loading/unloading, pickup readiness and buyer deadline. Original geometry stays separate from proposed modified geometry. Never replace routing failure with a straight-line road claim.

Use calculateProceeds as the starter for incremental-detour pricing. Validate safe integer money, preserve base/handling on zero detour, and provide a complete QuoteSnapshot with all inputs, source IDs, actual routes/timings and rule outcomes. The LogisticsResult summary alone is insufficient for advocate review. Preserve the overall six-combination budget and propagate the shared deadline.

Add the logistics prompt/tool definitions, deterministic implementations and rejection examples. AI can explain validated returned codes; it cannot override feasibility, rates or time limits. Use a fake LLM adapter until P2's provider is ready.

## First slice

- Run the existing pricing tests and API build.
- Implement and independently test the routing adapter; send wiring/export instructions to P2.
- Implement trip registration/persistence and demonstrate full geometry retrieval.
- Implement getQuote(quoteId) for validated snapshots; confirm storage and expiry needs with P4.

## Done when

A real route-backed quote passes capacity, direction, corridor, snapping, readiness, deadline and detour checks, with explicit rejection reasons for unsuitable trips and outages. Test those cases and the money example. Share tested accessible map pins with P1 and the validated corridor seed with P2. Do not edit other owners' folders to make your tests pass.
