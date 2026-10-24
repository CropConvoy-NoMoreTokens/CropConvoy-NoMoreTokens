import { describe, test, expect, vi } from 'vitest';
import { apiRequest, ApiError } from './client';
import { createHttpService } from './service';
import { getApiToken, setApiToken } from './authSession';
const mockResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'test-request' } });
describe('HTTP integration contract', () => {
  test('preserves field errors, HTTP status, code and request ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(422, { error: { code: 'VALIDATION_ERROR', message: 'Check quantity', fields: [{ path: 'quantityKg', message: 'Use whole kg' }] } })));
    await expect(apiRequest('/api/listings')).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR', fields: [{ path: 'quantityKg', message: 'Use whole kg' }], requestId: 'test-request' });
  });
  test.each([409, 503])('keeps %i responses as failures without demo fallback', async status => { const fetcher = vi.fn().mockResolvedValue(mockResponse(status, { error: { code: 'EXPECTED_ERROR', message: 'Please regenerate or retry' } })); vi.stubGlobal('fetch', fetcher); await expect(createHttpService().generate('listing')).rejects.toMatchObject({ status }); expect(fetcher).toHaveBeenCalledOnce(); });
  test('reports network failure and timeout separately', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline'))); await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR' }); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'))); await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'TIMEOUT' }); });
  test('rejects unreadable or malformed successful responses', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json'))); await expect(apiRequest('/health')).rejects.toBeInstanceOf(ApiError); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, { status: 'wrong envelope' }))); await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' }); });
  test('passes through empty incomplete and fallback metadata', async () => { const payload = { data: { outcome: 'no_feasible_plan', plan: null, alternatives: [], rejections: [], trace: [], searchComplete: false }, meta: { mode: 'deterministic_fallback', persistence: 'postgres', requestId: 'r' } }; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(200, payload))); expect(await createHttpService().generate('id')).toEqual(payload); });
  test('adds bearer token and clears it after an authenticated 401', async () => {
    setApiToken('test-token');
    const fetcher = vi.fn().mockResolvedValue(mockResponse(401, { error: { code: 'SESSION_INVALID', message: 'Sign in again' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(createHttpService().listOrders()).rejects.toMatchObject({ status: 401, code: 'SESSION_INVALID' });
    expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer test-token');
    expect(getApiToken()).toBeNull();
  });
  test('uploads an image with its MIME type and bearer token rather than JSON', async () => {
    setApiToken('test-token');
    const fetcher = vi.fn().mockResolvedValue(mockResponse(200, { data: { text: '80 kg tomatoes' },
      meta: { mode: 'live', persistence: 'postgres', requestId: 'test' } }));
    vi.stubGlobal('fetch', fetcher);
    const file = new File(['image bytes'], 'harvest.png', { type: 'image/png' });
    expect((await createHttpService().readHarvestImage(file)).data.text).toBe('80 kg tomatoes');
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(options.body).toBe(file);
    expect(new Headers(options.headers).get('Content-Type')).toBe('image/png');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });
});
