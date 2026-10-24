# P4: farmer advocate

reviewOptions accepts the listing and full QuoteSnapshot records obtained through authoritative LogisticsService.getQuote. Code verifies integer money, minimum net, source IDs, detour measurements, timing and required true hard-rule outcomes. The highest feasible net within the evaluated set wins, with quote ID as deterministic tie-breaker.

prompt.ts and tools.ts define an allowlisted normalized model response. Live review allows one initial model call and one repair, then deterministic fallback. Models cannot override feasibility, select unknown/lower-net IDs or provide authoritative prose. Workflow persists fixed observable review/trace text and labels fallback mode.

P3 must confirm the canonical ruleOutcomes keys documented in docs/CONTRACTS.md. Current logistics is still a stub; synthetic test geometry is never a live transport quote.
