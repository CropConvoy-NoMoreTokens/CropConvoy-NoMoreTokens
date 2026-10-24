// Supplemental P4 export until P2 adds these schemas to scripts/export-contracts.ts.
// Run after npm run contracts:export, from api/. Never imported by a running service.
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { listingSchema, orderSchema, tripSchema, quoteSnapshotSchema, planSchema, generationResultSchema } from '../../core/contracts.js';
const path = new URL('../../../../contracts/schemas.json', import.meta.url);
const existing = JSON.parse(await readFile(path, 'utf8'));
const schemas = { Listing: listingSchema, Order: orderSchema, Trip: tripSchema,
  QuoteSnapshot: quoteSnapshotSchema, Plan: planSchema, GenerationResult: generationResultSchema };
await writeFile(path, JSON.stringify({ ...existing, ...Object.fromEntries(Object.entries(schemas)
  .map(([name, schema]) => [name, z.toJSONSchema(schema)])) }, null, 2) + '\n');
console.log('Exported P4 result schemas');
