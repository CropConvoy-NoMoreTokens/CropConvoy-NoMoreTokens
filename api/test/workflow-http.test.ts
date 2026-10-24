import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express, { Router, type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../src/core/errors.js';
import { registerRoutes } from '../src/modules/workflow/routes.js';
import { setup } from './workflow-fixtures.js';

test('workflow HTTP generation, retrieval, fallback envelopes and 409 decisions use injected modules', async t => {
  const f = setup(); f.deps.mode = 'live';
  f.deps.llm.complete = async () => { throw new Error('test model outage'); };
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => { res.locals.requestId = 'synthetic-test-request'; next(); });
  const router = Router(); registerRoutes(router, f.deps, f.workflow()); app.use(router);
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error instanceof ZodError) { res.status(422).json({ error: { code: 'VALIDATION_ERROR' } }); return; }
    res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } });
  };
  app.use(errors);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await post('/api/plans/generate', { listingId: f.listing.id });
  assert.equal(response.status, 200); const generated = await response.json();
  assert.equal(generated.meta.mode, 'deterministic_fallback');
  const id = generated.data.plan.id;
  const retrieved = await (await fetch(base + '/api/plans/' + id)).json();
  assert.deepEqual(retrieved.data, generated.data.plan); assert.equal(retrieved.meta.mode, 'deterministic_fallback');
  assert.equal((await post(`/api/plans/${id}/decision`, { decision: 'book' })).status, 422);
  const accepted = await post(`/api/plans/${id}/decision`, { decision: 'accept' });
  assert.equal(accepted.status, 200); const recorded = await accepted.json();
  assert.equal(recorded.data.status, 'farmer_accepted_pending_confirmations');
  assert.deepEqual((await (await post(`/api/plans/${id}/decision`, { decision: 'accept' })).json()).data, recorded.data);
  assert.equal((await post(`/api/plans/${id}/decision`, { decision: 'reject' })).status, 409);
  const stale = (await (await post('/api/plans/generate', { listingId: f.listing.id })).json()).data.plan.id;
  f.order.remainingKg--;
  assert.equal((await post(`/api/plans/${stale}/decision`, { decision: 'accept' })).status, 409);
  assert.equal((await fetch(base + '/api/plans/not-a-uuid')).status, 422);
});
