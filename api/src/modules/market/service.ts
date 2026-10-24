import type { ExtractInput, ExtractResult, MarketResult } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import type { MarketRepository } from './repository.js';
import { pending } from '../../core/errors.js';

export async function extractHarvest(_input: ExtractInput, deps: Dependencies): Promise<ExtractResult> {
  if (deps.mode !== 'stub') return pending('Harvest extraction (P2)');
  return {
    draft: { crop: null, quantityKg: null, locationText: null, readyAt: null, minNetMinor: null },
    missingFields: ['crop', 'quantityKg', 'locationText', 'readyAt', 'minNetMinor'],
    questions: ['Extraction is not connected yet. Enter and confirm the harvest fields manually.'],
  };
}
export async function findMarket(listingId: string, deps: Dependencies, repository: MarketRepository, signal: AbortSignal): Promise<MarketResult> {
  signal.throwIfAborted();
  await repository.getListing(listingId);
  if (deps.mode !== 'stub') return pending('Market agent (P2)');
  return { listingId, candidateOrderIds: [], reasons: {} };
}
