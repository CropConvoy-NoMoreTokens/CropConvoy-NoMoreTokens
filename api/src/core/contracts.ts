import { z } from 'zod';

export const idSchema = z.uuid();
const whole = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = whole.min(1);
const int32 = whole.max(2147483647);
const quantity = int32.min(1);
const distance = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const cropSchema = z.enum(['tomato', 'potato', 'carrot']);
export const dateSchema = z.iso.datetime();
export const pointSchema = z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const listingInputSchema = z.strictObject({
  demoFarmerId: idSchema, crop: cropSchema, quantityKg: quantity,
  pickup: pointSchema, readyAt: dateSchema, minNetMinor: whole,
  confirmed: z.literal(true),
});
export const orderInputSchema = z.strictObject({
  demoBuyerId: idSchema, crop: cropSchema, remainingKg: quantity,
  pricePerKgMinor: positive, delivery: pointSchema, deadlineAt: dateSchema,
  allowsPartial: z.boolean(),
});
export const tripInputSchema = z.strictObject({
  demoTransporterId: idSchema, start: pointSchema, end: pointSchema,
  departureAt: dateSchema, availableKg: quantity,
  corridorM: int32.min(1), maxExtraDistanceM: int32, maxExtraTimeS: int32,
  baseMinor: whole, perKmMinor: whole, handlingMinor: whole,
  ratePerKgKmMinor: whole, pricingVersion: z.literal('weight-distance-v2'),
});
export const extractInputSchema = z.strictObject({
  text: z.string().trim().min(1).max(5000),
  localTimeContext: z.strictObject({ now: dateSchema, timeZone: z.literal('Asia/Colombo') }),
});
export const generateInputSchema = z.strictObject({ listingId: idSchema });
export const decisionInputSchema = z.strictObject({ decision: z.enum(['accept', 'reject']) });
export const extractResultSchema = z.strictObject({
  draft: z.strictObject({ crop: cropSchema.nullable(), quantityKg: quantity.nullable(),
    locationText: z.string().nullable(), readyAt: dateSchema.nullable(), minNetMinor: whole.nullable() }),
  missingFields: z.array(z.string()), questions: z.array(z.string()),
});
export const marketResultSchema = z.strictObject({
  listingId: idSchema, candidateOrderIds: z.array(idSchema).max(3), reasons: z.record(z.string(), z.string()),
});
export const logisticsOptionSchema = z.strictObject({
  orderId: idSchema, tripId: idSchema, quoteId: idSchema,
  extraDistanceM: distance, deliveryAt: dateSchema, transportMinor: whole,
});
export const logisticsResultSchema = z.strictObject({
  options: z.array(logisticsOptionSchema),
  rejections: z.array(z.strictObject({ orderId: idSchema, tripId: idSchema, codes: z.array(z.string()) })),
});
export const reviewResultSchema = z.strictObject({
  verdict: z.enum(['recommend', 'try_alternative', 'no_feasible_plan']),
  selectedQuoteId: idSchema.nullable(), reasonCodes: z.array(z.string()), explanation: z.string(),
});
export type Point = z.infer<typeof pointSchema>;
export type ListingInput = z.infer<typeof listingInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type TripInput = z.infer<typeof tripInputSchema>;
export type ExtractInput = z.infer<typeof extractInputSchema>;
export type ExtractResult = z.infer<typeof extractResultSchema>;
export type MarketResult = z.infer<typeof marketResultSchema>;
export type LogisticsResult = z.infer<typeof logisticsResultSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;
export type Listing = ListingInput & { id: string; status: 'open'; createdAt: string };
export type Order = OrderInput & { id: string; status: 'open'; createdAt: string };
export type LineString = { type: 'LineString'; coordinates: [number, number][] };
export type Trip = TripInput & { id: string; status: 'open'; createdAt: string;
  routeGeoJSON: LineString; routeDistanceM: number; routeDurationS: number; routeProvider: string; routeProfile: string };
export type QuoteSnapshot = z.infer<typeof quoteSnapshotSchema>;
export type ReviewInput = { listing: Listing; quotes: QuoteSnapshot[] };
export type PlanStatus = 'proposed' | 'farmer_accepted_pending_confirmations' | 'rejected';
export type TraceEntry = { role: 'market' | 'logistics' | 'advocate' | 'workflow'; action: string; outcome: string };
export type Plan = z.infer<typeof planSchema>;
export type GenerationResult = z.infer<typeof generationResultSchema>;
export type ApiMode = 'stub' | 'live' | 'deterministic_fallback';
export type ApiResponse<T> = { data: T; meta: { mode: ApiMode; persistence: 'memory' | 'postgres'; requestId: string } };

