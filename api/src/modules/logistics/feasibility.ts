import type { Listing, Order, Point } from '../../core/contracts.js';
import type { RoutingClient } from '../../core/dependencies.js';
import type { WeightDistanceTrip } from './contracts.js';
import { FeasibilityError, meters } from './geometry.js';
import { validateRoute } from './routing.js';

export type TimingPolicy = { snapToleranceM:number; loadingS:number; unloadingS:number };
export const defaultTiming: TimingPolicy = {snapToleranceM:100, loadingS:600, unloadingS:300};
export type StopInfo = { label: string; fieldPrefix?: string };

export function validateStops(
  points: Point[],
  snapped: Point[],
  toleranceM: number,
  stops?: StopInfo[]
) {
  if (points.length !== snapped.length) throw new FeasibilityError(['INVALID_SNAPPED_POINTS']);
  const violations: Array<{ index: number; dist: number }> = [];

  for (let i = 0; i < points.length; i++) {
    const dist = Math.round(meters(points[i], snapped[i]));
    if (dist > toleranceM) {
      violations.push({ index: i, dist });
    }
  }

  if (violations.length > 0) {
    const fields: Array<{ path: string; message: string }> = [];
    const details = violations.map(v => {
      const stop = stops?.[v.index];
      const stopName = stop?.label ? `${stop.label} pin` : `Location pin #${v.index + 1}`;
      const msg = `${stopName} is ${v.dist}m away from the nearest road (maximum allowed is ${toleranceM}m). Move the pin closer to a drivable road on the map or select a nearby town.`;
      if (stop?.fieldPrefix) {
        fields.push({ path: `${stop.fieldPrefix}.lat`, message: msg });
      }
      return `${stopName} is ${v.dist}m from the nearest road (limit: ${toleranceM}m)`;
    });

    const summaryMessage = `Location pin is too far from an accessible road: ${details.join('; ')}. Pins must be placed within ${toleranceM}m of a drivable road.`;

    throw new FeasibilityError(['SNAP_TOO_FAR'], summaryMessage, fields);
  }
}
export function checkShipment(listing:Listing, order:Order, trip:WeightDistanceTrip, now:Date) {
  const codes:string[]=[];
  if(listing.status!=='open' || order.status!=='open' || trip.status!=='open') codes.push('SOURCE_NOT_OPEN');
  if(listing.crop!==order.crop) codes.push('CROP_MISMATCH');
  if(order.remainingKg<listing.quantityKg) codes.push('INSUFFICIENT_DEMAND');
  if(!order.allowsPartial) codes.push('PARTIAL_FILL_NOT_ALLOWED');
  if(trip.availableKg<listing.quantityKg) codes.push('INSUFFICIENT_CAPACITY');
  if(Date.parse(trip.departureAt)<now.getTime()) codes.push('TRIP_DEPARTED');
  if(Date.parse(order.deadlineAt)<=now.getTime()) codes.push('DELIVERY_TOO_LATE');
  if(codes.length) throw new FeasibilityError(codes);
}
export function checkRoad(
  listing:Listing, order:Order, trip:WeightDistanceTrip,
  result:Awaited<ReturnType<RoutingClient['route']>>, policy:TimingPolicy=defaultTiming,
) {
  const r = validateRoute(result, 4);
  const points = [trip.start, listing.pickup, order.delivery, trip.end];
  validateStops(points, r.snappedPoints, policy.snapToleranceM, [
    { label: 'Trip start', fieldPrefix: 'start' },
    { label: 'Harvest pickup', fieldPrefix: 'pickup' },
    { label: 'Order delivery', fieldPrefix: 'delivery' },
    { label: 'Trip destination', fieldPrefix: 'end' },
  ]);
  const extraDistanceM=Math.max(0,r.distanceM-trip.routeDistanceM);
  const extraDrivingTimeS=Math.max(0,r.durationS-trip.routeDurationS);
  const extraTimeS=extraDrivingTimeS+policy.loadingS+policy.unloadingS;
  const pickupMs=Date.parse(trip.departureAt)+r.legs[0].durationS*1000;
  const deliveryMs=pickupMs+(policy.loadingS+r.legs[1].durationS)*1000;
  const codes:string[]=[];
  if(extraDistanceM>trip.maxExtraDistanceM) codes.push('DETOUR_TOO_LARGE');
  if(extraTimeS>trip.maxExtraTimeS) codes.push('EXTRA_TIME_TOO_LARGE');
  if(pickupMs<Date.parse(listing.readyAt)) codes.push('PRODUCE_NOT_READY');
  // Deadline is completion of unloading; displayed deliveryAt is arrival.
  if(deliveryMs+policy.unloadingS*1000>Date.parse(order.deadlineAt)) codes.push('DELIVERY_TOO_LATE');
  if(codes.length) throw new FeasibilityError(codes);
  return { route:r,extraDistanceM,extraTimeS,
    pickupAt:new Date(pickupMs).toISOString(),deliveryAt:new Date(deliveryMs).toISOString() };
}
