import { apiRequest } from './client';
import { createDemoService } from './demo';
import type { CropConvoyService, ExtractResult, Listing, Order, Trip, GenerationResult, Plan } from './types';
const post = <T,>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
export function createHttpService(): CropConvoyService {
  return { mode: 'api', extract: input => post<ExtractResult>('/api/harvest/extract', input),
    createListing: input => post<Listing>('/api/listings', input), getListing: id => apiRequest<Listing>(`/api/listings/${encodeURIComponent(id)}`),
    listListings: farmerId => apiRequest<Listing[]>(`/api/listings?demoFarmerId=${encodeURIComponent(farmerId)}`),
    listOrders: () => apiRequest<Order[]>('/api/orders'), createOrder: input => post<Order>('/api/orders', input),
    listTrips: () => apiRequest<Trip[]>('/api/trips'), createTrip: input => post<Trip>('/api/trips', input),
    generate: listingId => post<GenerationResult>('/api/plans/generate', { listingId }), getPlan: id => apiRequest<Plan>(`/api/plans/${encodeURIComponent(id)}`),
    decide: (id, decision) => post<Plan>(`/api/plans/${encodeURIComponent(id)}/decision`, { decision }),
  };
}
export function createService(mode = import.meta.env.VITE_DATA_MODE || 'demo'): CropConvoyService {
  if (mode !== 'api' && mode !== 'demo') throw new Error('VITE_DATA_MODE must be demo or api.');
  return mode === 'api' ? createHttpService() : createDemoService();
}
