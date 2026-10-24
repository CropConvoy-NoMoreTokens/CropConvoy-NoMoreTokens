import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { catalogSchema, forecastInputSchema, forecastSchema, healthSchema, historyQuerySchema,
  historySchema, plantingInputSchema, recommendationsSchema } from './schemas.js';

export interface PredictionProxyOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/** Public synthetic-data tools. Marketplace credentials are never forwarded upstream. */
export function createPredictionRouter(options: PredictionProxyOptions = {}) {
  const router = Router();
  const timeoutMs = Math.min(120_000, Math.max(100, options.timeoutMs ?? 60_000));

  const forward = (path: string, output: z.ZodType, input?: z.ZodType, query?: z.ZodType) => {
    const handler: import('express').RequestHandler = async (req, res) => {
      const body = input?.parse(req.body);
      const params = query?.parse(req.query) as Record<string, string> | undefined;
      if (!options.baseUrl) throw new ApiError(503, 'ML_NOT_CONFIGURED', 'The prediction service is not configured');
      const target = new URL(options.baseUrl.replace(/\/$/, '') + path);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
        throw new ApiError(503, 'ML_NOT_CONFIGURED', 'The prediction service configuration is invalid');
      if (params) target.search = new URLSearchParams(params).toString();
      const disconnected = new AbortController();
      const abort = () => { if (!res.writableEnded) disconnected.abort(); };
      res.once('close', abort);
      const signal = AbortSignal.any([disconnected.signal, AbortSignal.timeout(timeoutMs)]);
      try {
        const headers = new Headers({ Accept: 'application/json' });
        if (options.apiKey) headers.set('X-ML-API-Key', options.apiKey);
        if (body !== undefined) headers.set('Content-Type', 'application/json');
        const upstream = await fetch(target, { method: req.method, headers, signal, redirect: 'error',
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        if (!upstream.headers.get('content-type')?.includes('application/json')) throw new Error('INVALID_ML_RESPONSE');
        // Bound memory even for a malformed upstream response; no arbitrary URLs/headers are proxied.
        const reader = upstream.body?.getReader();
        if (!reader) throw new Error('EMPTY_ML_RESPONSE');
        const chunks: Uint8Array[] = []; let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.length;
            if (size > 2_000_000) throw new Error('ML_RESPONSE_TOO_LARGE');
            chunks.push(next.value);
          }
        } finally { await reader.cancel().catch(() => {}); }
        const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        res.setHeader('Cache-Control', 'no-store');
        if (!upstream.ok) {
          if (upstream.status === 422) {
            const validation = z.object({ detail: z.union([
              z.array(z.object({ loc: z.array(z.union([z.string(), z.number()])), msg: z.string() })),
              z.object({ code: z.literal('VALIDATION_ERROR'), message: z.string(),
                fields: z.array(z.object({ path: z.string(), message: z.string() })).optional() }),
            ]) }).safeParse(payload);
            if (validation.success) { res.status(422).json(validation.data); return; }
          }
          throw new ApiError(503, 'ML_UNAVAILABLE', 'The prediction service is unavailable; please try again');
        }
        const parsed = output.safeParse(payload);
        if (!parsed.success) throw new Error('INVALID_ML_RESPONSE');
        res.json(parsed.data);
      } catch (error) {
        if (disconnected.signal.aborted) return;
        if (error instanceof ApiError) throw error;
        throw new ApiError(503, signal.aborted ? 'ML_TIMEOUT' : 'ML_UNAVAILABLE',
          signal.aborted ? 'The prediction service took too long; please try again' : 'The prediction service is unavailable; please try again');
      } finally { res.off('close', abort); }
    };
    return handler;
  };

  router.get('/health', forward('/health', healthSchema));
  router.get('/v1/catalog', forward('/v1/catalog', catalogSchema));
  router.get('/v1/prices/history', forward('/v1/prices/history', historySchema, undefined, historyQuerySchema));
  router.post('/v1/prices/forecast', forward('/v1/prices/forecast', forecastSchema, forecastInputSchema));
  router.post('/v1/planting/recommendations', forward('/v1/planting/recommendations', recommendationsSchema, plantingInputSchema));
  router.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Prediction endpoint not found')));
  return router;
}
