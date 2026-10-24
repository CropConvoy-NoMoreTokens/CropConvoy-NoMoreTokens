import { z } from 'zod';

const produce = z.enum(['tomato', 'potato', 'carrot', 'banana', 'papaya', 'pineapple']);
const market = z.enum(['dambulla', 'colombo', 'kandy']);
const crop = z.enum(['tomato', 'potato', 'carrot']);
const region = z.enum(['warm_lowland', 'mild_midcountry', 'cool_upland']);
const soil = z.enum(['loam', 'sandy_loam', 'clay']);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const day = z.iso.date();
const amount = z.number().int().safe();
const positiveAmount = amount.positive();
const nonnegative = z.number().nonnegative();
const source = z.literal('synthetic');
const device = z.string().regex(/^(cpu|cuda(:\d+)?)$/);

export const historyQuerySchema = z.strictObject({ produceId: produce, marketId: market });
export const forecastInputSchema = historyQuerySchema.extend({ targetMonth: month });
export const plantingInputSchema = z.strictObject({
  plantingMonth: month, regionProfile: region, marketId: market,
  areaHa: z.number().min(0.1).max(100).optional(), soilType: soil.optional(),
  soilPh: z.number().min(0).max(14).optional(), irrigationAvailable: z.boolean().optional(),
  cultivationCostOverride: z.partialRecord(crop, z.number().min(0).max(1_000_000_000)).optional(),
});

export const healthSchema = z.object({
  status: z.literal('ok'), models_loaded: z.literal(true), inference_device: device,
  server_date: day, data_cutoff: month, data_source: source,
  feature_version: z.string().min(1), xgboost_version: z.string().min(1), generator_version: z.string().min(1),
  gpu_name: z.string().optional(),
});
export const catalogSchema = z.object({
  server_date: day, data_cutoff: month.nullable(), forecast_months: z.array(month).max(6), planting_months: z.array(month).max(3),
  produce: z.record(produce, z.object({ label: z.string() })), markets: z.record(market, z.object({ label: z.string() })),
  crops: z.record(crop, z.object({ label: z.string(), duration_days: z.number().positive(), cost_lkr_ha: nonnegative,
    ref_yield_kg_ha: nonnegative, temp_range: z.tuple([z.number(), z.number()]), ph_range: z.tuple([z.number(), z.number()]) })),
  climate_profiles: z.record(region, z.object({ label: z.string(), temp_mean: z.number(), rainfall_mean: nonnegative })),
  assumptions: z.object({ loss_rate: z.number().min(0).max(1), marketing_transport_lkr_kg: nonnegative,
    stress_price_discount: z.number().min(0).max(1), stress_yield_discount: z.number().min(0).max(1), data_source: source }),
});
export const historySchema = z.object({ produce_id: produce, market_id: market, data_source: source,
  prices: z.array(z.object({ month, price_per_kg_minor: positiveAmount })).min(1).max(2400) });
export const forecastSchema = z.object({ produce_id: produce, market_id: market, origin_month: month, target_month: month,
  horizon_months: z.number().int().min(1).max(6), forecast_price_per_kg_minor: positiveAmount,
  latest_known_price_per_kg_minor: positiveAmount, previous_year_price_per_kg_minor: positiveAmount.nullable(),
  predicted_change_pct: z.number(), data_source: source, inference_device: device });
const financials = z.object({ harvested_kg: nonnegative, sellable_kg: nonnegative,
  revenue_minor: amount.nonnegative(), cultivation_cost_minor: amount.nonnegative(), marketing_cost_minor: amount.nonnegative(),
  net_return_minor: amount, net_return_per_ha_minor: amount,
}).refine(value => value.net_return_minor === value.revenue_minor - value.cultivation_cost_minor - value.marketing_cost_minor,
  'Financial totals must match their stored components');
export const recommendationsSchema = z.object({
  planting_month: month, region_profile: region, market_id: market, soil_type: soil, soil_ph: z.number().min(0).max(14),
  irrigation_available: z.boolean(), area_ha: z.number().min(0.1).max(100), data_source: source,
  data_cutoff: month, inference_device: device, all_negative_returns: z.boolean(),
  stress_assumptions: z.object({ price_discount: z.number().min(0).max(1), yield_discount: z.number().min(0).max(1) }),
  recommendations: z.array(z.object({ crop_id: crop, crop_label: z.string(), planting_date: day, harvest_date: day,
    harvest_month: month, predicted_yield_kg_ha: nonnegative, forecast_price_per_kg_minor: positiveAmount,
    price_source: z.string(), cultivation_cost_lkr_ha: nonnegative, central: financials, stressed: financials,
    area_ha: z.number().min(0.1).max(100) })).max(3),
  exclusions: z.array(z.object({ crop_id: crop, crop_label: z.string(), reasons: z.array(z.string()) })).max(3),
});
