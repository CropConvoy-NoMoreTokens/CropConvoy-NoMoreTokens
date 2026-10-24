import { z } from 'zod';
import { measurement, money } from './contracts.js';
export const fareInputSchema = z.strictObject({
  quantityKg: z.number().int().positive().max(2147483647), pricePerKgMinor: money.positive(),
  baseMinor: money, handlingMinor: money, minNetMinor: money, extraDistanceM: measurement, perKmMinor: money,
  routeCarryDistanceM: measurement, shipmentPerKmMinor: money, pricingVersion: z.literal('hybrid-v1'),
});
function safe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Money exceeds safe integer bounds');
  return value;
}
/** Per-shipment rates; weight constrains capacity and is not a hidden price multiplier. */
export function calculateProceeds(input: z.infer<typeof fareInputSchema>) {
  const v = fareInputSchema.parse(input);
  const grossMinor = safe(v.quantityKg * v.pricePerKgMinor);
  const shipmentChargeMinor = safe(Math.round(v.routeCarryDistanceM / 1000 * v.shipmentPerKmMinor));
  const detourChargeMinor = safe(Math.round(v.extraDistanceM / 1000 * v.perKmMinor));
  const transportMinor = safe(safe(safe(v.baseMinor + shipmentChargeMinor) + detourChargeMinor) + v.handlingMinor);
  const netMinor = safe(grossMinor - transportMinor);
  return { grossMinor, shipmentChargeMinor, detourChargeMinor, transportMinor, netMinor, eligible: netMinor >= v.minNetMinor };
}
