import { test, expect, vi } from 'vitest';
import { mlClient } from './mlClient';
import { setApiToken } from './authSession';

test('Insights uses the Node proxy without forwarding marketplace tokens', async () => {
  setApiToken('browser-session-token');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', inference_device: 'cpu', models_loaded: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  await mlClient.getHealth();
  const [url, options] = fetcher.mock.calls[0];
  expect(new URL(url).pathname).toBe('/api/ml/health');
  expect(new Headers(options.headers).has('Authorization')).toBe(false);
  expect(new Headers(options.headers).has('X-ML-API-Key')).toBe(false);
});

test('Insights preserves backend outage messages and codes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
    code: 'ML_TIMEOUT', message: 'The prediction service took too long; please try again',
  } }), { status: 503 })));
  await expect(mlClient.getHealth()).rejects.toMatchObject({ status: 503, code: 'ML_TIMEOUT' });
});

test('Insights preserves field errors returned through the proxy', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [
    { loc: ['body', 'areaHa'], msg: 'Input should be greater than or equal to 0.1' },
  ] }), { status: 422 })));
  await expect(mlClient.getPlantingRecommendations({ plantingMonth: '2026-10', regionProfile: 'mild_midcountry', marketId: 'dambulla' }))
    .rejects.toMatchObject({ status: 422, fields: [{ path: 'areaHa', message: 'Input should be greater than or equal to 0.1' }] });
});
