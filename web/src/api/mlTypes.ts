/**
 * Separate ML extension types.
 *
 * NOTE: The ML produce catalog is separate from the marketplace Crop type.
 * Adding fruits to price forecasting does NOT add them as valid core marketplace crop listings.
 */

export type MlProduceId = 'tomato' | 'potato' | 'carrot' | 'banana' | 'papaya' | 'pineapple';
export type MlMarketId = 'dambulla' | 'colombo' | 'kandy';
export type MlCropId = 'tomato' | 'potato' | 'carrot';
export type MlRegionProfile = 'warm_lowland' | 'mild_midcountry' | 'cool_upland';
export type MlSoilType = 'loam' | 'sandy_loam' | 'clay';

export interface MlHealth {
  server_date: string;
  feature_version: string;
  status: string;
  models_loaded: boolean;
  inference_device: string;
  data_cutoff: string;
  data_source: string;
  xgboost_version: string;
  generator_version: string;
  gpu_name: string;
}

export interface MlProduceInfo {
  label: string;
}

export interface MlMarketInfo {
  label: string;
}

export interface MlCropInfo {
  label: string;
  duration_days: number;
  cost_lkr_ha: number;
  ref_yield_kg_ha: number;
  temp_range: [number, number];
  ph_range: [number, number];
}

export interface MlClimateProfile {
  label: string;
  temp_mean: number;
  rainfall_mean: number;
}

export interface MlAssumptions {
  loss_rate: number;
  marketing_transport_lkr_kg: number;
  stress_price_discount: number;
  stress_yield_discount: number;
  data_source: string;
}

export interface MlCatalog {
  server_date: string;
  data_cutoff: string | null;
  forecast_months: string[];
  planting_months: string[];
  produce: Record<string, MlProduceInfo>;
  markets: Record<string, MlMarketInfo>;
  crops: Record<string, MlCropInfo>;
  climate_profiles: Record<string, MlClimateProfile>;
  assumptions: MlAssumptions;
}

export interface PriceObservation {
  month: string;
  price_per_kg_minor: number;
}

export interface PriceHistoryResponse {
  produce_id: string;
  market_id: string;
  data_source: string;
  prices: PriceObservation[];
}

export interface PriceForecastRequest {
  produceId: string;
  marketId: string;
  targetMonth: string; // YYYY-MM
}

export interface PriceForecastResponse {
  produce_id: string;
  market_id: string;
  origin_month: string;
  target_month: string;
  horizon_months: number;
  forecast_price_per_kg_minor: number;
  latest_known_price_per_kg_minor: number;
  predicted_change_pct: number;
  previous_year_price_per_kg_minor: number | null;
  data_source: string;
  inference_device: string;
}

export interface PlantingRecommendationsRequest {
  plantingMonth: string; // YYYY-MM
  regionProfile: string;
  marketId: string;
  areaHa?: number;
  soilType?: string;
  soilPh?: number;
  irrigationAvailable?: boolean;
  cultivationCostOverride?: Record<string, number>;
}

export interface Financials {
  harvested_kg: number;
  sellable_kg: number;
  revenue_minor: number;
  cultivation_cost_minor: number;
  marketing_cost_minor: number;
  net_return_minor: number;
  net_return_per_ha_minor: number;
}

export interface RecommendationItem {
  crop_id: string;
  crop_label: string;
  planting_date: string;
  harvest_date: string;
  harvest_month: string;
  predicted_yield_kg_ha: number;
  forecast_price_per_kg_minor: number;
  price_source: string;
  cultivation_cost_lkr_ha: number;
  central: Financials;
  stressed: Financials;
  area_ha: number;
}

export interface ExclusionItem {
  crop_id: string;
  crop_label: string;
  reasons: string[];
}

export interface PlantingRecommendationsResponse {
  planting_month: string;
  region_profile: string;
  market_id: string;
  soil_type: string;
  soil_ph: number;
  irrigation_available: boolean;
  area_ha: number;
  data_source: string;
  data_cutoff: string;
  inference_device: string;
  recommendations: RecommendationItem[];
  exclusions: ExclusionItem[];
  all_negative_returns: boolean;
  stress_assumptions: {
    price_discount: number;
    yield_discount: number;
  };
}
