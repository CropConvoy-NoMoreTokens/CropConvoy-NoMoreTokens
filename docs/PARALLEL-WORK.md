# Start all four tracks together

The shared boundary is available now. Nobody waits for live model access, live routing, or completed screens. Replace stub bodies inside the assigned folders, using injectable fakes and the common fixture until other owners merge their work.

## Kickoff: 20–30 minutes

1. Read docs/CONTRACTS.md and contracts/fixtures/*.json together.
2. P2 confirms table needs with P3/P4; owns the migration and DB connection.
3. P3/P4 review LogisticsService.getQuote(quoteId), the full QuoteSnapshot type, and any backing-storage needs.
4. P2 validates the team's existing LLM provider/model/key. P3 validates a hosted road provider and accessible Sri Lankan corridor. P1 chooses a permitted map tile provider.
5. Agree partial-fill policy, snap tolerance, loading/unloading time, plan expiry and incremental-detour tariff. Record decisions in CONTRACTS.md.
6. Create one shared baseline commit and push it using your normal team process. Every developer branches from that same commit.

Suggested branches (not created automatically): `feat/frontend`, `feat/market-platform`, `feat/logistics`, `feat/workflow-advocate`.

## Ownership prevents merge conflicts

| Owner | Edit freely | Ask the owner to change |
|---|---|---|
| P1 | web/** including web lockfile | API behavior / shared contracts |
| P2 | market/**, core except contracts.ts, app/server, API package/lockfile/config, db/, scripts/ | P3/P4 services and contract changes |
| P3 | modules/logistics/** | Shared wiring, dependencies, packages and migrations: P2 |
| P4 | advocate/**, workflow/**, contracts.ts, contracts/**, API integration tests, CONTRACTS.md | Shared wiring/packages: P2 |

Only P2 installs API dependencies. Express, Zod, pg, Turf and test tooling are preinstalled. P3/P4 send any additional dependency request to P2 with the reason. P1 owns frontend dependencies. Do not regenerate someone else's lockfile.

## Integrate each hour

- Hour 1: both app shells run; hosted UI reaches /health; first migration and DB check work.
- Hour 2: each module runs against fixtures; publish/order CRUD and route storage connect.
- Hour 3: merge vertical slices; real MarketResult → LogisticsResult → snapshot review → persisted Plan.
- Hour 4: deployed full happy path plus outage/no-match/stale-decision cases.
- Hour 4:30: feature freeze. Remove optional image extraction/languages before cutting correctness.
- Hour 5–6: fixes, seeds, persistence restart check, demo rehearsal; reserve last 20 minutes.

Merge small changes from main frequently. Prefer completing the shared interfaces over adding unrelated features. Before opening a PR, run the relevant build/tests and include which endpoints became real, what is still stubbed, environment additions and one reproducible example. Update docs/STATUS.md.

## Team lead message

Copy the following message and attach each person's handoff:

> Start from the shared CropConvoy starter. Read README.md and docs/CONTRACTS.md, then follow your P1/P2/P3/P4 handoff. Work only in your assigned files. Use the exported interfaces and synthetic fixtures now; do not wait for another module to finish. Tell P2 about database/dependency/wiring needs immediately. Coordinate contract changes with P4. Deliver a working vertical slice each hour, label unfinished integrations honestly, and include build/test results in your handoff.
