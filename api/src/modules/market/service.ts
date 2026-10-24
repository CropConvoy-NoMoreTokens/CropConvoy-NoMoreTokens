import { extractResultSchema, type ApiMode, type ExtractInput, type ExtractResult, type MarketResult } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import type { MarketRepository } from './repository.js';
import { eligibleOrders, validatedCandidates, candidateIdsSchema, searchOrdersArguments, searchOrdersResultSchema } from './tools.js';
import { extractSystem, marketSystem } from './prompt.js';
import { ApiError } from '../../core/errors.js';

const fields = ['crop', 'quantityKg', 'locationText', 'readyAt', 'minNetMinor'] as const;
const questions: Record<(typeof fields)[number], string> = {
  crop: 'Which crop are you selling: tomato, potato, or carrot?',
  quantityKg: 'How many whole kilograms are available?',
  locationText: 'Where is the harvest pickup location?',
  readyAt: 'What exact date and time will the harvest be ready?',
  minNetMinor: 'What is your minimum total net proceeds in rupees?',
};

function emptyDraft(): ExtractResult['draft'] {
  return { crop: null, quantityKg: null, locationText: null, readyAt: null, minNetMinor: null };
}
function normalizeExtraction(value: unknown, input: ExtractInput): ExtractResult {
  const draft = extractResultSchema.shape.draft.parse((value as { draft?: unknown } | null)?.draft);
  const source = input.text;
  if (draft.crop && !new RegExp(`\\b${draft.crop === 'potato' ? 'potato(?:es)?' : draft.crop === 'tomato' ? 'tomato(?:es)?' : 'carrots?'}\\b`, 'i').test(source))
    draft.crop = null;
  const quantities = [...source.matchAll(/(?<![\d.,])(\d[\d,]*)\s*(?:kg|kilograms?)\b/gi)]
    .map(match => Number(match[1].replaceAll(',', '')));
  if (draft.quantityKg !== null && !quantities.includes(draft.quantityKg)) draft.quantityKg = null;
  if (draft.locationText && !source.toLowerCase().includes(draft.locationText.toLowerCase()))
    draft.locationText = null;
  const exactDay = /\b(?:today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(source);
  const exactTime = /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)|noon|midnight)\b/i.test(source);
  if (!exactDay || !exactTime) draft.readyAt = null;
  const net = source.match(/(?:at least|minimum|net|after transport|proceeds)[^.!?\n]{0,80}?(?:Rs\.?|LKR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const statedMinor = net ? Math.round(Number(net[1].replaceAll(',', '')) * 100) : null;
  if (draft.minNetMinor !== statedMinor) draft.minNetMinor = null;
  const missingFields = fields.filter(field => draft[field] === null);
  return { draft, missingFields, questions: missingFields.map(field => questions[field]) };
}

export async function extractHarvestWithMode(input: ExtractInput, deps: Dependencies): Promise<{ result: ExtractResult; mode: ApiMode }> {
  if (deps.mode === 'stub') {
    return { mode: 'stub', result: { draft: emptyDraft(), missingFields: [...fields],
      questions: ['Extraction is not connected yet. Enter and confirm the harvest fields manually.'] } };
  }
  try {
    const value = await deps.llm.complete({ role: 'market', system: extractSystem,
      input, tools: [], signal: AbortSignal.timeout(12000) });
    return { mode: 'live', result: normalizeExtraction(value, input) };
  } catch {
    return { mode: 'deterministic_fallback', result: { draft: emptyDraft(), missingFields: [...fields],
      questions: ['Automated extraction is unavailable. Enter and confirm every harvest field manually.'] } };
  }
}
export async function extractHarvest(input: ExtractInput, deps: Dependencies): Promise<ExtractResult> {
  return (await extractHarvestWithMode(input, deps)).result;
}

export async function findMarket(listingId: string, deps: Dependencies, repository: MarketRepository, signal: AbortSignal): Promise<MarketResult> {
  signal.throwIfAborted();
  const listing = await repository.getListing(listingId);
  if (listing.status !== 'open') return { listingId, candidateOrderIds: [], reasons: {} };
  const eligible = eligibleOrders(listing, await repository.listOrders());
  eligible.sort((a, b) => b.pricePerKgMinor - a.pricePerKgMinor || a.id.localeCompare(b.id));
  const searchResult = eligible.slice(0, 20);
  const deterministic = searchResult.slice(0, 3).map(order => order.id);
  if (deps.mode === 'stub' || eligible.length === 0) {
    return { listingId, candidateOrderIds: deps.mode === 'stub' ? [] : deterministic, reasons: {} };
  }
  let stage = 'searchOrders_call';
  try {
    const call = await deps.llm.complete({ role: 'market', system: marketSystem,
      input: { listingId }, signal,
      tools: [{ name: 'searchOrders', description: 'Return orders eligible for the whole listing',
        parameters: { type: 'object', properties: { listingId: { type: 'string' } },
          required: ['listingId'] } }] });
    stage = 'tool_name_validation';
    const tool = call as { name?: unknown; arguments?: unknown };
    if (tool.name !== 'searchOrders') throw new Error('Unexpected tool name');
    stage = 'tool_argument_validation';
    const args = searchOrdersArguments.parse(tool.arguments);
    stage = 'listing_id_validation';
    if (args.listingId !== listingId) throw new Error('Wrong listing ID');
    stage = 'candidate_ranking';
    const searchOrdersResult = searchOrdersResultSchema.parse({ eligibleOrders: searchResult.map(order => ({
      id: order.id, remainingKg: order.remainingKg, pricePerKgMinor: order.pricePerKgMinor,
      deadlineAt: order.deadlineAt, delivery: order.delivery,
    })) });
    const ranked = await deps.llm.complete({ role: 'market', system: marketSystem,
      input: { listingId, searchOrdersResult },
      signal, tools: [] });
    const ids = candidateIdsSchema.parse(ranked).candidateOrderIds;
    stage = 'candidate_validation';
    const valid = validatedCandidates(ids, searchResult);
    if (valid.length !== ids.length) throw new Error('Invalid candidate ID');
    return { listingId, candidateOrderIds: valid, reasons: Object.fromEntries(valid.map(id => [id, 'Eligible existing order selected from searchOrders'])) };
  } catch (error) {
    signal.throwIfAborted();
    console.warn(JSON.stringify({ event: 'market_fallback', stage,
      errorType: error instanceof ApiError ? error.code : error instanceof Error ? error.name : 'unknown' }));
    return { listingId, candidateOrderIds: deterministic,
      reasons: Object.fromEntries(deterministic.map(id => [id, 'Deterministic fallback: exact crop, sufficient demand, partial fill and timing verified'])) };
  }
}

export function marketUsedFallback(result: MarketResult): boolean {
  return Object.values(result.reasons).some(reason => reason.startsWith('Deterministic fallback:'));
}
