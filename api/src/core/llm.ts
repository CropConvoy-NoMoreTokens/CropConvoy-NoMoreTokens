import { ApiError } from './errors.js';
import type { LlmClient } from './dependencies.js';
import { z } from 'zod';

const nullable = (type: 'string' | 'integer', extra: Record<string, unknown> = {}) =>
  ({ type: [type, 'null'], ...extra });
const harvestSchema = {
  type: 'object', additionalProperties: false, required: ['draft'],
  properties: { draft: { type: 'object', additionalProperties: false,
    required: ['crop', 'quantityKg', 'locationText', 'readyAt', 'minNetMinor'],
    properties: {
      crop: nullable('string', { enum: ['tomato', 'potato', 'carrot', null] }),
      quantityKg: nullable('integer', { minimum: 1, maximum: 2147483647 }),
      locationText: nullable('string'),
      readyAt: nullable('string', { description: 'UTC ISO 8601 timestamp ending in Z' }),
      minNetMinor: nullable('integer', { minimum: 0 }),
    } } },
};
const candidatesSchema = { type: 'object', additionalProperties: false,
  required: ['candidateOrderIds'], properties: { candidateOrderIds: {
    type: 'array', maxItems: 3, items: { type: 'string' },
  } } };

export function createGeminiClient(key: string, model: string, baseUrl = 'https://generativelanguage.googleapis.com'): LlmClient {
  // Accept dashboard/gateway style labels but address the Gemini REST model directly.
  const modelId = model.replace(/^(?:gemini\/|models\/)/, '');
  if (!/^[a-zA-Z0-9._-]+$/.test(modelId)) throw new Error('Invalid LLM_MODEL');
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('LLM_BASE_URL must use HTTPS');
  return {
    async complete({ role, system, input, tools, signal }) {
      signal.throwIfAborted();
      const names = new Set<string>();
      const validators = new Map<string, z.ZodType>();
      for (const tool of tools) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tool.name) || names.has(tool.name)) throw new Error('Invalid or duplicate tool name');
        names.add(tool.name);
        validators.set(tool.name, z.fromJSONSchema(tool.parameters as Parameters<typeof z.fromJSONSchema>[0]));
      }
      const url = new URL(`/v1beta/models/${modelId}:generateContent`, base);
      const marketInput = input as { text?: unknown; searchOrdersResult?: unknown } | null;
      const responseJsonSchema = role === 'market' && !tools.length
        ? marketInput && typeof marketInput.text === 'string' ? harvestSchema
          : marketInput?.searchOrdersResult ? candidatesSchema : undefined
        : undefined;
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { temperature: 0, ...(tools.length ? {} : {
          responseMimeType: 'application/json', ...(responseJsonSchema ? { responseJsonSchema } : {}),
        }) },
        ...(tools.length ? { tools: [{ functionDeclarations: tools.map(tool => ({
          name: tool.name, description: tool.description, parameters: tool.parameters,
        })) }], toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [...names] } } } : {}),
      };
      const response = await fetch(url, { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body) });
      if (!response.ok) throw new ApiError(503, `LLM_HTTP_${response.status}`, 'Model request failed');
      const payload = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }> } }>;
      };
      const part = payload.candidates?.[0]?.content?.parts?.[0];
      if (!part) throw new ApiError(503, 'LLM_INVALID_RESPONSE', 'Model returned no content');
      if (tools.length) {
        const call = part.functionCall;
        if (!call?.name || !names.has(call.name) || !call.args || typeof call.args !== 'object' || Array.isArray(call.args))
          throw new ApiError(503, 'LLM_INVALID_TOOL', 'Model returned an invalid tool call');
        const parsed = validators.get(call.name)!.safeParse(call.args);
        if (!parsed.success) throw new ApiError(503, 'LLM_INVALID_TOOL', 'Model returned invalid tool arguments');
        return { name: call.name, arguments: parsed.data };
      }
      if (!part.text || part.text.length > 20000) throw new ApiError(503, 'LLM_INVALID_RESPONSE', 'Model returned invalid text');
      try { return JSON.parse(part.text); }
      catch { throw new ApiError(503, 'LLM_INVALID_RESPONSE', 'Model returned invalid JSON'); }
    },
  };
}
