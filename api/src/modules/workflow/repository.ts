import { planSchema, type Plan } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError } from '../../core/errors.js';
import { within } from './budget.js';

export interface PlanRepository {
  save(plan: Plan, signal: AbortSignal): Promise<Plan>;
  get(id: string): Promise<Plan>;
  transition(id: string, status: Exclude<Plan['status'], 'proposed'>, now: string): Promise<Plan>;
}

const columns = 'id, listing_id, order_id, trip_id, quantity_kg, status, quote_snapshot, review, trace, expires_at, created_at';
function decode(row: Record<string, unknown>): Plan {
  const stored = row.review as Record<string, unknown>;
  const { sourceSnapshot, mode, searchComplete, ...review } = stored;
  const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value;
  return planSchema.parse({ id: row.id, listingId: row.listing_id, orderId: row.order_id, tripId: row.trip_id,
    quantityKg: row.quantity_kg, status: row.status, quoteSnapshot: row.quote_snapshot, review, trace: row.trace,
    expiresAt: iso(row.expires_at), createdAt: iso(row.created_at), sourceSnapshot, mode,
    ...(searchComplete === undefined ? {} : { searchComplete }) });
}
const conflict = () => new ApiError(409, 'PLAN_CONFLICT', 'Proposal expired or a conflicting decision was already recorded');

export function createPlanRepository(deps: Dependencies): PlanRepository {
  if (deps.persistence === 'memory') {
    const plans = new Map<string, Plan>();
    const get = async (id: string) => {
      const plan = plans.get(id);
      if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
      return structuredClone(plan);
    };
    return {
      async save(plan, signal) { signal.throwIfAborted(); const valid = planSchema.parse(plan); plans.set(valid.id, structuredClone(valid)); return structuredClone(valid); },
      get,
      async transition(id, status, now) {
        // No await between inspecting state and the conditional write.
        const plan = plans.get(id);
        if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
        if (plan.status === status) return structuredClone(plan);
        if (plan.status !== 'proposed' || Date.parse(plan.expiresAt) <= Date.parse(now)) throw conflict();
        const updated = { ...plan, status };
        plans.set(id, updated);
        return structuredClone(updated);
      },
    };
  }
  const get = async (id: string) => {
    const { rows } = await deps.db.query(`SELECT ${columns} FROM plans WHERE id = $1`, [id]);
    if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Plan not found');
    return decode(rows[0]);
  };
  return {
    async save(plan, signal) {
      const valid = planSchema.parse(plan);
      const { rows } = await within(signal, () => deps.db.query(`INSERT INTO plans (${columns})
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) RETURNING ${columns}`,
      [valid.id, valid.listingId, valid.orderId, valid.tripId, valid.quantityKg, valid.status,
        JSON.stringify(valid.quoteSnapshot), JSON.stringify({ ...valid.review, sourceSnapshot: valid.sourceSnapshot,
          mode: valid.mode, searchComplete: valid.searchComplete }),
        JSON.stringify(valid.trace), valid.expiresAt, valid.createdAt]));
      return decode(rows[0]);
    },
    get,
    async transition(id, status, now) {
      const { rows } = await deps.db.query(`UPDATE plans SET status = $2
        WHERE id = $1 AND status = 'proposed' AND expires_at > $3::timestamptz RETURNING ${columns}`, [id, status, now]);
      if (rows[0]) return decode(rows[0]);
      const existing = await get(id);
      if (existing.status === status) return existing;
      throw conflict();
    },
  };
}
