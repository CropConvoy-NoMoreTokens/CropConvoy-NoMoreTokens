import { randomUUID } from 'node:crypto';
import express, { Router, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import type { Dependencies } from './core/dependencies.js';
import { ApiError } from './core/errors.js';
import { reply } from './core/http.js';
import { createMarketRepository } from './modules/market/repository.js';
import { registerRoutes as marketRoutes } from './modules/market/routes.js';
import { createLogisticsService, type LogisticsService } from './modules/logistics/service.js';
import { registerRoutes as logisticsRoutes } from './modules/logistics/routes.js';
import { createWorkflowService, type WorkflowOptions } from './modules/workflow/service.js';
import { registerRoutes as workflowRoutes } from './modules/workflow/routes.js';

export interface AppOptions {
  logistics?: LogisticsService;
  logisticsForGeneration?: WorkflowOptions['logisticsForGeneration'];
}

export function createApp(deps: Dependencies, origins: string[], options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
    res.once('finish', () => console.log(JSON.stringify({ event: 'request',
      requestId: res.locals.requestId, method: req.method, path: req.path,
      status: res.statusCode, durationMs: Number(process.hrtime.bigint() - started) / 1e6 })));
    next();
  });
  app.use(cors({ exposedHeaders: ['X-Request-Id'], origin(origin, callback) {
    if (!origin || origins.includes(origin)) callback(null, true);
    else callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This browser origin is not allowed'));
  } }));
  app.use(express.json({ limit: '64kb' }));
  // Per-process IP limit for the demo; a multi-instance deployment needs a shared store.
  // P2 must configure trust proxy for the verified hosting topology before public deployment.
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler(_req, res) { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests; try again in a minute' } }); } }));
  app.get('/health', (_req, res) => reply(res, deps, { status: 'ok', version: '0.1.0', implementation: 'integrated-prototype' }));
  app.get('/ready', async (_req, res) => {
    if (deps.persistence !== 'postgres') throw new ApiError(503, 'NOT_READY', 'PostgreSQL is not configured');
    await deps.db.ping();
    return reply(res, deps, { status: 'ready' });
  });
  const market = createMarketRepository(deps);
  const logistics = options.logistics ?? createLogisticsService(deps);
  const workflow = createWorkflowService(deps, market, logistics, {
    logisticsForGeneration: options.logisticsForGeneration ?? (options.logistics ? undefined : createLogisticsService),
  });
