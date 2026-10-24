import type { Router } from 'express';
import { extractInputSchema, listingInputSchema, orderInputSchema, idSchema } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import { reply } from '../../core/http.js';
import type { MarketRepository } from './repository.js';
import { extractHarvestWithMode } from './service.js';
export function registerRoutes(router: Router, deps: Dependencies, repository: MarketRepository) {
  router.post('/api/harvest/extract', async (req, res) => {
    const { result, mode } = await extractHarvestWithMode(extractInputSchema.parse(req.body), deps);
    res.locals.responseMode = mode;
    return reply(res, deps, result);
  });
  router.post('/api/listings', async (req, res) => reply(res, deps, await repository.createListing(listingInputSchema.parse(req.body)), 201));
  router.get('/api/listings/:id', async (req, res) => reply(res, deps, await repository.getListing(idSchema.parse(req.params.id))));
  router.get('/api/orders', async (_req, res) => reply(res, deps, await repository.listOrders()));
  router.post('/api/orders', async (req, res) => reply(res, deps, await repository.createOrder(orderInputSchema.parse(req.body)), 201));
}
