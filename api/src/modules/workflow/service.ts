import type { GenerationResult, Plan } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import type { MarketRepository } from '../market/repository.js';
import { findMarket } from '../market/service.js';
import type { LogisticsService } from '../logistics/service.js';
import { reviewOptions } from '../advocate/service.js';
import { ApiError, pending } from '../../core/errors.js';
export interface WorkflowService {
  generate(listingId: string): Promise<GenerationResult>;
  getPlan(id: string): Promise<Plan>;
  decide(id: string, decision: 'accept' | 'reject'): Promise<Plan>;
}
export function createWorkflowService(deps: Dependencies, market: MarketRepository, logistics: LogisticsService): WorkflowService {
  return {
    async generate(listingId) {
      const signal = AbortSignal.timeout(deps.maxPlanMs);
      const listing = await market.getListing(listingId);
      const candidates = await findMarket(listingId, deps, market, signal);
      const evaluated = await logistics.evaluate(candidates, signal);
      const quotes = await Promise.all(evaluated.options.map(option => logistics.getQuote(option.quoteId)));
      const review = await reviewOptions({ listing, quotes }, deps, signal);
      // P4: implement bounded live coordination, validated snapshots and persistence.
      return { outcome: 'no_feasible_plan', plan: null, alternatives: [], rejections: evaluated.rejections,
        searchComplete: false, trace: [{ role: 'workflow', action: 'stub_generation', outcome: review.explanation }] };
    },
    async getPlan(_id) { if (deps.mode !== 'stub') return pending('Plan repository (P4)'); throw new ApiError(404, 'NOT_FOUND', 'No saved plan exists in the starter'); },
    async decide(_id, _decision) { return pending('Plan decision and stale-snapshot validation (P4)'); },
  };
}
