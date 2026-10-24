import { quoteSnapshotSchema, type ReviewInput, type ReviewResult, type QuoteSnapshot } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { advocatePrompt } from './prompt.js';
import { advocateOutputSchema, advocateTools } from './tools.js';
import { within } from '../workflow/budget.js';

export const requiredRules = ['crop', 'demand', 'partialFill', 'capacity', 'simpleRoute',
  'pickupBeforeDelivery', 'corridor', 'snapping', 'readiness', 'deadline', 'detourDistance', 'detourTime'] as const;

export function quoteRejectionCodes(input: ReviewInput['listing'], quote: QuoteSnapshot): string[] {
  if (!quoteSnapshotSchema.safeParse(quote).success) return ['INVALID_QUOTE'];
  const codes: string[] = [];
  if (quote.listingId !== input.id || quote.quantityKg !== input.quantityKg) codes.push('SOURCE_MISMATCH');
  if (requiredRules.some(rule => quote.ruleOutcomes[rule] !== true) || Object.values(quote.ruleOutcomes).some(value => !value)) codes.push('HARD_RULE_FAILED');
  const gross = quote.quantityKg * quote.pricePerKgMinor;
  const distanceCharge = Math.round(quote.extraDistanceM / 1000 * quote.perKmMinor);
  const carryingCharge = Math.round(quote.quantityKg * (quote.routeCarryDistanceM / 1000) * quote.ratePerKgKmMinor);
  const transport = quote.baseMinor + carryingCharge + distanceCharge + quote.handlingMinor;
  const net = gross - transport;
  if (![gross, carryingCharge, distanceCharge, transport, net].every(Number.isSafeInteger) ||
      carryingCharge !== quote.shipmentChargeMinor || distanceCharge !== quote.detourChargeMinor ||
      gross !== quote.grossMinor || transport !== quote.transportMinor || net !== quote.netMinor) codes.push('INVALID_MONEY');
  if (quote.extraDistanceM !== Math.max(0, quote.modifiedDistanceM - quote.baseDistanceM) ||
      quote.extraTimeS < Math.max(0, quote.modifiedDurationS - quote.baseDurationS)) codes.push('INVALID_DETOUR');
  if (Date.parse(quote.pickupAt) < Date.parse(input.readyAt) || Date.parse(quote.deliveryAt) < Date.parse(quote.pickupAt)) codes.push('INVALID_TIMING');
  if (net < input.minNetMinor) codes.push('BELOW_MINIMUM_NET');
  return codes;
}

export function rankedQuotes(input: ReviewInput): QuoteSnapshot[] {
  return input.quotes.filter(quote => quoteRejectionCodes(input.listing, quote).length === 0)
    .sort((a, b) => b.netMinor - a.netMinor || a.quoteId.localeCompare(b.quoteId));
}

export function deterministicReview(input: ReviewInput): ReviewResult {
  const best = rankedQuotes(input)[0];
  return best ? { verdict: 'recommend', selectedQuoteId: best.quoteId, reasonCodes: ['MINIMUM_MET', 'BEST_EVALUATED_NET'],
    explanation: 'Highest feasible net proceeds in the evaluated set. Buyer and transporter confirmations remain pending.' } :
    { verdict: 'no_feasible_plan', selectedQuoteId: null,
      reasonCodes: [...new Set(input.quotes.flatMap(quote => quoteRejectionCodes(input.listing, quote)))].concat(input.quotes.length ? [] : ['NO_QUOTES']),
      explanation: 'No evaluated quote meets all hard rules and the farmer minimum.' };
}

export async function reviewOptions(input: ReviewInput, deps: Dependencies, signal: AbortSignal): Promise<ReviewResult> {
  signal.throwIfAborted();
  const deterministic = deterministicReview(input);
  if (deps.mode !== 'live') return deterministic;
  for (let turn = 0; turn < 2; turn++) {
    try {
      const raw = await within(signal, () => deps.llm.complete({ role: 'advocate',
        system: advocatePrompt, input: { minimumNetMinor: input.listing.minNetMinor,
          quotes: rankedQuotes(input).map(q => ({ quoteId: q.quoteId, netMinor: q.netMinor })), repair: turn > 0 },
        tools: advocateTools, signal }));
      const output = advocateOutputSchema.parse(raw);
      if (output.arguments.selectedQuoteId !== deterministic.selectedQuoteId) throw new Error('INVALID_SELECTION');
      if (output.arguments.requestAlternative && !deterministic.selectedQuoteId) return {
        ...deterministic, verdict: 'try_alternative', reasonCodes: [...deterministic.reasonCodes, 'ALTERNATIVE_REQUESTED'] };
      return deterministic;
    } catch {
      if (signal.aborted) throw signal.reason;
    }
  }
  return { ...deterministic, reasonCodes: [...deterministic.reasonCodes, 'MODEL_FALLBACK'] };
}
