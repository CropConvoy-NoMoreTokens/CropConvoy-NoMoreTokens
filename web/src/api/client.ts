import type { Result } from './types';
import { expireApiToken, getApiToken } from './authSession';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'NETWORK_ERROR',
    public fields: Array<{ path: string; message: string }> = [],
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

function sanitizeForLog(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeForLog);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (/password|secret|token|credential|authorization/i.test(key)) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizeForLog(value);
    }
  }
  return out;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<Result<T>> {
  const method = options.method || 'GET';
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');

  const token = path === '/api/auth/login' ? null : getApiToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  let bodyForLog: unknown;
  if (options.body && typeof options.body === 'string') {
    try {
      bodyForLog = sanitizeForLog(JSON.parse(options.body));
    } catch {
      bodyForLog = options.body;
    }
  }

  console.log(`[API Request] ${method} ${path}`, {
    url: `${base}${path}`,
    headers: Object.fromEntries(headers.entries()),
    ...(bodyForLog !== undefined ? { body: bodyForLog } : {}),
  });

  let response: Response;
  const started = performance.now();
  try {
    response = await fetch(base + path, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(50_000),
    });
  } catch (error) {
    const duration = Math.round(performance.now() - started);
    console.error(`[API Network Error] ${method} ${path} (${duration}ms):`, error);
    const timeout =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      ['TimeoutError', 'AbortError'].includes(String(error.name));
    throw new ApiError(
      timeout
        ? 'This request took too long. Your entries are saved here; please try again.'
        : 'We could not reach the API. Check your connection and try again.',
      0,
      timeout ? 'TIMEOUT' : 'NETWORK_ERROR'
    );
  }

  const duration = Math.round(performance.now() - started);
  const requestId = response.headers.get('X-Request-Id') ?? undefined;

  if (response.status === 401 && token) expireApiToken(token);

  let payload: any;
  try {
    payload = await response.json();
  } catch (err) {
    console.error(`[API Parse Error] ${response.status} ${method} ${path} (${duration}ms) [${requestId || 'no-id'}]:`, err);
    throw new ApiError(
      'The API returned an unreadable response. Please try again.',
      response.status,
      'INVALID_RESPONSE',
      [],
      requestId
    );
  }

  if (!response.ok) {
    console.warn(`[API Response Error] ${response.status} ${method} ${path} (${duration}ms) [${requestId || 'no-id'}]:`, sanitizeForLog(payload));
    throw new ApiError(
      payload.error?.message || `Request failed (${response.status}). Please try again.`,
      response.status,
      payload.error?.code || 'API_ERROR',
      Array.isArray(payload.error?.fields) ? payload.error.fields : [],
      requestId
    );
  }

  if (!payload || !('data' in payload) || !payload.meta) {
    console.error(`[API Response Invalid Envelope] ${response.status} ${method} ${path} (${duration}ms) [${requestId || 'no-id'}]:`, sanitizeForLog(payload));
    throw new ApiError(
      'The API response did not match the agreed format.',
      response.status,
      'INVALID_RESPONSE',
      [],
      requestId
    );
  }

  console.log(`[API Response] ${response.status} ${method} ${path} (${duration}ms) [${requestId || 'no-id'}]:`, sanitizeForLog(payload));
  return payload as Result<T>;
}
