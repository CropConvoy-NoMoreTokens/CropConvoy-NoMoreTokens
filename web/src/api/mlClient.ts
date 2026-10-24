import { ApiError } from './client';
import type { MlHealth, MlCatalog, PriceHistoryResponse, PriceForecastRequest,
  PriceForecastResponse, PlantingRecommendationsRequest, PlantingRecommendationsResponse } from './mlTypes';

// ML credentials and its service URL live only on the Node backend.
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api/ml';

async function mlRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(75_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(base + path, { ...options, signal,
      headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(timeout.aborted ? 'The prediction took too long. Your entries are preserved; please try again.'
      : 'We could not reach the prediction service. Please try again.', 0, timeout.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
  }
  let payload: any;
  try { payload = await response.json(); }
  catch { throw new ApiError('The prediction service returned an unreadable response.', response.status, 'INVALID_RESPONSE'); }
  if (!response.ok) {
    const detail = payload.detail ?? payload.error;
    const fields = Array.isArray(detail) ? detail.map((item: any) => ({
      path: (item.loc || []).filter((part: unknown) => part !== 'body').join('.'),
      message: String(item.msg || 'Check this value.').replace(/^Value error, /, ''),
    })) : detail?.fields || [];
    throw new ApiError(typeof detail === 'string' ? detail : detail?.message ||
      (response.status === 422 ? 'Please check the highlighted fields.' : 'Predictions are unavailable. Please try again.'),
      response.status, detail?.code || (response.status === 422 ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE'),
      fields, response.headers.get('X-Request-Id') || undefined);
  }
  if (!payload || typeof payload !== 'object') throw new ApiError('The prediction response was invalid.', response.status, 'INVALID_RESPONSE');
  return payload as T;
}
export const mlClient = {
  getHealth: (signal?: AbortSignal) => mlRequest<MlHealth>('/health', {signal}),
  getCatalog: (signal?: AbortSignal) => mlRequest<MlCatalog>('/v1/catalog', {signal}),
  getPriceHistory: (produceId: string, marketId: string, signal?: AbortSignal) =>
    mlRequest<PriceHistoryResponse>('/v1/prices/history?produceId=' + encodeURIComponent(produceId) + '&marketId=' + encodeURIComponent(marketId), {signal}),
  getPriceForecast: (req: PriceForecastRequest, signal?: AbortSignal) =>
    mlRequest<PriceForecastResponse>('/v1/prices/forecast', {method:'POST', body:JSON.stringify(req), signal}),
  getPlantingRecommendations: (req: PlantingRecommendationsRequest, signal?: AbortSignal) =>
    mlRequest<PlantingRecommendationsResponse>('/v1/planting/recommendations', {method:'POST', body:JSON.stringify(req), signal}),
};
