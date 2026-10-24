import type { Router } from 'express';
import { tripInputSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { LogisticsService } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, service: LogisticsService) {
  router.get('/api/trips', async (_req, res) => reply(res, deps, await service.listTrips()));
  router.post('/api/trips', async (req, res) => reply(res, deps, await service.createTrip(tripInputSchema.parse(req.body)), 201));
}
