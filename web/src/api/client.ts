export type ApiResponse<T> = { data: T; meta: { mode: 'stub' | 'live' | 'deterministic_fallback'; persistence: 'memory' | 'postgres'; requestId: string } };
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(base + path, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(50_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status})`);
  return payload as ApiResponse<T>;
}
