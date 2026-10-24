import { randomUUID } from 'node:crypto';
import type { Listing, ListingInput, Order, OrderInput } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError, pending } from '../../core/errors.js';
export interface MarketRepository {
  createListing(input: ListingInput): Promise<Listing>;
  getListing(id: string): Promise<Listing>;
  createOrder(input: OrderInput): Promise<Order>;
  listOrders(): Promise<Order[]>;
}
export function createMarketRepository(deps: Dependencies): MarketRepository {
  const listings = new Map<string, Listing>();
  const orders = new Map<string, Order>();
  const guard = () => { if (deps.mode !== 'stub') pending('PostgreSQL market repository (P2)'); };
  return {
    async createListing(input) { guard(); const row: Listing = { ...input, id: randomUUID(), status: 'open', createdAt: deps.clock.now().toISOString() }; listings.set(row.id, row); return row; },
    async getListing(id) { guard(); const row = listings.get(id); if (!row) throw new ApiError(404, 'NOT_FOUND', 'Listing not found'); return row; },
    async createOrder(input) { guard(); const row: Order = { ...input, id: randomUUID(), status: 'open', createdAt: deps.clock.now().toISOString() }; orders.set(row.id, row); return row; },
    async listOrders() { guard(); return [...orders.values()]; },
  };
}
