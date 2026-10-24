import type { ReviewInput, ReviewResult } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { pending } from '../../core/errors.js';
export async function reviewOptions(_input: ReviewInput, deps: Dependencies, signal: AbortSignal): Promise<ReviewResult> {
  signal.throwIfAborted();
  if (deps.mode !== 'stub') return pending('Farmer advocate (P4)');
  return { verdict: 'no_feasible_plan', selectedQuoteId: null, reasonCodes: ['BACKEND_PENDING'], explanation: 'Matching and quote review are not implemented yet.' };
}
