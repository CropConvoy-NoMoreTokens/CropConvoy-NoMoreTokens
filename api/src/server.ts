import { config } from './core/config.js';
import { createDependencies } from './core/dependencies.js';
import { createApp } from './app.js';
const deps = createDependencies({ databaseUrl: config.DATABASE_URL, stub: config.API_STUBS === 'true',
  maxPlanMs: config.MAX_PLAN_MS, llmApiKey: config.LLM_API_KEY,
  llmModel: config.LLM_MODEL, llmBaseUrl: config.LLM_BASE_URL,
  routingBaseUrl: config.ROUTING_BASE_URL, routingProfile: config.ROUTING_PROFILE });
const app = createApp(deps, config.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean));
const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', port: config.PORT, mode: deps.mode, persistence: deps.persistence }));
});
for (const event of ['SIGINT', 'SIGTERM'] as const) process.once(event, () => {
  server.close(() => { void deps.db.close().then(() => process.exit(0), () => process.exit(1)); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
