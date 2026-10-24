import { z } from 'zod';
import { ApiError } from '../../core/errors.js';

export const resolveLocationInputSchema = z.strictObject({ place: z.string().trim().min(2).max(120)
  .refine(value => !/[0-9෦-෯@#\r\n]/u.test(value),
    'Search a town or village name without house numbers or personal details') });
const responseSchema = z.array(z.object({
  display_name: z.string().min(1), lat: z.coerce.number(), lon: z.coerce.number(),
})).max(10);
export type PlaceCandidate = { label: string; point: { lat: number; lng: number } };

const cache = new Map<string, { expires: number; candidates: PlaceCandidate[] }>();
let queue = Promise.resolve();
let nextRequestAt = 0;

/** Only explicit farmer place lookups reach the provider. No autocomplete or full harvest text. */
export async function resolveLocation(place: string): Promise<PlaceCandidate[]> {
  const key = place.normalize('NFC').trim().toLocaleLowerCase();
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.candidates;
  const work = queue.then(async () => {
    const previous = cache.get(key);
    if (previous && previous.expires > Date.now()) return previous.candidates;
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    nextRequestAt = Date.now() + 1100;
    const base = process.env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org';
    const url = new URL('search', base.endsWith('/') ? base : `${base}/`);
    if (url.protocol !== 'https:') throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Place lookup requires HTTPS');
    url.searchParams.set('q', place);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('countrycodes', 'lk');
    url.searchParams.set('accept-language', 'si,en');
    url.searchParams.set('limit', '3');
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: {
        'User-Agent': 'CropConvoy/0.1 (https://github.com/CropConvoy-NoMoreTokens/CropConvoy-NoMoreTokens)',
        Referer: 'https://github.com/CropConvoy-NoMoreTokens/CropConvoy-NoMoreTokens',
      } });
    } catch { throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Place lookup is unavailable; choose the pickup pin manually'); }
    if (!response.ok) throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Place lookup is unavailable; choose the pickup pin manually');
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Place lookup returned invalid results');
    const candidates = parsed.data.filter(row => Number.isFinite(row.lat) && Number.isFinite(row.lon) &&
      row.lat >= 5.8 && row.lat <= 9.9 && row.lon >= 79.5 && row.lon <= 82.1)
      .map(row => ({ label: row.display_name, point: { lat: row.lat, lng: row.lon } }));
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, candidates });
    return candidates;
  });
  queue = work.then(() => undefined, () => undefined);
  return work;
}
