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
  router.get('/api/listings', async (req, res) => {
    const userId = (res.locals.authUser as { id: string } | undefined)?.id;
    // Authenticated requests never choose an owner through a query parameter.
    const farmerId = userId ?? idSchema.parse(req.query.demoFarmerId);
    const listings=await repository.listListings(farmerId);
    if(!deps.db.transaction) return reply(res,deps,listings);
    const {rows}=await deps.db.query(`SELECT DISTINCT ON (p.listing_id) p.listing_id,p.id,
      CASE WHEN p.status IN ('proposed','farmer_accepted_pending_confirmations') AND p.expires_at<=now() THEN 'expired' ELSE p.status END AS status
      FROM plans p JOIN listings l ON l.id=p.listing_id WHERE l.demo_farmer_id=$1 ORDER BY p.listing_id,p.created_at DESC,p.id DESC`,[farmerId]);
    return reply(res,deps,listings.map(row=>({...row,latestProposal:rows.find(p=>p.listing_id===row.id)??null})));

  });
  router.get('/api/listings/:id', async (req, res) => reply(res, deps, await repository.getListing(idSchema.parse(req.params.id))));
  router.get('/api/orders', async (_req, res) => {
    const orders = await repository.listOrders();
    const userId = (res.locals.authUser as { id: string } | undefined)?.id;
    return reply(res, deps, userId ? orders.filter(order => order.demoBuyerId === userId) : orders);
  });
  router.post('/api/orders', async (req, res) => reply(res, deps, await repository.createOrder(orderInputSchema.parse(req.body)), 201));
}
