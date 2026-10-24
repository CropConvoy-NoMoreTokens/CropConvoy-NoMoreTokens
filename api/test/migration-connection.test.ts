import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { configureMigrationNetworking, migrationPoolConfig } from '../scripts/migration-connection.js';

test('migration connection preserves URL components and makes existing strict TLS behavior explicit', () => {
  const original = new URL('postgresql://demo:synthetic%40value@db.example.test/demo?sslmode=require&channel_binding=require');
  const config = migrationPoolConfig(original.toString());
  const normalized = new URL(config.connectionString!);
  assert.equal(normalized.searchParams.get('sslmode'), 'verify-full');
  assert.equal(normalized.searchParams.get('channel_binding'), 'require');
  assert.equal(normalized.username, original.username);
  assert.equal(normalized.password, original.password);
  assert.equal(normalized.host, original.host);
  assert.equal(normalized.pathname, original.pathname);
  assert.equal(config.connectionTimeoutMillis, 20_000);
  assert.equal(config.max, 1);
});

test('migration configuration leaves local and explicit TLS compatibility settings unchanged', () => {
  for (const input of ['postgres://localhost/demo',
    'postgresql://db.example.test/demo?sslmode=verify-full',
    'postgresql://db.example.test/demo?sslmode=require&uselibpqcompat=true']) {
    assert.equal(migrationPoolConfig(input).connectionString, new URL(input).toString());
  }
});

test('invalid configuration errors do not expose submitted credentials', () => {
  const sensitive = 'synthetic-credential';
  for (const input of [undefined, '', `invalid:${sensitive}`, `postgresql://[${sensitive}`]) {
    assert.throws(() => migrationPoolConfig(input), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(sensitive), false);
      return true;
    });
  }
});

test('migration networking raises short address timeouts and preserves a larger operator setting', () => {
  const previous = getDefaultAutoSelectFamilyAttemptTimeout();
  try {
    setDefaultAutoSelectFamilyAttemptTimeout(250);
    configureMigrationNetworking();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 2000);
    setDefaultAutoSelectFamilyAttemptTimeout(4000);
    configureMigrationNetworking();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 4000);
  } finally { setDefaultAutoSelectFamilyAttemptTimeout(previous); }
});
