import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiClient } from '../src/core/llm.js';
import { createDependencies } from '../src/core/dependencies.js';
import { postgresPoolConfig } from '../src/core/postgres.js';
import { advocateTools } from '../src/modules/advocate/tools.js';
import { createMarketRepository } from '../src/modules/market/repository.js';
import { createWorkflowService } from '../src/modules/workflow/service.js';
import { setup } from './workflow-fixtures.js';

// Exercise P2's real provider-response parser rather than normalizing a fake ourselves.
test('P2 Gemini function calls pass advocate validation without deterministic fallback', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  const f = setup(); f.deps.mode = 'live';
  f.deps.llm = createGeminiClient('synthetic-test-key', 'gemini-test-model');
  globalThis.fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.toolConfig.functionCallingConfig.allowedFunctionNames[0], 'review_quotes');
    assert.deepEqual(body.tools[0].functionDeclarations[0].parametersJsonSchema, advocateTools[0].parameters);
    assert.equal(body.tools[0].functionDeclarations[0].parameters, undefined);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: {
      name: 'review_quotes', args: { selectedQuoteId: f.quote.quoteId, requestAlternative: false },
    } }] } }] }), { headers: { 'Content-Type': 'application/json' } });
  };
  const generated = await f.workflow().generate(f.listing.id);
  assert.equal(calls, 1);
  assert.equal(generated.mode, 'live');
  assert.equal(generated.plan?.mode, 'live');
  assert.ok(!generated.plan?.review.reasonCodes.includes('MODEL_FALLBACK'));
});

test('market fallback marker survives successful provider responses and labels persisted proposal fallback', async () => {
  const f = setup(); f.deps.mode = 'live';
  f.options.findMarket = async () => ({ listingId: f.listing.id, candidateOrderIds: [f.order.id],
    reasons: { [f.order.id]: 'Deterministic fallback: exact crop, sufficient demand, partial fill and timing verified' } });
  const service = f.workflow();
  const result = await service.generate(f.listing.id);
  assert.equal(result.mode, 'deterministic_fallback');
  assert.equal(result.searchComplete, true);
  assert.equal(result.plan?.mode, 'deterministic_fallback');
  assert.ok(result.trace.some(entry => entry.role === 'market' && entry.action === 'deterministic_fallback'));
  assert.equal((await service.getPlan(result.plan!.id)).mode, 'deterministic_fallback');
});

test('shared PostgreSQL configuration preserves strict TLS, startup options and API pool concurrency', async () => {
  const config = postgresPoolConfig('postgresql://demo@127.0.0.1/demo?sslmode=require&options=-c%20search_path%3Dexample');
  const url = new URL(config.connectionString!);
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  assert.equal(url.searchParams.get('options'), '-c search_path=example');
  assert.equal(config.connectionTimeoutMillis, 20_000);
  assert.equal(config.max, undefined);
  const deps = createDependencies({ databaseUrl: config.connectionString, stub: true, maxPlanMs: 45000 });
  assert.equal(deps.persistence, 'postgres');
  assert.equal(deps.mode, 'stub');
  await deps.db.close(); // Pool construction alone must not connect or send credentials.
});

test('missing market storage is not mislabeled as pending logistics', async () => {
  const f = setup(); f.deps.mode = 'live';
  const service = createWorkflowService(f.deps, createMarketRepository(f.deps), f.logistics, f.options);
  const result = await service.generate(f.listing.id);
  assert.equal(result.plan, null);
  assert.equal(result.searchComplete, false);
  assert.ok(result.trace.some(entry => entry.outcome === 'DEPENDENCY_UNAVAILABLE'));
  assert.ok(!result.trace.some(entry => entry.outcome === 'LOGISTICS_PENDING'));
});
