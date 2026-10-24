import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGeminiClient } from '../src/core/llm.js';
import { extractResultSchema } from '../src/core/contracts.js';
import { extractSystem, marketSystem } from '../src/modules/market/prompt.js';

const key = process.env.LLM_API_KEY;
const model = process.env.LLM_MODEL;
if (!key || !model) throw new Error('Set LLM_API_KEY and LLM_MODEL in api/.env first');
const modelId = model.replace(/^(?:gemini\/|models\/)/, '');
const modelUrl = new URL(`/v1beta/models/${modelId}`, process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com');
const modelResponse = await fetch(modelUrl, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000) });
if (!modelResponse.ok) throw new Error(`Gemini model lookup failed with HTTP ${modelResponse.status}`);
const modelInfo = await modelResponse.json() as { supportedGenerationMethods?: string[] };
assert.ok(modelInfo.supportedGenerationMethods?.includes('generateContent'), 'Model does not support generateContent');
console.log('Gemini model lookup: passed');
const simpleUrl = new URL(`/v1beta/models/${modelId}:generateContent`, modelUrl);
const simpleResponse = await fetch(simpleUrl, { method: 'POST',
  headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK.' }] }],
    generationConfig: { maxOutputTokens: 16 } }), signal: AbortSignal.timeout(20000) });
if (!simpleResponse.ok) {
  const failure = await simpleResponse.json().catch(() => null) as { error?: { status?: string; message?: string } } | null;
  throw new Error(`Gemini basic generation failed with HTTP ${simpleResponse.status}: ${failure?.error?.status ?? 'unknown'} ${failure?.error?.message ?? ''}`);
}
console.log('Gemini basic generation: passed');
const client = createGeminiClient(key, model, process.env.LLM_BASE_URL);
const extraction = await client.complete({ role: 'market', system: extractSystem,
  input: { text: 'I have 80 kg of tomatoes in Colombo.',
    localTimeContext: { now: '2026-10-24T00:00:00.000Z', timeZone: 'Asia/Colombo' } },
  tools: [], signal: AbortSignal.timeout(60000) });
extractResultSchema.shape.draft.parse((extraction as { draft?: unknown }).draft);
const listingId = randomUUID();
const call = await client.complete({ role: 'market', system: marketSystem,
  input: { listingId }, tools: [{ name: 'searchOrders', description: 'Search eligible orders',
    parameters: { type: 'object', properties: { listingId: { type: 'string' } },
      required: ['listingId'] } }], signal: AbortSignal.timeout(60000) });
assert.equal((call as { name?: unknown }).name, 'searchOrders');
assert.equal((call as { arguments?: { listingId?: unknown } }).arguments?.listingId, listingId);
console.log('Gemini model structured output and tool calling: passed');
