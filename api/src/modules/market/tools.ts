import { z } from 'zod';
import { idSchema, pointSchema, dateSchema, type Listing, type Order } from '../../core/contracts.js';

export const searchOrdersArguments = z.strictObject({ listingId: idSchema });
export const candidateIdsSchema = z.strictObject({ candidateOrderIds: z.array(idSchema).max(3) });
export const searchOrdersResultSchema = z.strictObject({ eligibleOrders: z.array(z.strictObject({
  id: idSchema, remainingKg: z.number().int().positive().max(2147483647),
  pricePerKgMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  deadlineAt: dateSchema, delivery: pointSchema,
})).max(20) });

// The policy requires permission to fulfill only part of an order, even when sizes coincide.
export function eligibleOrders(listing: Listing, orders: Order[]): Order[] {
  return orders.filter(order => order.status === 'open'
    && order.crop === listing.crop
    && order.remainingKg >= listing.quantityKg
    && order.allowsPartial
    && Date.parse(order.deadlineAt) >= Date.parse(listing.readyAt));
}

export function validatedCandidates(ids: string[], eligible: Order[]): string[] {
  const allowed = new Set(eligible.map(order => order.id));
  return [...new Set(ids)].filter(id => allowed.has(id)).slice(0, 3);
}
