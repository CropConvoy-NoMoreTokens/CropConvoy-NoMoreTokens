import 'dotenv/config';
import { z } from 'zod';
export const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_STUBS: z.enum(['true', 'false']).default('true'),
  DEMO_MODE: z.enum(['true', 'false']).default('true'),
  DATABASE_URL: z.string().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MAX_PLAN_MS: z.coerce.number().int().min(1000).max(45000).default(45000),
}).parse(process.env);
