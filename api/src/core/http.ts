import type { Response } from 'express';
import type { Dependencies } from './dependencies.js';
export function reply(res: Response, deps: Dependencies, data: unknown, status = 200) {
  return res.status(status).json({ data, meta: { mode: deps.mode, persistence: deps.persistence, requestId: res.locals.requestId } });
}
