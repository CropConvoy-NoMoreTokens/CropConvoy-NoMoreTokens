import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { listingInputSchema, orderInputSchema, tripInputSchema, extractInputSchema,
  generateInputSchema, decisionInputSchema, extractResultSchema, marketResultSchema,
  logisticsResultSchema, reviewResultSchema, listingSchema, orderSchema, tripSchema,
  quoteSnapshotSchema, planSchema, generationResultSchema } from '../src/core/contracts.js';
const schemas = { ListingInput: listingInputSchema, OrderInput: orderInputSchema, TripInput: tripInputSchema,
  ExtractInput: extractInputSchema, GenerateInput: generateInputSchema, DecisionInput: decisionInputSchema,
  ExtractResult: extractResultSchema, MarketResult: marketResultSchema, LogisticsResult: logisticsResultSchema,
  ReviewResult: reviewResultSchema, Listing: listingSchema, Order: orderSchema, Trip: tripSchema,
  QuoteSnapshot: quoteSnapshotSchema, Plan: planSchema, GenerationResult: generationResultSchema };
await writeFile(new URL('../../contracts/schemas.json', import.meta.url), JSON.stringify(
  Object.fromEntries(Object.entries(schemas).map(([key, schema]) => [key, z.toJSONSchema(schema)])), null, 2) + '\n');
console.log('Exported contracts/schemas.json');
