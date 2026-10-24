import { z } from 'zod';
import { idSchema } from '../../core/contracts.js';

// LlmClient returns a normalized allowlisted tool call, not provider-specific prose.
export const advocateOutputSchema = z.strictObject({ name: z.literal('review_quotes'),
  arguments: z.strictObject({ selectedQuoteId: idSchema.nullable(), requestAlternative: z.boolean() }) });
export const advocateTools = [{ name: 'review_quotes', description: 'Select a supplied quote or request one bounded alternative.',
  parameters: z.toJSONSchema(advocateOutputSchema.shape.arguments) }];
