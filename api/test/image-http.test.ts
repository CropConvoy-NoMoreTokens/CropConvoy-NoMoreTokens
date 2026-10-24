import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createDependencies } from '../src/core/dependencies.js';

test('harvest image endpoint accepts binary image data and keeps normal JSON limits', async t => {
  const deps = createDependencies({ stub: false, maxPlanMs: 45000 });
  deps.llm.readImage = async () => 'දඹුල්ලේ තක්කාලි කිලෝ 80';
  const server = createApp(deps, ['http://localhost:5173']).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await deps.db.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const response = await fetch(`${base}/api/harvest/image-text`, { method: 'POST',
    headers: { 'Content-Type': 'image/png' }, body: image });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).data, { text: 'දඹුල්ලේ තක්කාලි කිලෝ 80' });
  const unsupported = await fetch(`${base}/api/harvest/image-text`, { method: 'POST',
    headers: { 'Content-Type': 'application/pdf' }, body: image });
  assert.equal(unsupported.status, 415);
});
