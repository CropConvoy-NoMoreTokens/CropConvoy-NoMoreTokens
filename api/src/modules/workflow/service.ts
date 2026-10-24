import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { generationResultSchema, logisticsResultSchema, marketResultSchema, quoteSnapshotSchema,
  type GenerationResult, type Plan, type MarketResult, type ReviewResult, type QuoteSnapshot, type TraceEntry } from '../../core/contracts.js';
import type { Dependencies } from '../../core/dependencies.js';
import type { MarketRepository } from '../market/repository.js';
import { findMarket, marketUsedFallback } from '../market/service.js';
import type { LogisticsService, InstrumentedLogisticsService } from '../logistics/service.js';