// Runtime schemas mirror the existing module handoff; no runtime import from contracts/.
export const listingSchema = listingInputSchema.extend({ id: idSchema, status: z.literal('open'), createdAt: dateSchema });
export const orderSchema = orderInputSchema.extend({ id: idSchema, status: z.literal('open'), createdAt: dateSchema });
export const lineStringSchema = z.strictObject({ type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2) });
export const tripSchema = tripInputSchema.extend({ id: idSchema, status: z.literal('open'), createdAt: dateSchema,
  routeGeoJSON: lineStringSchema, routeDistanceM: distance.positive(), routeDurationS: distance.positive(),
  routeProvider: z.string().min(1), routeProfile: z.string().min(1) });
export const quoteSnapshotSchema = z.strictObject({
  quoteId: idSchema, listingId: idSchema, orderId: idSchema, tripId: idSchema, quantityKg: quantity,
  pricePerKgMinor: positive, baseMinor: whole, perKmMinor: whole, handlingMinor: whole,
  ratePerKgKmMinor: whole, pricingVersion: z.literal('weight-distance-v2'),
  routeCarryDistanceM: distance, shipmentChargeMinor: whole, detourChargeMinor: whole, expiresAt: dateSchema,
  grossMinor: whole, transportMinor: whole, netMinor: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  baseGeometry: lineStringSchema, modifiedGeometry: lineStringSchema,
  baseDistanceM: distance, modifiedDistanceM: distance, extraDistanceM: distance,
  baseDurationS: distance, modifiedDurationS: distance, extraTimeS: distance,
  pickupAt: dateSchema, deliveryAt: dateSchema, generatedAt: dateSchema,
  ruleOutcomes: z.record(z.string(), z.boolean()),
});
export const traceEntrySchema = z.strictObject({ role: z.enum(['market', 'logistics', 'advocate', 'workflow']),
  action: z.string().max(100), outcome: z.string().max(500) });
export const sourceSnapshotSchema = z.strictObject({ listing: listingSchema, order: orderSchema, trip: tripSchema });
export const apiModeSchema = z.enum(['stub', 'live', 'deterministic_fallback']);
export const planSchema = z.strictObject({
  id: idSchema, listingId: idSchema, orderId: idSchema, tripId: idSchema, quantityKg: quantity,
  status: z.enum(['proposed', 'farmer_accepted_pending_confirmations', 'rejected']),
  quoteSnapshot: quoteSnapshotSchema, review: reviewResultSchema, trace: z.array(traceEntrySchema),
  expiresAt: dateSchema, createdAt: dateSchema,
  sourceSnapshot: sourceSnapshotSchema, mode: apiModeSchema,
}).refine(plan => plan.listingId === plan.quoteSnapshot.listingId && plan.orderId === plan.quoteSnapshot.orderId &&
  plan.tripId === plan.quoteSnapshot.tripId && plan.quantityKg === plan.quoteSnapshot.quantityKg &&
  plan.sourceSnapshot.listing.id === plan.listingId && plan.sourceSnapshot.order.id === plan.orderId &&
  plan.sourceSnapshot.trip.id === plan.tripId && plan.review.verdict === 'recommend' &&
  plan.review.selectedQuoteId === plan.quoteSnapshot.quoteId && Date.parse(plan.expiresAt) > Date.parse(plan.createdAt),
  { message: 'Plan must contain a consistent, reviewed proposal and its sources' });
export const generationResultSchema = z.strictObject({
  outcome: z.enum(['proposed', 'no_feasible_plan']), plan: planSchema.nullable(),
  alternatives: z.array(quoteSnapshotSchema).max(1), rejections: logisticsResultSchema.shape.rejections,
  trace: z.array(traceEntrySchema), searchComplete: z.boolean(), mode: apiModeSchema,
}).refine(result => (result.outcome === 'proposed') === (result.plan !== null) &&
  (!result.plan || result.plan.mode === result.mode), { message: 'Generation outcome and mode must match its saved proposal' });
