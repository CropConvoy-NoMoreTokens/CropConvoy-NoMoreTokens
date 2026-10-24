import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createDependencies } from '../src/core/dependencies.js';

const forecast = { produce_id: 'tomato', market_id: 'dambulla', origin_month: '2026-09', target_month: '2026-10',
  horizon_months: 1, forecast_price_per_kg_minor: 22000, latest_known_price_per_kg_minor: 21000,
  predicted_change_pct: 4.76, previous_year_price_per_kg_minor: 20000, data_source: 'synthetic', inference_device: 'cpu' };
async function listen(app: ReturnType<typeof express>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}
const close = (server: Server) => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

test('prediction proxy uses fixed public routes and a server-only key, validates payloads and isolates auth', async t => {
  const upstream = express(); upstream.use(express.json());
  const requests: Array<{ path: string; key?: string; authorization?: string; body: unknown }> = [];
  upstream.use((req, _res, next) => {
    requests.push({ path: req.path, key: req.get('X-ML-API-Key'), authorization: req.get('Authorization'), body: req.body });
    next();
  });
  upstream.post('/v1/prices/forecast', (req, res) => {
    if (req.body.targetMonth === '2026-11') {
      res.status(422).json({ detail: { code: 'VALIDATION_ERROR', message: 'Choose an available month', fields: [{ path: 'targetMonth', message: 'Choose an available month' }] } });
    } else res.json(forecast);
  });
  upstream.get('/v1/prices/history', (req, res) => res.json({ produce_id: req.query.produceId, market_id: req.query.marketId,
    data_source: 'synthetic', prices: [{ month: '2026-09', price_per_kg_minor: 21000 }] }));
  const ml = await listen(upstream); t.after(() => close(ml.server));
  const deps = createDependencies({ stub: true, maxPlanMs: 1000 });
  deps.persistence = 'postgres'; // Public Insights works before login; marketplace routes still require it.
  const api = await listen(createApp(deps, [], { predictions: { baseUrl: ml.base, apiKey: 'test-service-key' } }));
  t.after(() => close(api.server));
  const post = (body: unknown) => fetch(api.base + '/api/ml/v1/prices/forecast', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer browser-token', 'X-ML-API-Key': 'untrusted-key' },
    body: JSON.stringify(body),
  });
  const response = await post({ produceId: 'tomato', marketId: 'dambulla', targetMonth: '2026-10' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), forecast);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(requests[0].key, 'test-service-key'); assert.equal(requests[0].authorization, undefined);
  const history = await fetch(api.base + '/api/ml/v1/prices/history?produceId=carrot&marketId=kandy');
  assert.equal(history.status, 200); assert.equal((await history.json()).produce_id, 'carrot');
  const invalid = await post({ produceId: 'mango', marketId: 'dambulla', targetMonth: '2026-10', url: 'https://other.example' });
  assert.equal(invalid.status, 422); assert.equal(requests.length, 2);
  const validation = await post({ produceId: 'tomato', marketId: 'dambulla', targetMonth: '2026-11' });
  assert.equal(validation.status, 422); assert.equal((await validation.json()).detail.fields[0].path, 'targetMonth');
  assert.equal((await fetch(api.base + '/api/ml/unknown')).status, 404);
  assert.equal((await fetch(api.base + '/api/orders')).status, 401);
});

test('prediction proxy bounds deadlines and rejects malformed responses, outages and redirects', async t => {
  let mode = 'malformed';
  const upstream = express(); upstream.use(express.json());
  upstream.post('/v1/prices/forecast', (_req, res) => {
    if (mode === 'hang') return;
    if (mode === 'outage') { res.status(503).json({ detail: { message: 'private upstream diagnostics' } }); return; }
    if (mode === 'redirect') { res.redirect('https://untrusted.example'); return; }
    res.json({ ...forecast, forecast_price_per_kg_minor: -1 });
  });
  const ml = await listen(upstream); t.after(() => { ml.server.closeAllConnections(); return close(ml.server); });
  const api = await listen(createApp(createDependencies({ stub: true, maxPlanMs: 1000 }), [], {
    predictions: { baseUrl: ml.base, timeoutMs: 100 },
  }));
  t.after(() => close(api.server));
  for (const value of ['malformed', 'outage', 'redirect', 'hang']) {
    mode = value;
    const response = await fetch(api.base + '/api/ml/v1/prices/forecast', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produceId: 'tomato', marketId: 'dambulla', targetMonth: '2026-10' }) });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error.code, value === 'hang' ? 'ML_TIMEOUT' : 'ML_UNAVAILABLE');
    assert.ok(!JSON.stringify(payload).includes('private upstream'));
  }
});

test('unconfigured predictions fail explicitly without affecting API health', async t => {
  const api = await listen(createApp(createDependencies({ stub: true, maxPlanMs: 1000 }), []));
  t.after(() => close(api.server));
  assert.equal((await fetch(api.base + '/health')).status, 200);
  const response = await fetch(api.base + '/api/ml/health');
  assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'ML_NOT_CONFIGURED');
});
