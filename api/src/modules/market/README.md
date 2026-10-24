# P2: market and platform

Start with docs/handoffs/P2-MARKET-PLATFORM.md. repository.ts currently uses temporary memory only in stub mode. Replace that adapter with parameterized PostgreSQL queries. Keep its interface stable so workflow can use it immediately. service.ts exposes extractHarvest and findMarket; preserve input/output contracts. Add prompt.ts and tools.ts here when implementing the live agent. Do not invent missing harvest values.
