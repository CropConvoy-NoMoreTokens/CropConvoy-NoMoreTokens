import { z } from 'zod';
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const fareInputSchema = z.strictObject({ quantityKg: amount.min(1), pricePerKgMinor: amount.min(1),
  baseMinor: amount, extraDistanceM: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER), perKmMinor: amount, handlingMinor: amount, minNetMinor: amount });
export function calculateProceeds(input: z.infer<typeof fareInputSchema>) {
  const v = fareInputSchema.parse(input);
  const grossMinor = v.quantityKg * v.pricePerKgMinor;
  const transportMinor = v.baseMinor + Math.round(v.extraDistanceM / 1000 * v.perKmMinor) + v.handlingMinor;
  const netMinor = grossMinor - transportMinor;
  if (![grossMinor, transportMinor, netMinor].every(Number.isSafeInteger)) throw new Error('Money exceeds safe integer bounds');
  return { grossMinor, transportMinor, netMinor, eligible: netMinor >= v.minNetMinor };
}
