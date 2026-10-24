import { isDeepStrictEqual } from 'node:util';
import { listingSchema, orderSchema, tripSchema, type Plan, type QuoteSnapshot } from '../../core/contracts.js';
import { quoteRejectionCodes } from '../advocate/service.js';
import { ApiError } from '../../core/errors.js';

export function parseSources(input: Plan['sourceSnapshot']): Plan['sourceSnapshot'] {
  const listing = listingSchema.safeParse(input.listing);
  const order = orderSchema.safeParse(input.order);
  const trip = tripSchema.safeParse(input.trip);
  if (!listing.success || !order.success || !trip.success)
    throw new ApiError(409, 'STALE_PLAN', 'Proposal source changed or is no longer open; generate a new proposal');
  return { listing: listing.data, order: order.data, trip: trip.data };
}

/** Cross-check independent source facts; geometry feasibility remains P3's validated responsibility. */
export function sourceRejectionCodes(quote: QuoteSnapshot, sources: Plan['sourceSnapshot']): string[] {
  const { listing, order, trip } = sources;
  const codes = quoteRejectionCodes(listing, quote);
  if (quote.listingId !== listing.id || quote.orderId !== order.id || quote.tripId !== trip.id ||
      listing.crop !== order.crop || quote.pricePerKgMinor !== order.pricePerKgMinor ||
      quote.baseMinor !== trip.baseMinor || quote.perKmMinor !== trip.perKmMinor || quote.handlingMinor !== trip.handlingMinor ||
      !isDeepStrictEqual(quote.baseGeometry, trip.routeGeoJSON) || quote.baseDistanceM !== trip.routeDistanceM ||
      quote.baseDurationS !== trip.routeDurationS) codes.push('SOURCE_MISMATCH');
  if (order.remainingKg < listing.quantityKg) codes.push('DEMAND_TOO_SMALL');
  if (!order.allowsPartial) codes.push('PARTIAL_FILL_NOT_ALLOWED');
  if (trip.availableKg < listing.quantityKg) codes.push('CAPACITY_EXCEEDED');
  if (quote.extraDistanceM > trip.maxExtraDistanceM) codes.push('EXCESS_DETOUR_DISTANCE');
  if (quote.extraTimeS > trip.maxExtraTimeS) codes.push('EXCESS_DETOUR_TIME');
  if (Date.parse(quote.pickupAt) < Date.parse(trip.departureAt)) codes.push('INVALID_TIMING');
  if (Date.parse(quote.deliveryAt) > Date.parse(order.deadlineAt)) codes.push('DELIVERY_TOO_LATE');
  return [...new Set(codes)];
}
