import { z } from 'zod';
import { tripInputSchema, pointSchema, idSchema, dateSchema, listingInputSchema, orderInputSchema } from '../../core/contracts.js';
import type { QuoteSnapshot } from '../../core/contracts.js';

export const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const measurement = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const geometrySchema = z.strictObject({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(12000),
});
// Local additive extension awaiting promotion by P4 into shared contracts.
export const weightDistanceTripInputSchema = tripInputSchema.extend({
  ratePerKgKmMinor: money, // LKR minor units per kg per km; 20 means Rs.0.20/kg/km.
  pricingVersion: z.literal('weight-distance-v2'),
});
export const weightDistanceTripSchema = weightDistanceTripInputSchema.extend({
  id: idSchema, status: z.literal('open'), createdAt: dateSchema,
  routeGeoJSON: geometrySchema, routeDistanceM: measurement.positive(),
  routeDurationS: measurement.positive(), routeProvider: z.string().min(1), routeProfile: z.string().min(1),
});
export const listingSchema = listingInputSchema.extend({ id: idSchema, status: z.literal('open'), createdAt: dateSchema });
export const orderSchema = orderInputSchema.extend({ id: idSchema, status: z.literal('open'), createdAt: dateSchema });
export type WeightDistanceTripInput = z.infer<typeof weightDistanceTripInputSchema>;
export type WeightDistanceTrip = z.infer<typeof weightDistanceTripSchema>;
export type WeightDistanceQuote = QuoteSnapshot & {
  pricingVersion: 'weight-distance-v2'; ratePerKgKmMinor: number; routeCarryDistanceM: number;
  shipmentChargeMinor: number; detourChargeMinor: number; expiresAt: string;
};
export const weightDistanceQuoteSchema = z.strictObject({
  quoteId: idSchema, listingId: idSchema, orderId: idSchema, tripId: idSchema,
  quantityKg: z.number().int().positive().max(2147483647), pricePerKgMinor: money.positive(),
  baseMinor: money, perKmMinor: money, handlingMinor: money,
  grossMinor: money, transportMinor: money,
  netMinor: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  baseGeometry: geometrySchema, modifiedGeometry: geometrySchema,
  baseDistanceM: measurement.positive(), modifiedDistanceM: measurement.positive(), extraDistanceM: measurement,
  baseDurationS: measurement.positive(), modifiedDurationS: measurement.positive(), extraTimeS: measurement,
  pickupAt: dateSchema, deliveryAt: dateSchema, generatedAt: dateSchema,
  ruleOutcomes: z.record(z.string(), z.boolean()),
  pricingVersion: z.literal('weight-distance-v2'), ratePerKgKmMinor: money,
  routeCarryDistanceM: measurement, shipmentChargeMinor: money, detourChargeMinor: money, expiresAt: dateSchema,
});
export const routingResultSchema = z.strictObject({
  geometry: geometrySchema, distanceM: measurement.positive(), durationS: measurement.positive(),
  legs: z.array(z.strictObject({ distanceM: measurement, durationS: measurement })).min(1),
  snappedPoints: z.array(pointSchema).min(2),
  provider: z.string().min(1), profile: z.string().min(1),
});
