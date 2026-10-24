# CropConvoy synthetic-data model card

Generated from evaluation_report.json. Training: 2026-10-24T13:51:22+0530.
Both XGBoost regressors were trained and refit on verified CUDA. Serving supports explicit CPU (default) or CUDA inference without retraining. An unexpected device change is rejected.

## Intended use
Interactive synthetic-data demo only. The generator's assumptions are illustrative,
not calibrated real-market observations. Scores below are offline synthetic holdout
results, not real-world accuracy or guarantees. WAPE is an error measure, not accuracy.
Price features contain only information available at each origin; inference uses the same builder.
Planting combines yield and harvest-month price predictions with suitability rules and costs.
The -15% price / -20% yield stress scenario is illustrative, not a confidence interval.

## Evaluation
Price train targets through 2023-12; validation 2024; test 2025-01 through 2026-09.
Yield splits use harvest dates; test ends 2026-04-17.
Final serving models are refit on all available data after holdout evaluation.
Dataset counts: 2322 price observations; 10000 cultivation cycles.

| Price metric | XGBoost | Latest price | Same month last year |
|---|---:|---:|---:|
| MAE (LKR/kg) | 21.2 | 47.65 | 26.76 |
| RMSE (LKR/kg) | 34.09 | 59.55 | 41.61 |
| WAPE (%) | 7.26 | 16.32 | 9.17 |

| Yield metric | XGBoost | Crop/region median |
|---|---:|---:|
| MAE (kg/ha) | 1429.1 | 3033.1 |
| RMSE (kg/ha) | 1860.4 | 3762.3 |

## Artifacts and limitations
Feature schema: 2.0.0. See artifacts/model_manifest.json for SHA-256
hashes, dataset hashes, training timestamp and library versions.
Six produce items / three markets; planting restricted to tomato, potato and carrot.
No automatic transaction ingestion, retraining, authenticated accounts or production advice.
Unavailable CUDA/models stop predictions with HTTP 503. Unsupported harvest horizons
produce exclusions instead of a substituted price.
