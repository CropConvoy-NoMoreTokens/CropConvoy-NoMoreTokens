import type { Router } from 'express';
import { generateInputSchema, decisionInputSchema, idSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { WorkflowService } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, service: WorkflowService) {
  router.post('/api/plans/generate', async (req, res) => {
    const result = await service.generate(generateInputSchema.parse(req.body).listingId);
    res.locals.responseMode = result.mode;
    return reply(res, deps, result);
  });
  router.get('/api/plans/:id', async (req, res) => {
    const plan = await service.getPlan(idSchema.parse(req.params.id));
    res.locals.responseMode = plan.mode;
    return reply(res, deps, plan);
  });
  router.post('/api/plans/:id/decision', async (req, res) => {
    const plan = await service.decide(idSchema.parse(req.params.id), decisionInputSchema.parse(req.body).decision);
    res.locals.responseMode = plan.mode;
    return reply(res, deps, plan);
  });
}
