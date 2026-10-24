import { randomUUID } from 'node:crypto';
import type { Listing, Order } from '../../core/contracts.js';

// Synthetic module fixtures only; coordinates do not imply a verified road corridor.
export const listingId = randomUUID();
export const listingFixture: Listing = { id: listingId, demoFarmerId: randomUUID(), crop: 'tomato',
  quantityKg: 80, pickup: { lat: 6.9, lng: 79.9 }, readyAt: '2026-10-25T04:00:00.000Z',
  minNetMinor: 10000, confirmed: true, status: 'open', createdAt: '2026-10-24T00:00:00.000Z' };
export function orderFixture(changes: Partial<Order> = {}): Order {
  return { id: randomUUID(), demoBuyerId: randomUUID(), crop: 'tomato',
    remainingKg: 100, pricePerKgMinor: 22000, delivery: { lat: 7, lng: 80 },
    deadlineAt: '2026-10-25T10:00:00.000Z', allowsPartial: true,
    status: 'open', createdAt: '2026-10-24T00:00:00.000Z', ...changes };
}
