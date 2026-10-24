import type { Dependencies } from '../../core/dependencies.js';

export class BudgetExceeded extends Error {}

/** Race even adapters that ignore cancellation; late results cannot enter workflow state. */
export async function within<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([Promise.resolve().then(work), cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}

export function createBudget(deps: Dependencies) {
  const controller = new AbortController();
  const duration = Math.min(45_000, Math.max(1, Number.isFinite(deps.maxPlanMs) ? deps.maxPlanMs : 45_000));
  const timer = setTimeout(() => controller.abort(new BudgetExceeded('DEADLINE_EXCEEDED')), duration);
  const signal = controller.signal;
  const turns = { market: 0, logistics: 0, advocate: 0 };
  let routes = 0;
  let activeRoutes = 0;
  const waiting: Array<() => void> = [];
  const acquireRoute = async (combined: AbortSignal) => {
    combined.throwIfAborted();
    if (activeRoutes < 2) { activeRoutes++; return; }
    await new Promise<void>((resolve, reject) => {
      const ready = () => { combined.removeEventListener('abort', abort); activeRoutes++; resolve(); };
      const abort = () => {
        const index = waiting.indexOf(ready);
        if (index !== -1) waiting.splice(index, 1);
        reject(combined.reason);
      };
      waiting.push(ready);
      combined.addEventListener('abort', abort, { once: true });
    });
  };
  let limited = false;
  let fallback = deps.mode === 'deterministic_fallback';
  const scoped: Dependencies = { ...deps,
    llm: { async complete(input) {
      signal.throwIfAborted();
      if (++turns[input.role] > 2) { limited = true; throw new BudgetExceeded('MODEL_TURN_LIMIT'); }
      const combined = AbortSignal.any([signal, input.signal]);
      try { return await within(combined, () => deps.llm.complete({ ...input, signal: combined })); }
      catch (error) { fallback = true; throw error; }
    } },
    routing: { async route(points, callerSignal) {
      signal.throwIfAborted();
      if (routes >= 6) { limited = true; throw new BudgetExceeded('ROUTING_BUDGET'); }
      routes++;
      const combined = AbortSignal.any([signal, callerSignal]);
      await acquireRoute(combined);
      try { return await within(combined, () => deps.routing.route(points, combined)); }
      finally { activeRoutes--; waiting.shift()?.(); }
    } },
  };
  return { deps: scoped, signal, markFallback() { fallback = true; },
    get limited() { return limited; },
    get mode() { return deps.mode === 'stub' ? 'stub' as const : fallback ? 'deterministic_fallback' as const : 'live' as const; },
    close() { clearTimeout(timer); controller.abort(new BudgetExceeded('GENERATION_FINISHED')); } };
}
