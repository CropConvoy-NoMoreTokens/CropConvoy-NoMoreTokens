import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createDependencies } from '../src/core/dependencies.js';
import { demoUsers } from '../src/core/auth.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before checking demo auth');
const deps = createDependencies({ databaseUrl: process.env.DATABASE_URL, stub: true, maxPlanMs: 45000 });
const server = createApp(deps, ['http://localhost:5173']).listen(0, '127.0.0.1');
const tokens: string[] = [];
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const request = (path: string, token?: string, method = 'GET', body?: unknown) => fetch(base + path, {
  method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}), Origin: 'http://localhost:5173' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
try {
  assert.equal((await request('/ready')).status, 200);
  const preflight = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization',
  } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /authorization/i);
  assert.equal((await request('/api/orders')).status, 401);
  for (const user of demoUsers) {
    const response = await request('/api/auth/login', undefined, 'POST',
      { username: user.username, password: user.password });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-expose-headers'), 'X-Request-Id');
    const data = (await response.json()).data;
    assert.deepEqual(data.user, { id: user.id, username: user.username, role: user.role });
    tokens.push(data.token);
    const me = await request('/api/auth/me', data.token);
    assert.equal(me.status, 200);
    assert.equal((await me.json()).data.role, user.role);
  }
  assert.equal((await request('/api/orders', tokens[0])).status, 403);
  assert.equal((await request('/api/orders', tokens[1])).status, 200);
  assert.equal((await request('/api/trips', tokens[2])).status, 200);
  assert.equal((await request('/api/listings', tokens[0], 'POST', { demoFarmerId: demoUsers[1].id })).status, 403);
  assert.equal((await request('/api/auth/logout', tokens[0], 'POST')).status, 200);
  assert.equal((await request('/api/auth/me', tokens[0])).status, 401);
  console.log('Demo login, role checks, owner checks, logout and CORS passed');
} finally {
  for (const token of tokens) {
    const hash = createHash('sha256').update(token).digest('hex');
    await deps.db.query('DELETE FROM demo_sessions WHERE token_hash = $1', [hash]);
  }
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await deps.db.close();
}
