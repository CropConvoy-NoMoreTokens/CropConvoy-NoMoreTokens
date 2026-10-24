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
import { createLogisticsService } from './modules/logistics/service.js';
import { registerRoutes as logisticsRoutes } from './modules/logistics/routes.js';
import { createWorkflowService } from './modules/workflow/service.js';
import { registerRoutes as workflowRoutes } from './modules/workflow/routes.js';

function sanitizeForLog(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeForLog);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (/password|secret|token|credential|authorization/i.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizeForLog(value);
    }
  }
  return out;
}

export function createApp(deps: Dependencies, origins: string[]) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);

    const origJson = res.json.bind(res);
    res.json = (body: any) => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      console.log(`[API Response] ${res.statusCode} ${req.method} ${req.path} (${durationMs.toFixed(1)}ms)`, {
        requestId: res.locals.requestId,
        body: sanitizeForLog(body),
      });
      return origJson(body);
    };

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
  app.use((req, res, next) => {
    const hasQuery = req.query && Object.keys(req.query).length > 0;
    const hasBody = req.body && Object.keys(req.body).length > 0;
    console.log(`[API Request] ${req.method} ${req.path}`, {
      requestId: res.locals.requestId,
      ...(hasQuery ? { query: sanitizeForLog(req.query) } : {}),
      ...(hasBody ? { body: sanitizeForLog(req.body) } : {}),
    });
    next();
  });
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
  const logistics = createLogisticsService(deps);
  const workflow = createWorkflowService(deps, market, logistics, { logisticsForGeneration: scoped => createLogisticsService(scoped) });
  const router = Router();
  marketRoutes(router, deps, market);
  logisticsRoutes(router, deps, logistics);
  workflowRoutes(router, deps, workflow);
  app.use(router);
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found')));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields',
        fields: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) } });
      return;
    }
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    const bodyError = error as { type?: string } | null;
    if (bodyError?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request must contain valid JSON' } }); return; }
    if (bodyError?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request exceeds 64 KB' } }); return; }
    console.error(JSON.stringify({ requestId: res.locals.requestId, event: 'request_failed' }));
    res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'A required service is unavailable' } });
  };
  app.use(errors);
  return app;
}
