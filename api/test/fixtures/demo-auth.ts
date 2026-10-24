import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { demoUsers, hashPassword, type DemoRole } from '../../src/core/auth.js';

export type DemoTokens = Record<DemoRole, string>;

/** Seed only the isolated test database/schema; production uses the migration runner. */
export async function seedDemoAccounts(pool: Pool): Promise<void> {
  for (const user of demoUsers) {
    await pool.query('INSERT INTO demo_users (id, username, role, password_hash) VALUES ($1,$2,$3,$4)',
      [user.id, user.username, user.role, await hashPassword(user.password)]);
  }
}

export async function loginDemoAccounts(base: string, pool: Pool): Promise<DemoTokens> {
  const tokens = {} as DemoTokens;
  for (const user of demoUsers) {
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password: user.password }),
    });
    assert.equal(response.status, 200, `Demo ${user.role} login failed`);
    const { data } = await response.json();
    assert.equal(data.user.id, user.id);
    assert.equal(data.user.role, user.role);
    assert.match(data.token, /^[A-Za-z0-9_-]{43}$/);
    tokens[user.role] = data.token;
    // Business fixtures use fixed clocks; session authentication uses database now().
    // Keep this isolated test session valid independently of the fixture's calendar date.
    await pool.query("UPDATE demo_sessions SET expires_at = now() + interval '12 hours' WHERE token_hash = $1",
      [createHash('sha256').update(data.token).digest('hex')]);
  }
  return tokens;
}

export function demoAuthHeaders(tokens: DemoTokens, path: string): Record<string, string> {
  const role: DemoRole = path.startsWith('/api/orders') ? 'buyer'
    : path.startsWith('/api/trips') ? 'transporter' : 'farmer';
  return { Authorization: `Bearer ${tokens[role]}` };
}
