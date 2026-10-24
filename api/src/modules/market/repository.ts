import { randomUUID } from 'node:crypto';
import type { Listing, ListingInput, Order, OrderInput } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError, pending } from '../../core/errors.js';

export interface MarketRepository {
  createListing(input: ListingInput): Promise<Listing>;
  getListing(id: string): Promise<Listing>;
  listListings(farmerId: string): Promise<Listing[]>;
  createOrder(input: OrderInput): Promise<Order>;
  listOrders(): Promise<Order[]>;
}

type ListingRow = {
  id: string; demo_farmer_id: string; crop: Listing['crop']; quantity_kg: number;
  pickup_lat: number; pickup_lng: number; ready_at: Date | string;
  min_net_minor: string; seller_declared: boolean; status: Listing['status']; created_at: Date | string;
};
type OrderRow = {
  id: string; demo_buyer_id: string; crop: Order['crop']; remaining_kg: number;
  price_per_kg_minor: string; delivery_lat: number; delivery_lng: number;
  deadline_at: Date | string; allows_partial: boolean; status: Order['status']; created_at: Date | string;
};

function safeMinor(value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new ApiError(503, 'INVALID_DATABASE_VALUE', 'Stored money exceeds safe integer range');
  return number;
}
function iso(value: Date | string): string { return new Date(value).toISOString(); }
function listing(row: ListingRow): Listing {
  return { id: row.id, demoFarmerId: row.demo_farmer_id, crop: row.crop,
    quantityKg: row.quantity_kg, pickup: { lat: row.pickup_lat, lng: row.pickup_lng },
    readyAt: iso(row.ready_at), minNetMinor: safeMinor(row.min_net_minor),
    confirmed: row.seller_declared as true, status: row.status, createdAt: iso(row.created_at) };
}
function order(row: OrderRow): Order {
  return { id: row.id, demoBuyerId: row.demo_buyer_id, crop: row.crop,
    remainingKg: row.remaining_kg, pricePerKgMinor: safeMinor(row.price_per_kg_minor),
    delivery: { lat: row.delivery_lat, lng: row.delivery_lng },
    deadlineAt: iso(row.deadline_at), allowsPartial: row.allows_partial,
    status: row.status, createdAt: iso(row.created_at) };
}

export function createMarketRepository(deps: Dependencies): MarketRepository {
  if (deps.persistence === 'postgres') return {
    async createListing(input) {
      const { rows } = await deps.db.query<ListingRow>(
        `INSERT INTO listings (id, demo_farmer_id, crop, quantity_kg, pickup_lat, pickup_lng,
          ready_at, min_net_minor, seller_declared)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [randomUUID(), input.demoFarmerId, input.crop, input.quantityKg, input.pickup.lat,
          input.pickup.lng, input.readyAt, input.minNetMinor, input.confirmed]);
      return listing(rows[0]);
    },
    async getListing(id) {
      const { rows } = await deps.db.query<ListingRow>('SELECT * FROM listings WHERE id = $1', [id]);
      if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Listing not found');
      return listing(rows[0]);
    },
    async listListings(farmerId) {
      const { rows } = await deps.db.query<ListingRow>(
        'SELECT * FROM listings WHERE demo_farmer_id = $1 ORDER BY created_at DESC, id DESC', [farmerId]);
      return rows.map(listing);
    },
    async createOrder(input) {
      const { rows } = await deps.db.query<OrderRow>(
        `INSERT INTO orders (id, demo_buyer_id, crop, remaining_kg, price_per_kg_minor,
          delivery_lat, delivery_lng, deadline_at, allows_partial)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [randomUUID(), input.demoBuyerId, input.crop, input.remainingKg, input.pricePerKgMinor,
          input.delivery.lat, input.delivery.lng, input.deadlineAt, input.allowsPartial]);
      return order(rows[0]);
    },
    async listOrders() {
      const { rows } = await deps.db.query<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC, id DESC');
      return rows.map(order);
    },
  };
  const listings = new Map<string, Listing>();
  const orders = new Map<string, Order>();
  const guard = () => { if (deps.mode !== 'stub') pending('PostgreSQL market repository (P2)'); };
  return {
    async createListing(input) { guard(); const row: Listing = { ...input, id: randomUUID(), status: 'open', createdAt: deps.clock.now().toISOString() }; listings.set(row.id, row); return row; },
    async getListing(id) { guard(); const row = listings.get(id); if (!row) throw new ApiError(404, 'NOT_FOUND', 'Listing not found'); return row; },
    async createOrder(input) { guard(); const row: Order = { ...input, id: randomUUID(), status: 'open', createdAt: deps.clock.now().toISOString() }; orders.set(row.id, row); return row; },
    async listListings(farmerId) { guard(); return [...listings.values()].filter(row => row.demoFarmerId === farmerId).sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)); },
    async listOrders() { guard(); return [...orders.values()]; },
  };
}
