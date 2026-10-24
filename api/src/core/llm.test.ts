import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiClient } from './llm.js';

const tool = { name: 'searchOrders', description: 'Find orders',
  parameters: { type: 'object', additionalProperties: false,
    properties: { listingId: { type: 'string' } }, required: ['listingId'] } };

test('Gemini adapter rejects unknown tool names and invalid arguments', async () => {
  const original = globalThis.fetch;
  let call: { name: string; args: unknown } = { name: 'otherTool', args: { listingId: 'id' } };
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: {
    parts: [{ functionCall: call }],
  } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const client = createGeminiClient('synthetic-key', 'gemini/gemini-3.5-flash-lite');
    const input = { role: 'market' as const, system: 'Call the tool', input: {},
      tools: [tool], signal: new AbortController().signal };
    await assert.rejects(client.complete(input), /invalid tool call/i);
    call = { name: 'searchOrders', args: { listingId: 42 } };
    await assert.rejects(client.complete(input), /invalid tool arguments/i);
    call = { name: 'searchOrders', args: { listingId: 'id' } };
    assert.deepEqual(await client.complete(input), { name: 'searchOrders', arguments: { listingId: 'id' } });
  } finally { globalThis.fetch = original; }
});
