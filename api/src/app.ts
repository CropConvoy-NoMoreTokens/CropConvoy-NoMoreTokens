import { randomUUID } from 'node:crypto';
import express, { Router, type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import type { Dependencies } from './core/dependencies.js';
import { ApiError } from './core/errors.js';
import { reply } from './core/http.js';
import { createMarketRepository } from './modules/market/repository.js';
import { authenticate, authorizeRequest, login, loginInputSchema, logout, type AuthUser } from './core/auth.js';
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
  app.use('/api/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler(_req, res) { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts; try again later' } }); } }),
    async (req, res) => {
      return reply(res, deps, await login(deps, loginInputSchema.parse(req.body)));
    });
  app.use('/api', async (req, res, next) => {
    // The keyless starter still supports its existing local stub tests. Any
    // PostgreSQL-backed API requires a database session, including stub mode.
    if (deps.persistence !== 'postgres') return next();
    const session = await authenticate(deps, req.get('Authorization'));
    res.locals.authUser = session.user;
    res.locals.authTokenHash = session.tokenHash;
    await authorizeRequest(deps, session.user, req.method, req.path, req.body);
    next();
  });
  app.get('/api/auth/me', (req, res) => {
    const user = res.locals.authUser as AuthUser | undefined;
    if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to use this API');
    return reply(res, deps, user);
  });
  app.post('/api/auth/logout', async (_req, res) => {
    await logout(deps, res.locals.authTokenHash as string);
    return reply(res, deps, { signedOut: true });
  });
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
    if (bodyError?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: _req.path === '/api/harvest/image-text' ? 'Image exceeds 3 MB' : 'Request exceeds 64 KB' } }); return; }
    console.error(JSON.stringify({ requestId: res.locals.requestId, event: 'request_failed' }));
    res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'A required service is unavailable' } });
  };
  app.use(errors);
  return app;
}
