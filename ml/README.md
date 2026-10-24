# CropConvoy GPU prediction demo

Two XGBoost regressors support six-produce price forecasts and three-crop planting comparisons.
All observations and projections are synthetic. These are demo estimates, not validated market or agronomic advice.

## Local setup

Use native Windows Python 3.11 and the RTX 4070 with a functioning NVIDIA driver.
From the repository root (only create the environment if it does not already exist):

    py -3.11 -m venv ml/.venv
    & '.\ml\.venv\Scripts\python.exe' -m pip install -r ml/requirements.lock

Never commit .venv, logs, caches or local environment files. Models and synthetic CSVs are included.

## Train with visible progress

Open PowerShell in the repository root and run:

    & '.\ml\.venv\Scripts\python.exe' -u -X utf8 -m ml.run_all --reuse-data --verbose-eval 10

Keep that window open after the run. It prints the GPU gate, dataset counts, temporal splits,
boosting progress every ten iterations, early stopping, refitting, evaluation metrics and artifact paths.
A timestamped copy is saved in ignored ml/logs/training-*.log.
Both models run sequentially on CUDA; CPU fallback stops training.
--reuse-data reads the existing CSVs without changing them. Omitting it explicitly regenerates the
synthetic datasets. Training writes a staged artifact set, then publishes models, preprocessors,
evaluation, diagnostics and a hash manifest only after successful training.
The model card's tables are generated from that evaluation report.

The implementation run on 24 October 2026 reused 2,322 monthly price observations (2016-01–2026-09)
and 10,000 cultivation cycles, taking 2.34 seconds on the RTX 4070. Runtime depends on hardware.
Yield holdout records end in April 2026; they do not extend through the price cutoff.

## Serve locally

    & '.\ml\.venv\Scripts\python.exe' -u -X utf8 -m uvicorn ml.server:app --host 127.0.0.1 --port 8001

Startup validates continuous price history, all eighteen series, artifact/data hashes and feature order,
loads both models, explicitly selects CUDA and performs representative inference with each model.
Health returns 503 if GPU verification, data or artifact loading fails. Inference runs on one persistent
CUDA worker to avoid transient Windows HTTP-thread contexts. GPU model cleanup runs on that worker.
No automatic CPU fallback is supported. Do not set ML_INFERENCE_DEVICE=cpu.

The browser uses VITE_ML_API_BASE_URL=http://localhost:8001. Open the website's Insights link.
Restart the ML server after replacing trained artifacts. Keep the service running during the demo.
If startup fails, inspect its console, fix the model/data/GPU issue, then restart and choose Check again.

## Endpoints

| Method | Path | Behavior |
|---|---|---|
| GET | /health | Verified CUDA device, versions, server date, cutoff; otherwise 503 |
| GET | /v1/catalog | Produce, crops, markets, assumptions, Colombo date, supported forecast/planting months |
| GET | /v1/prices/history?produceId=tomato&marketId=dambulla | Full synthetic monthly history; available without models if data is valid |
| POST | /v1/prices/forecast | produceId, marketId, targetMonth; direct 1–6 month forecast |
| POST | /v1/planting/recommendations | Planting conditions and optional costs; ranked stressed returns and exclusions |

ML responses remain raw JSON, separate from the core marketplace API envelope.

Forecast example:

    {"produceId":"carrot","marketId":"dambulla","targetMonth":"2026-10"}

Planting example (replace the month with a current catalog value):

    {"plantingMonth":"2026-10","regionProfile":"mild_midcountry","marketId":"dambulla",
     "areaHa":1,"soilType":"loam","soilPh":6,"irrigationAvailable":true,
     "cultivationCostOverride":{"carrot":1600000}}

Validation: exact YYYY-MM, supported catalog values, area 0.1–100 hectares, pH 0–14,
costs LKR 0–1,000,000,000/ha; unknown fields and crop keys are rejected.
Invalid input returns 422 with field details. Prediction failures return 503.
Planting allows the current and next two Colombo months; this month uses today, future months day one.
Harvest-month prices must be inside the forecast window; unsupported crops are excluded, never given
a substituted price. No eligible crops is a successful comparison with explanations.

Amounts named *_minor are integer LKR minor units (100 = LKR 1). Financial net returns subtract the
rounded revenue/cost line items exactly. Yields in this analytical extension may be fractional kg;
the core marketplace continues to require whole kg.

## Verification

    & '.\ml\.venv\Scripts\python.exe' -u -X utf8 -m pytest ml/test_ml.py -q
    npm.cmd test --prefix web
    npm.cmd run build --prefix web

The ML suite tests actual HTTP requests and loaded CUDA artifacts, all 108 forecast combinations,
feature parity and no future leakage, validation, history integrity, GPU unavailability,
missing artifacts, calendar rollover, financial arithmetic and exclusions.
Model and dataset hashes are recorded in artifacts/model_manifest.json.
Scores describe held-out synthetic data only. See MODEL_CARD.md and web/TEST-CHECKLIST.md.

## Portable dataset verification and checks without CUDA

New manifests use `dataset_hash_format=sha256-lf-v1`: CSV hashes normalize CRLF to LF, matching the repository's checkout policy. Model/preprocessor hashes remain byte-exact. Training and serving use the same dataset hash function and serving checks both CSVs. The checked-in manifest was updated after verifying the old hashes match exactly the same CSV content with Windows line endings; models, observations and evaluation scores were not regenerated. Older manifests without a format keep their original byte-exact validation.

The marketplace and Insights frontend can build on machines without CUDA. With the pinned dependencies installed, run the hardware-independent subset from the repository root:

```sh
python -m pytest ml/test_service_unavailable.py ml/test_ml.py -q \
  -k 'service_unavailable or dataset_reproducibility or shared_features_and_no_future_leak or history_validation or exact_break_even_arithmetic'
```

These checks cover dataset/artifact integrity, Windows/Unix line endings, changed-data rejection, reproducible synthetic data, feature parity and absence of future leakage, exact financial arithmetic, calendar rollover, validation and unavailable-service HTTP behavior. The service refuses CPU configuration; historical prices and catalog remain readable while prediction endpoints return 503. These checks do not validate GPU inference. Run the complete suite above on an NVIDIA CUDA machine to verify forecasts and planting results.
