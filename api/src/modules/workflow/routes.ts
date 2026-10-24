import { z } from 'zod';
import type { AuthUser } from '../../core/auth.js';
import { createBookingService, historyQuery } from '../booking/service.js';
import type { Router } from 'express';
import { generateInputSchema, decisionInputSchema, idSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { WorkflowService } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, service: WorkflowService) {
  const bookings = createBookingService(deps);
  router.get('/api/plans', async (req,res) => reply(res,deps,await bookings.list(res.locals.authUser,historyQuery.parse(req.query))));
  router.get('/api/approvals/:id', async (req,res) => reply(res,deps,await bookings.detail(idSchema.parse(req.params.id),res.locals.authUser)));
  for (const role of ['buyer','driver']) router.post(`/api/plans/:id/${role}-decision`, async(req,res) => {
    const decision=z.object({decision:z.enum(['approve','reject'])}).parse(req.body).decision;
    return reply(res,deps,await bookings.mutate(idSchema.parse(req.params.id),res.locals.authUser,decision));
  });
  router.post('/api/plans/generate', async (req, res) => {
    const result = await service.generate(generateInputSchema.parse(req.body).listingId);
    res.locals.responseMode = result.mode;
    return reply(res, deps, result);
  });
  router.get('/api/plans/:id', async (req, res) => {
    const id=idSchema.parse(req.params.id);
    const plan = deps.db.transaction && res.locals.authUser ? await bookings.farmerPlan(id,res.locals.authUser) : await service.getPlan(id);
    res.locals.responseMode = 'mode' in plan ? plan.mode : deps.mode;
    return reply(res, deps, plan);
  });
  router.post('/api/plans/:id/decision', async (req, res) => {
    const id=idSchema.parse(req.params.id), decision=decisionInputSchema.parse(req.body).decision;
    const plan = deps.db.transaction && res.locals.authUser ? await bookings.mutate(id,res.locals.authUser as AuthUser,decision) : await service.decide(id,decision);
    res.locals.responseMode = 'mode' in plan ? plan.mode : deps.mode;
    return reply(res, deps, plan);
  });
}
