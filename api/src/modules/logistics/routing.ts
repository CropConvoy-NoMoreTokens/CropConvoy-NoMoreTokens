import { z } from 'zod';
import type { RoutingClient } from '../../core/dependencies.js';
import { pointSchema } from '../../core/contracts.js';
import { ApiError } from '../../core/errors.js';
import { geometrySchema, measurement, routingResultSchema } from './contracts.js';
import { abortable } from './async.js';

export class RoutingError extends ApiError {
  constructor(code: string, message: string, public readonly unavailable = false) {
    super(unavailable ? 503 : 422, code, message);
  }
}
const responseSchema = z.object({
  code: z.literal('Ok'),
  routes: z.array(z.object({
    geometry: geometrySchema, distance: measurement.positive(), duration: measurement.positive(),
    legs: z.array(z.object({ distance: measurement, duration: measurement })),
  })).min(1),
  waypoints: z.array(z.object({ location: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) })),
});
export function validateRoute(result: unknown, pointCount: number) {
  const parsed = routingResultSchema.safeParse(result);
  if (!parsed.success) throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing returned invalid geometry or measurements', true);
  const v = parsed.data;
  if (v.legs.length !== pointCount - 1 || v.snappedPoints.length !== pointCount) {
    throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing returned the wrong number of legs or stops', true);
  }
  for (const [total, sum] of [
    [v.distanceM, v.legs.reduce((s, l) => s + l.distanceM, 0)],
    [v.durationS, v.legs.reduce((s, l) => s + l.durationS, 0)],
  ]) {
    if (Math.abs(total - sum) > Math.max(5, total * 0.01)) {
      throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Route and leg totals disagree', true);
    }
  }
  return v;
}
export type OsrmOptions = {
  baseUrl: string; profile?: string; provider?: string; timeoutMs?: number;
  headers?: Record<string, string>; fetch?: typeof fetch;
};
/** baseUrl is trusted configuration. No implicit public demo endpoint. */
export function createOsrmRoutingClient(options: OsrmOptions): RoutingClient {
  const base = new URL(options.baseUrl);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Configure a valid routing base URL without credentials, query or fragment');
  }
  const profile = options.profile ?? 'driving';
  if (!/^[a-zA-Z0-9_-]+$/.test(profile)) throw new Error('Invalid routing profile');
  const timeoutMs = z.number().int().min(1).max(30000).parse(options.timeoutMs ?? 8000);
  return {
    async route(points, parent) {
      z.array(pointSchema).min(2).max(4).parse(points);
      parent.throwIfAborted();
      const signal = AbortSignal.any([parent, AbortSignal.timeout(timeoutMs)]);
      const coords = points.map(p => p.lng + ',' + p.lat).join(';');
      const url = new URL(base.toString().replace(/\/$/, '') + '/route/v1/' + profile + '/' + coords);
      url.searchParams.set('geometries', 'geojson'); url.searchParams.set('overview', 'full');
      url.searchParams.set('steps', 'false'); url.searchParams.set('alternatives', 'false');
      try {
        const response = await abortable((options.fetch ?? fetch)(url, { signal, headers: options.headers }), signal);
        if (Number(response.headers.get('content-length') ?? 0) > 5_000_000) throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing response is too large', true);
        const raw = await abortable(response.text(), signal);
        if (raw.length > 5_000_000) throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing response is too large', true);
        let body: unknown;
        try { body = JSON.parse(raw); } catch { throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing did not return JSON', true); }
        const code = (body as { code?: unknown } | null)?.code;
        if (code === 'NoRoute' || code === 'NoSegment') throw new RoutingError('NO_ROAD_ROUTE', 'No road route reaches the selected stops');
        if (!response.ok) throw new RoutingError('ROUTING_UNAVAILABLE', 'Road-routing service is unavailable', true);
        const parsed = responseSchema.safeParse(body);
        if (!parsed.success) throw new RoutingError('INVALID_ROUTING_RESPONSE', 'Routing returned an invalid response', true);
        const r = parsed.data.routes[0];
        return validateRoute({
          geometry: r.geometry, distanceM: r.distance, durationS: r.duration,
          legs: r.legs.map(l => ({ distanceM: l.distance, durationS: l.duration })),
          snappedPoints: parsed.data.waypoints.map(w => ({ lng: w.location[0], lat: w.location[1] })),
          provider: options.provider ?? base.host, profile,
        }, points.length);
      } catch (error) {
        parent.throwIfAborted();
        if (signal.aborted) throw new RoutingError('ROUTING_TIMEOUT', 'Road-routing request timed out', true);
        if (error instanceof RoutingError) throw error;
        throw new RoutingError('ROUTING_UNAVAILABLE', 'Road-routing service could not be reached', true);
      }
    },
  };
}
