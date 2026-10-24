import type { LogisticsResult, MarketResult, Trip, TripInput, QuoteSnapshot } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError, pending } from '../../core/errors.js';
export interface LogisticsService {
  listTrips(): Promise<Trip[]>;
  createTrip(input: TripInput): Promise<Trip>;
  evaluate(market: MarketResult, signal: AbortSignal): Promise<LogisticsResult>;
  getQuote(quoteId: string): Promise<QuoteSnapshot>;
}
export function createLogisticsService(deps: Dependencies): LogisticsService {
  return {
    async listTrips() { if (deps.mode !== 'stub') return pending('Trip repository (P3)'); return []; },
    async createTrip(_input) { return pending('Trip registration and real road routing (P3)'); },
    async getQuote(_quoteId) { if (deps.mode !== 'stub') return pending('Validated quote lookup (P3)'); throw new ApiError(404, 'NOT_FOUND', 'No validated quote exists in the starter'); },
    async evaluate(_market, signal) {
      signal.throwIfAborted();
      if (deps.mode !== 'stub') return pending('Logistics agent (P3)');
      return { options: [], rejections: [] };
    },
  };
}
