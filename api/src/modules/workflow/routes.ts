import type { Router } from 'express';
import { generateInputSchema, decisionInputSchema, idSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { WorkflowService } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, service: WorkflowService) {
  router.post('/api/plans/generate', async (req, res) => reply(res, deps, await service.generate(generateInputSchema.parse(req.body).listingId)));
  router.get('/api/plans/:id', async (req, res) => reply(res, deps, await service.getPlan(idSchema.parse(req.params.id))));
  router.post('/api/plans/:id/decision', async (req, res) => reply(res, deps, await service.decide(idSchema.parse(req.params.id), decisionInputSchema.parse(req.body).decision)));
}
