import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createGeminiClient } from '../src/core/llm.js';
import { extractResultSchema } from '../src/core/contracts.js';
import { extractSystem, marketSystem } from '../src/modules/market/prompt.js';
import { extractHarvestWithMode } from '../src/modules/market/service.js';
import type { Dependencies } from '../src/core/dependencies.js';

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
const sinhalaText = 'දඹුල්ලේ තක්කාලි කිලෝ 80 තියෙනවා. හෙට උදේ 8ට සූදානම්. අවම ශුද්ධ මුදල රු. 16000.';
const sinhalaExtraction = await extractHarvestWithMode({ text: sinhalaText,
  localTimeContext: { now: '2026-10-24T04:30:00.000Z', timeZone: 'Asia/Colombo' } },
  { mode: 'live', llm: client } as Dependencies);
assert.equal(sinhalaExtraction.mode, 'live', 'Sinhala extraction fell back to manual entry');
const sinhalaDraft = sinhalaExtraction.result.draft;
assert.equal(sinhalaDraft.crop, 'tomato');
assert.equal(sinhalaDraft.quantityKg, 80);
assert.ok(sinhalaDraft.locationText && sinhalaText.includes(sinhalaDraft.locationText),
  'Sinhala location must be a substring of the original description');
console.log('Gemini Sinhala harvest extraction: passed');
const imageBytes = await readFile(new URL('../test/fixtures/harvest-note.png', import.meta.url));
const imageText = await client.readImage?.({ bytes: imageBytes, mimeType: 'image/png', signal: AbortSignal.timeout(60000) });
assert.ok(imageText && /80\s*kg/i.test(imageText) && /tomatoes/i.test(imageText) && /Dambulla/i.test(imageText),
  'Gemini did not transcribe the synthetic harvest note');
console.log('Gemini harvest image transcription: passed');
const listingId = randomUUID();
const call = await client.complete({ role: 'market', system: marketSystem,
  input: { listingId }, tools: [{ name: 'searchOrders', description: 'Search eligible orders',
    parameters: { type: 'object', properties: { listingId: { type: 'string' } },
      required: ['listingId'] } }], signal: AbortSignal.timeout(60000) });
assert.equal((call as { name?: unknown }).name, 'searchOrders');
assert.equal((call as { arguments?: { listingId?: unknown } }).arguments?.listingId, listingId);
console.log('Gemini model structured output and tool calling: passed');
