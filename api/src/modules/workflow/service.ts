import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { generationResultSchema, logisticsResultSchema, marketResultSchema, quoteSnapshotSchema,
  type GenerationResult, type Plan, type MarketResult, type ReviewResult, type QuoteSnapshot, type TraceEntry } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import type { MarketRepository } from '../market/repository.js';
import { findMarket, marketUsedFallback } from '../market/service.js';
import type { LogisticsService, InstrumentedLogisticsService } from '../logistics/service.js';
import { deterministicReview, rankedQuotes, reviewOptions } from '../advocate/service.js';
import { ApiError } from '../../core/errors.js';
import { createPlanRepository, type PlanRepository } from './repository.js';
import { createBudget, within } from './budget.js';
import { parseSources, sourceRejectionCodes } from './validation.js';

export interface WorkflowService {
  generate(listingId: string): Promise<GenerationResult>;
  getPlan(id: string): Promise<Plan>;
  decide(id: string, decision: 'accept' | 'reject'): Promise<Plan>;
}
export interface WorkflowOptions {
  repository?: PlanRepository;
  findMarket?: typeof findMarket;
  // P2 must construct P3 with these request-scoped adapters to enforce external-call budgets.
  logisticsForGeneration?: (scoped: Dependencies) => LogisticsService;
}

