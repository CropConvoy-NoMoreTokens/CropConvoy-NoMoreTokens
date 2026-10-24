import type { Result } from './types';
import { expireApiToken, getApiToken } from './authSession';
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR', public fields: Array<{ path: string; message: string }> = [], public requestId?: string) { super(message); this.name = 'ApiError'; }
}
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = path === '/api/auth/login' ? null : getApiToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(base + path, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(50_000) }); }
  catch (error) {
    const timeout = typeof error === 'object' && error !== null && 'name' in error && ['TimeoutError', 'AbortError'].includes(String(error.name));
    throw new ApiError(timeout ? 'This request took too long. Your entries are saved here; please try again.' : 'We could not reach the API. Check your connection and try again.', 0, timeout ? 'TIMEOUT' : 'NETWORK_ERROR');
  }
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  if (response.status === 401 && token) expireApiToken(token);
  let payload;
  try { payload = await response.json(); } catch { throw new ApiError('The API returned an unreadable response. Please try again.', response.status, 'INVALID_RESPONSE', [], requestId); }
  if (!response.ok) {
    throw new ApiError(payload.error?.message || `Request failed (${response.status}). Please try again.`, response.status, payload.error?.code || 'API_ERROR', Array.isArray(payload.error?.fields) ? payload.error.fields : [], requestId);
  }
  if (!payload || !('data' in payload) || !payload.meta) throw new ApiError('The API response did not match the agreed format.', response.status, 'INVALID_RESPONSE', [], requestId);
  return payload as Result<T>;
}
