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
export type QuoteSnapshot = {
  quoteId: string; listingId: string; orderId: string; tripId: string; quantityKg: number;
  pricePerKgMinor: number; baseMinor: number; perKmMinor: number; handlingMinor: number;
  grossMinor: number; transportMinor: number; netMinor: number;
  baseGeometry: LineString; modifiedGeometry: LineString;
  baseDistanceM: number; modifiedDistanceM: number; extraDistanceM: number;
  baseDurationS: number; modifiedDurationS: number; extraTimeS: number;
  pickupAt: string; deliveryAt: string; generatedAt: string;
  ruleOutcomes: Record<string, boolean>;
};
export type ReviewInput = { listing: Listing; quotes: QuoteSnapshot[] };
export type PlanStatus = 'proposed' | 'farmer_accepted_pending_confirmations' | 'rejected';
export type TraceEntry = { role: 'market' | 'logistics' | 'advocate' | 'workflow'; action: string; outcome: string };
export type Plan = {
  id: string; listingId: string; orderId: string; tripId: string; quantityKg: number;
  status: PlanStatus; quoteSnapshot: QuoteSnapshot; review: ReviewResult;
  trace: TraceEntry[]; expiresAt: string; createdAt: string;
};
export type GenerationResult = {
  outcome: 'proposed' | 'no_feasible_plan'; plan: Plan | null;
  alternatives: QuoteSnapshot[]; rejections: LogisticsResult['rejections'];
  trace: TraceEntry[]; searchComplete: boolean;
};
export type ApiMode = 'stub' | 'live' | 'deterministic_fallback';
export type ApiResponse<T> = { data: T; meta: { mode: ApiMode; persistence: 'memory' | 'postgres'; requestId: string } };
