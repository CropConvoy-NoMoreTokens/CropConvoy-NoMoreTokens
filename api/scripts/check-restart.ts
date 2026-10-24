import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { demoUsers } from '../src/core/auth.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before checking API restart');
const port = await new Promise<number>((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') return reject(new Error('No test port'));
    probe.close(() => resolve(address.port));
  });
});
const base = `http://127.0.0.1:${port}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const farmerId = demoUsers[0].id;
const buyerId = demoUsers[1].id;
let listingId: string | undefined;
let orderId: string | undefined;
let child: ChildProcess | undefined;
const tokens: string[] = [];
async function start() {
  child = spawn(process.execPath, ['dist/server.js'], { cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), API_STUBS: 'false' },
    stdio: 'ignore', windowsHide: true });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error('API exited before becoming ready');
    try {
      const response = await fetch(base + '/ready', { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch { /* Wait for startup or Neon wake-up. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('API did not become ready');
}
async function stop() {
  if (!child) return;
  const running = child;
  child = undefined;
  if (running.exitCode === null) {
    const exited = new Promise<void>(resolve => running.once('exit', () => resolve()));
    running.kill();
    await exited;
  }
}
async function loginUser(user: (typeof demoUsers)[number]) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, password: user.password }) });
  assert.equal(response.status, 200);
  const token = ((await response.json()) as { data: { token: string } }).data.token;
  tokens.push(token);
  return token;
}
async function post(path: string, body: unknown, token: string) {
  const response = await fetch(base + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  assert.equal(response.status, 201);
  return (await response.json() as { data: { id: string } }).data.id;
}
try {
  await start();
  const farmerToken = await loginUser(demoUsers[0]);
  const buyerToken = await loginUser(demoUsers[1]);
  const readyAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  listingId = await post('/api/listings', { demoFarmerId: farmerId, crop: 'tomato',
    quantityKg: 80, pickup: { lat: 6.9, lng: 79.9 }, readyAt,
    minNetMinor: 10000, confirmed: true }, farmerToken);
  orderId = await post('/api/orders', { demoBuyerId: buyerId, crop: 'tomato',
    remainingKg: 100, pricePerKgMinor: 22000, delivery: { lat: 7, lng: 80 },
    deadlineAt, allowsPartial: true }, buyerToken);
  await stop();
  await start();
  const listing = await (await fetch(base + '/api/listings/' + listingId,
    { headers: { Authorization: `Bearer ${farmerToken}` } })).json() as {
    data: { quantityKg: number }; meta: { persistence: string };
  };
  assert.equal(listing.data.quantityKg, 80);
  assert.equal(listing.meta.persistence, 'postgres');
  const orders = await (await fetch(base + '/api/orders',
    { headers: { Authorization: `Bearer ${buyerToken}` } })).json() as {
    data: Array<{ id: string }>;
  };
  assert.ok(orders.data.some(order => order.id === orderId));
  console.log('Listing/order HTTP persistence across API process restart: passed');
} finally {
  await stop();
  if (orderId) await pool.query('DELETE FROM orders WHERE id = $1 AND demo_buyer_id = $2', [orderId, buyerId]);
  if (listingId) await pool.query('DELETE FROM listings WHERE id = $1 AND demo_farmer_id = $2', [listingId, farmerId]);
  for (const token of tokens) await pool.query('DELETE FROM demo_sessions WHERE token_hash = $1',
    [createHash('sha256').update(token).digest('hex')]);
  await pool.end();
}
