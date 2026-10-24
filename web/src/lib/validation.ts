import { z } from 'zod';
const int = z.number({ error: 'Enter a whole number.' }).int('Use whole kilograms.').min(1, 'Enter a quantity above zero.').max(2147483647);
const amount = z.number({ error: 'Enter a valid amount with no more than two decimals.' }).int().min(0, 'Amount cannot be negative.').max(Number.MAX_SAFE_INTEGER);
export const pointSchema = z.object({ lat: z.number().min(-90, 'Latitude must be between -90 and 90.').max(90), lng: z.number().min(-180, 'Longitude must be between -180 and 180.').max(180) });
const crop = z.enum(['tomato', 'potato', 'carrot'], { error: 'Choose a supported crop.' });
const date = z.iso.datetime({ error: 'Choose a valid date and time in Sri Lanka.' });
export const listingSchema = z.object({ demoFarmerId: z.uuid(), crop, quantityKg: int, pickup: pointSchema, readyAt: date, minNetMinor: amount, confirmed: z.literal(true) });
export const orderSchema = z.object({ demoBuyerId: z.uuid(), crop, remainingKg: int, pricePerKgMinor: amount.min(1, 'Price must be greater than zero.'), delivery: pointSchema, deadlineAt: date, allowsPartial: z.boolean() });
export const tripSchema = z.object({ demoTransporterId: z.uuid(), start: pointSchema, end: pointSchema, departureAt: date, availableKg: int, corridorM: int, maxExtraDistanceM: amount.max(2147483647), maxExtraTimeS: amount.max(2147483647), baseMinor: amount, perKmMinor: amount, handlingMinor: amount });
export function validationErrors(error: z.ZodError): Record<string, string> { return Object.fromEntries(error.issues.map(issue => [issue.path.join('.'), issue.message])); }
