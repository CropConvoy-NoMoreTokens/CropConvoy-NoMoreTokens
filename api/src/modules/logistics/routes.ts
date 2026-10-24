import type { Router } from 'express';
import { tripInputSchema } from '../../core/contracts.js';
import { hybridTripInputSchema } from './contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { LogisticsService } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, service: LogisticsService) {
  router.get('/api/trips', async (_req, res) => reply(res, deps, await service.listTrips()));
  router.post('/api/trips', async (req, res) => {
    // Preserve the starter's explicit stub endpoint; live requests require the complete new tariff.
    const schema = deps.mode === 'stub' ? tripInputSchema : hybridTripInputSchema;
    return reply(res, deps, await service.createTrip(schema.parse(req.body)), 201);
  });
}