export function createWorkflowService(deps: Dependencies, market: MarketRepository, logistics: LogisticsService,
  options: WorkflowOptions = {}): WorkflowService {
  const plans = options.repository ?? createPlanRepository(deps);
  const loadSources = async (listingId: string, orderId: string, tripId: string) => {
    const [listing, orders, trips] = await Promise.all([market.getListing(listingId), market.listOrders(), logistics.listTrips()]);
    const order = orders.find(row => row.id === orderId);
    const trip = trips.find(row => row.id === tripId);
    if (!order || !trip) throw new ApiError(409, 'STALE_PLAN', 'Proposal source is unavailable; generate a new proposal');
    return parseSources({ listing, order, trip });
  };
  return {
    async generate(listingId) {
      if (deps.persistence==='postgres' && deps.db.transaction) {
        const {rows}=await deps.db.query("SELECT p.id FROM plans p WHERE listing_id=$1 AND (status='confirmed' OR (status='farmer_accepted_pending_confirmations' AND expires_at>$2))",[listingId,deps.clock.now().toISOString()]);
        if(rows.length) throw new ApiError(409,'ACTIVE_PROPOSAL','This harvest already has an active accepted proposal');
      }

      const budget = createBudget(deps);
      // Reserve a small part of the total deadline for storing already evaluated results.
      const totalMs = Math.min(45_000, Math.max(1, Number.isFinite(deps.maxPlanMs) ? deps.maxPlanMs : 45_000));
      const searchSignal = AbortSignal.any([budget.signal, AbortSignal.timeout(Math.max(1, Math.floor(totalMs * 0.9)))]);
      const trace: TraceEntry[] = [];
      const rejections: GenerationResult['rejections'] = [];
      const quotes: QuoteSnapshot[] = [];
      const combinations = new Set<string>();
      const sources = new Map<string, Plan['sourceSnapshot']>();
      const seenLogisticsTrace = new Set<string>();
      let listing: Plan['sourceSnapshot']['listing'] | undefined;
      let complete = deps.mode !== 'stub';
      let review: ReviewResult | undefined;
      let stage: 'market' | 'logistics' | 'advocate' = 'market';
      const record = (role: TraceEntry['role'], action: string, outcome: string) => trace.push({ role, action, outcome });
      try {
        try {
          listing = structuredClone(await within(searchSignal, () => market.getListing(listingId)));
          const candidates = marketResultSchema.parse(await within(searchSignal,
            () => (options.findMarket ?? findMarket)(listingId, budget.deps, market, searchSignal)));
          if (candidates.listingId !== listingId) throw new Error('INVALID_MARKET_RESULT');
          if (marketUsedFallback(candidates)) {
            budget.markFallback();
            record('market', 'deterministic_fallback',
              'Deterministic market fallback applied: matching crop, sufficient demand, partial-fill permission and order deadline checked. Model ranking unavailable or invalid.');
          }
          const ids = [...new Set(candidates.candidateOrderIds)];
          record('market', 'find_candidates', `${ids.length} buyer candidates evaluated`);
          if (ids.length && !options.logisticsForGeneration && deps.mode !== 'stub') {
            throw new ApiError(503, 'BUDGET_WIRING_REQUIRED', 'P2 must inject logisticsForGeneration with request-scoped dependencies');
          }
          const scopedLogistics = options.logisticsForGeneration?.(budget.deps) ?? logistics;
          stage = 'logistics';
          const [initialOrders, initialTrips] = structuredClone(ids.length ? await within(searchSignal,
            () => Promise.all([market.listOrders(), logistics.listTrips()])) : [[], []]);
          // One initial bounded batch, then at most one alternative batch. Both share all budgets.
          const batches = [ids.slice(0, 2), ids.slice(2, 3)].filter(batch => batch.length);
          for (let attempt = 0; attempt < batches.length; attempt++) {
            const batch: MarketResult = { ...candidates, candidateOrderIds: batches[attempt] };
            const evaluationStartedAt = deps.clock.now().getTime();
            // P3 stops routing at the search deadline and returns already saved quotes.
            // Allow that bounded cleanup to finish within the remaining total deadline.
            const evaluated = logisticsResultSchema.parse(await within(budget.signal, () => scopedLogistics.evaluate(batch, searchSignal)));
            if (searchSignal.aborted) complete = false;
            const diagnostics = (scopedLogistics as Partial<InstrumentedLogisticsService>).getRunDiagnostics?.(searchSignal);
            if (diagnostics) {
              complete = complete && diagnostics.searchComplete;
              if (diagnostics.mode === 'deterministic_fallback') budget.markFallback();
              for (const entry of diagnostics.trace) {
                // Model prose is advisory, never an observable workflow trace.
                const outcome = entry.action === 'agent_comparison' ? 'Model comparison completed; quote amounts and feasibility were verified in code.' :
                  entry.action === 'deterministic_fallback' ? 'Logistics used deterministic route, constraint and fare checks.' :
                  entry.action === 'deadline_reached' ? 'Search deadline reached; retaining only validated saved quotes.' :
                  entry.action === 'evaluate_trip' && /^[0-9a-f-]{36}( validated; quote [0-9a-f-]{36}|: [A-Z0-9_, ]+)$/i.test(entry.outcome)
                    ? entry.outcome : undefined;
                if (outcome === undefined) continue;
                const safe = { role: 'logistics' as const, action: entry.action, outcome: outcome.slice(0, 500) };
                const key = JSON.stringify(safe);
                if (!seenLogisticsTrace.has(key)) { trace.push(safe); seenLogisticsTrace.add(key); }
              }
            }
            for (const pair of evaluated.options) {
              if (!batch.candidateOrderIds.includes(pair.orderId)) throw new Error('UNKNOWN_ORDER_ID');
              combinations.add(`${pair.orderId}:${pair.tripId}`);
            }
            if (combinations.size > 6 || evaluated.options.length > 6) throw new Error('INVALID_LOGISTICS_RESULT');
            rejections.push(...evaluated.rejections);
            record('logistics', attempt ? 'alternative_evaluation' : 'evaluate', `${evaluated.options.length} quote summaries returned`);
            // Sequential retrieval bounds repository concurrency and preserves each validated partial result.
            for (const summary of evaluated.options) {
              if (!batch.candidateOrderIds.includes(summary.orderId)) throw new Error('UNKNOWN_ORDER_ID');
              try {
                const readSignal = searchSignal.aborted ? budget.signal : searchSignal;
                const quote = quoteSnapshotSchema.parse(await within(readSignal, () => scopedLogistics.getQuote(summary.quoteId)));
                if (quote.quoteId !== summary.quoteId || quote.listingId !== listingId || quote.orderId !== summary.orderId ||
                    quote.tripId !== summary.tripId || quote.transportMinor !== summary.transportMinor ||
                    quote.extraDistanceM !== summary.extraDistanceM || quote.deliveryAt !== summary.deliveryAt) throw new Error('INVALID_QUOTE_HANDOFF');
                const current = await within(readSignal, () => loadSources(listingId, quote.orderId, quote.tripId));
                const codes = sourceRejectionCodes(quote, current);
                if (!isDeepStrictEqual(current, { listing,
                  order: initialOrders.find(order => order.id === quote.orderId),
                  trip: initialTrips.find(trip => trip.id === quote.tripId) })) codes.push('SOURCE_CHANGED_DURING_EVALUATION');
                if (Date.parse(quote.expiresAt) <= deps.clock.now().getTime() ||
                    Date.parse(quote.generatedAt) < evaluationStartedAt || Date.parse(quote.generatedAt) > deps.clock.now().getTime() ||
                    Date.parse(quote.generatedAt) + 15 * 60_000 <= deps.clock.now().getTime() ||
                    Date.parse(quote.pickupAt) <= deps.clock.now().getTime()) codes.push('EXPIRED_QUOTE');
                if (codes.length) rejections.push({ orderId: quote.orderId, tripId: quote.tripId, codes });
                else if (!sources.has(quote.quoteId)) { quotes.push(quote); sources.set(quote.quoteId, current); }
              } catch (error) {
                if (searchSignal.aborted) throw error;
                complete = false;
                rejections.push({ orderId: summary.orderId, tripId: summary.tripId, codes: ['INVALID_QUOTE'] });
              }
            }
            if (quotes.length) break;
            searchSignal.throwIfAborted();
          }
          stage = 'advocate';
          review = await reviewOptions({ listing, quotes }, budget.deps, searchSignal);
        } catch (error) {
          if (error instanceof ApiError && (error.status === 404 || error.code === 'BUDGET_WIRING_REQUIRED')) throw error;
          complete = false;
          record('workflow', 'search_interrupted', searchSignal.aborted ? 'DEADLINE_EXCEEDED' :
            stage === 'logistics' && error instanceof ApiError && error.code === 'NOT_IMPLEMENTED'
              ? 'LOGISTICS_PENDING' : 'DEPENDENCY_UNAVAILABLE');
        }
        if (!listing) return generationResultSchema.parse({ outcome: 'no_feasible_plan', plan: null, alternatives: [],
          rejections, trace, searchComplete: false, mode: budget.mode });
        if (!review) {
          review = deterministicReview({ listing, quotes });
          if (deps.mode !== 'stub') budget.markFallback();
        }
        if (review.reasonCodes.includes('MODEL_FALLBACK')) budget.markFallback();
        if (budget.limited) complete = false;
        record('advocate', 'review', review.selectedQuoteId ? 'BEST_EVALUATED_NET' : 'NO_FEASIBLE_QUOTE');
        const ranked = rankedQuotes({ listing, quotes });
        const selected = ranked[0]; // Always code-selected; model IDs cannot introduce an option.
        let plan: Plan | null = null;
        if (selected && !budget.signal.aborted) {
          const now = deps.clock.now();
          const expiresAt = new Date(Math.min(now.getTime() + 15 * 60_000,
            Date.parse(selected.expiresAt), Date.parse(selected.generatedAt) + 15 * 60_000, Date.parse(selected.pickupAt))).toISOString();
          if (Date.parse(expiresAt) > now.getTime()) {
            record('workflow', 'proposal_validated', 'READY_TO_PERSIST');
            try { plan = await plans.save({ id: randomUUID(), listingId, orderId: selected.orderId, tripId: selected.tripId,
              quantityKg: selected.quantityKg, status: 'proposed', quoteSnapshot: selected, review,
              sourceSnapshot: sources.get(selected.quoteId)!, mode: budget.mode, searchComplete: complete, trace: [...trace],
              expiresAt, createdAt: now.toISOString() }, budget.signal); }
            catch (error) {
              if (!budget.signal.aborted) throw error;
              complete = false;
              record('workflow', 'persistence_interrupted', 'DEADLINE_EXCEEDED');
            }
          }
        }
        return generationResultSchema.parse({ outcome: plan ? 'proposed' : 'no_feasible_plan', plan,
          alternatives: ranked.slice(1, 2), rejections, trace, searchComplete: complete, mode: budget.mode });
      } finally { budget.close(); }
    },
    getPlan: id => plans.get(id),
    async decide(id, decision) {
      const plan = await plans.get(id);
      const target = decision === 'accept' ? 'farmer_accepted_pending_confirmations' : 'rejected';
      if (plan.status === target) return plan;
      if (plan.status !== 'proposed') throw new ApiError(409, 'PLAN_CONFLICT', 'A conflicting decision was already recorded');
      if (Math.min(Date.parse(plan.expiresAt), Date.parse(plan.quoteSnapshot.expiresAt)) <= deps.clock.now().getTime())
        throw new ApiError(409, 'PLAN_EXPIRED', 'Proposal expired; generate a new proposal');
      if (decision === 'accept') {
        let current: Plan['sourceSnapshot'];
        try { current = await loadSources(plan.listingId, plan.orderId, plan.tripId); }
        catch (error) {
          if (error instanceof ApiError && (error.status === 404 || error.status === 409))
            throw new ApiError(409, 'STALE_PLAN', 'Proposal source changed; generate a new proposal');
          throw error;
        }
        if (!isDeepStrictEqual(current, plan.sourceSnapshot) || sourceRejectionCodes(plan.quoteSnapshot, current).length)
          throw new ApiError(409, 'STALE_PLAN', 'Proposal source changed; generate a new proposal');
      }
      return plans.transition(id, target, deps.clock.now().toISOString());
    },
  };
}
