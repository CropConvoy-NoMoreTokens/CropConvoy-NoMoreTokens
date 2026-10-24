import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dependencies } from './dependencies.js';
import { ApiError } from './errors.js';
import { authenticate, authorizeRequest, demoUsers, hashPassword, login, logout } from './auth.js';

test('demo login stores only a token hash, validates sessions, and revokes logout', async () => {
  const farmer = demoUsers[0];
  const passwordHash = await hashPassword(farmer.password);
  assert.equal(passwordHash.includes(farmer.password), false);
  let session: { tokenHash: string; userId: string; expiresAt: string; revoked: boolean } | null = null;
  const deps = {
    persistence: 'postgres', clock: { now: () => new Date('2026-10-24T10:00:00.000Z') },
    db: { async query(sql: string, values: unknown[] = []) {
      if (sql.includes('FROM demo_users WHERE username'))
        return { rows: values[0] === farmer.username ? [{ ...farmer, password_hash: passwordHash, active: true }] : [] };
      if (sql.startsWith('INSERT INTO demo_sessions')) {
        session = { tokenHash: values[0] as string, userId: values[1] as string,
          expiresAt: values[2] as string, revoked: false };
        return { rows: [] };
      }
      if (sql.includes('FROM demo_sessions s'))
        return { rows: session && !session.revoked && session.tokenHash === values[0]
          ? [{ id: farmer.id, username: farmer.username, role: farmer.role }] : [] };
      if (sql.startsWith('UPDATE demo_sessions')) {
        if (session?.tokenHash === values[0]) session.revoked = true;
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    } },
  } as unknown as Dependencies;
  await assert.rejects(login(deps, { username: 'farmer', password: 'wrong' }),
    (error: unknown) => error instanceof ApiError && error.status === 401);
  await assert.rejects(login(deps, { username: 'missing', password: 'wrong' }),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_CREDENTIALS');
  const result = await login(deps, { username: farmer.username, password: farmer.password });
  assert.deepEqual(result.user, { id: farmer.id, username: farmer.username, role: farmer.role });
  assert.equal(result.expiresAt, '2026-10-24T22:00:00.000Z');
  assert.equal(result.token.length, 43);
  assert.notEqual(session?.tokenHash, result.token);
  await assert.rejects(authenticate(deps, undefined),
    (error: unknown) => error instanceof ApiError && error.status === 401);
  const active = await authenticate(deps, `Bearer ${result.token}`);
  assert.equal(active.user.id, farmer.id);
  await logout(deps, active.tokenHash);
  await assert.rejects(authenticate(deps, `Bearer ${result.token}`),
    (error: unknown) => error instanceof ApiError && error.code === 'SESSION_INVALID');
});

test('role and owner checks reject cross-workspace writes and inaccessible records', async () => {
  const farmer = demoUsers[0];
  const buyer = demoUsers[1];
  const listingId = '44444444-4444-4444-8444-444444444444';
  const deps = { db: { async query(_sql: string, values: unknown[]) {
    return { rows: values[0] === listingId && values[1] === farmer.id ? [{ '?column?': 1 }] : [] };
  } } } as unknown as Dependencies;
  await assert.rejects(authorizeRequest(deps, buyer, 'POST', '/listings', { demoFarmerId: farmer.id }),
    (error: unknown) => error instanceof ApiError && error.status === 403);
  await assert.rejects(authorizeRequest(deps, farmer, 'POST', '/listings', { demoFarmerId: buyer.id }),
    (error: unknown) => error instanceof ApiError && error.code === 'OWNER_MISMATCH');
  await authorizeRequest(deps, farmer, 'POST', '/listings', { demoFarmerId: farmer.id });
  await authorizeRequest(deps, farmer, 'POST', '/locations/resolve', { place: 'දඹුල්ල' });
  await authorizeRequest(deps, farmer, 'POST', '/harvest/image-text', undefined);
  await assert.rejects(authorizeRequest(deps, buyer, 'POST', '/harvest/image-text', undefined),
    (error: unknown) => error instanceof ApiError && error.status === 403);
  await assert.rejects(authorizeRequest(deps, buyer, 'POST', '/locations/resolve', { place: 'දඹුල්ල' }),
    (error: unknown) => error instanceof ApiError && error.status === 403);
  await authorizeRequest(deps, farmer, 'GET', `/listings/${listingId}`, undefined);
  await assert.rejects(authorizeRequest(deps, buyer, 'GET', '/orders', undefined).then(() =>
    authorizeRequest(deps, buyer, 'POST', '/orders', { demoBuyerId: farmer.id })),
    (error: unknown) => error instanceof ApiError && error.code === 'OWNER_MISMATCH');
  await assert.rejects(authorizeRequest(deps, farmer, 'GET', '/listings/55555555-5555-4555-8555-555555555555', undefined),
    (error: unknown) => error instanceof ApiError && error.status === 404);
});
