# P3: logistics

Start with docs/handoffs/P3-LOGISTICS.md. service.ts is your boundary; routes.ts is already registered. Add your PostgreSQL repository, OSRM-compatible routing adapter, geometry filters, prompt and tools inside this folder. Ask P2 to inject your adapter into dependencies.routing. No routing provider has been selected or tested. An empty trip list is a labeled stub; trip creation deliberately returns 503 rather than fabricated road geometry.
