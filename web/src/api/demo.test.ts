import { describe, test, expect } from 'vitest';
import { createDemoService, DEMO_IDS } from './demo';
import { colomboToUtc, tomorrowAt } from '../lib/format';
const listing = { demoFarmerId: DEMO_IDS.farmer, crop: 'tomato' as const, quantityKg: 80, pickup: { lat: 7.8742, lng: 80.6511 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1600000, confirmed: true as const };
describe('session demo adapter', () => {
  test('publishes only on explicit create, computes labeled sample figures, and handles decisions', async () => {
    const service = createDemoService();
    const extract = await service.extract({ text: '80 kg tomatoes, ready tomorrow', localTimeContext: { now: new Date().toISOString(), timeZone: 'Asia/Colombo' } });
    expect(extract.data.draft.readyAt).toBeNull(); expect(extract.data.draft.minNetMinor).toBeNull(); expect(extract.meta.mode).toBe('demo');
    const saved = await service.createListing(listing);
    const generated = await service.generate(saved.data.id);
    expect(generated.data.plan?.quoteSnapshot.netMinor).toBe(1665000); expect(generated.data.plan?.quoteSnapshot.modifiedGeometry).toBeNull(); expect(generated.data.searchComplete).toBe(false);
    const id = generated.data.plan!.id;
    expect((await service.decide(id, 'accept')).data.status).toBe('farmer_accepted_pending_confirmations');
    expect((await service.decide(id, 'accept')).data.status).toBe('farmer_accepted_pending_confirmations');
    await expect(service.decide(id, 'reject')).rejects.toMatchObject({ status: 409 });
    expect((await createDemoService().getPlan(id)).data.id).toBe(id);
  });
  test('does not propose below the minimum or fabricate routes', async () => { const service = createDemoService(); const saved = await service.createListing({ ...listing, minNetMinor: 1700000 }); expect((await service.generate(saved.data.id)).data.plan).toBeNull(); expect((await service.listTrips()).data[0].routeGeoJSON).toBeNull(); });
  test('buyer and transporter create/list actions share the session dataset', async () => { const service = createDemoService(); const orders = await service.listOrders(); const { id: _id, status: _status, createdAt: _created, ...input } = orders.data[0]; const saved = await service.createOrder({ ...input, remainingKg: 150 }); expect((await service.listOrders()).data.some(o => o.id === saved.data.id)).toBe(true); const trips = await service.listTrips(); const t = trips.data[0]; const created = await service.createTrip({ demoTransporterId: t.demoTransporterId, start: t.start, end: t.end, departureAt: t.departureAt, availableKg: 180, corridorM: t.corridorM, maxExtraDistanceM: t.maxExtraDistanceM, maxExtraTimeS: t.maxExtraTimeS, baseMinor: t.baseMinor, perKmMinor: t.perKmMinor, ratePerKgKmMinor: t.ratePerKgKmMinor, pricingVersion: t.pricingVersion, handlingMinor: t.handlingMinor }); expect(created.data.routeGeoJSON).toBeNull(); expect((await service.listTrips()).data).toHaveLength(2); });
});
