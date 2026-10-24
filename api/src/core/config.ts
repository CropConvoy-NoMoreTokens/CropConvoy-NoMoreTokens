import 'dotenv/config';
import { z } from 'zod';
export const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_STUBS: z.enum(['true', 'false']).default('true'),
  DEMO_MODE: z.enum(['true', 'false']).default('true'),
  DATABASE_URL: z.string().default(''),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default(''),
  LLM_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  ROUTING_BASE_URL: z.preprocess(v => v === '' ? undefined : v, z.string().url().optional()),
  ROUTING_PROFILE: z.string().default('driving'),
  MAX_PLAN_MS: z.coerce.number().int().min(1000).max(45000).default(45000),
  ML_API_BASE_URL: z.union([z.literal(''), z.url({ protocol: /^https?$/ })]).default(''),
  ML_API_KEY: z.string().default(''),
  ML_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(60000),
}).parse(process.env);
