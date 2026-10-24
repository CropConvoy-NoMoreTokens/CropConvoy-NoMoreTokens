# CropConvoy prediction service

Two saved XGBoost regressors serve six-produce price forecasts and three-crop planting comparisons. Data and projections are synthetic demo estimates. CPU inference is the default; CUDA remains an explicit option. Existing GPU-trained models do not need retraining for CPU serving.

The application uses:

```text
Vercel browser → Node API /api/ml/* → separate Python ML service
```

Only the Node API knows the ML service URL and shared key. Insights stays public and rate limited through the API; marketplace authentication and booking rules are unchanged. Responses under /api/ml retain the ML raw JSON shape.

## Run locally

From the repository root, with Python 3.12:

```sh
python3.12 -m venv ml/.venv
ml/.venv/bin/python -m pip install -r ml/requirements-cpu.lock
ML_INFERENCE_DEVICE=cpu ml/.venv/bin/python -m uvicorn ml.server:app --host 127.0.0.1 --port 8001 --workers 1
```

On macOS, install libomp if XGBoost reports that the OpenMP library is missing. On Windows use ml/.venv/Scripts/python.exe for the same Python commands and set environment values with PowerShell. Create a virtual environment only if it does not exist.

The backend's ignored api/.env contains:

```dotenv
ML_API_BASE_URL=http://localhost:8001
ML_API_KEY=
ML_REQUEST_TIMEOUT_MS=60000
```

An empty key is allowed only for local development. If you set ML_API_KEY, set the same value in the ML process environment. The ML process reads environment variables, not api/.env. Never put the key in web/, VITE_ variables, URLs or source control.

Run the Node API and frontend in separate terminals:

```sh
npm --prefix api run dev
npm --prefix web run dev
```

For local frontend testing, web/.env should use VITE_API_BASE_URL=http://localhost:3001. Open /#/insights. VITE_ML_API_BASE_URL is no longer used. The browser calls the Node API, which calls Python; Python needs no browser CORS configuration.

## Hosting on Render

Follow [the separate-service deployment guide](../docs/ML-DEPLOYMENT.md). The ML service runs from the repository root, not ml/, because ml.server uses package imports. Render's public HTTPS URL is configured on the backend as ML_API_BASE_URL. Both Render services receive the same server-only ML_API_KEY. On Render, missing key configuration prevents predictions from becoming ready. Health remains publicly accessible for platform readiness checks.

The CPU dependency profile uses the smaller xgboost-cpu Linux package; on other platforms it uses the pinned xgboost package. Both expose the same Python API. Inference is serialized and uses one XGBoost thread to limit CPU contention. Free-tier memory and cold-start behavior still need monitoring on the deployed instance.

## Runtime behavior

ML_INFERENCE_DEVICE defaults to cpu. Set cuda or cuda:N only on an NVIDIA-capable host. Startup loads both saved artifacts, validates their hashes/features and both datasets, runs representative predictions, and verifies the effective device. CUDA configuration cannot silently become CPU serving. Missing/corrupt artifacts, changed data or invalid outputs return 503. Historical prices/catalog remain readable when their data is valid, even if inference is unavailable.

The Node proxy validates requests and upstream schemas, bounds response size and time, cancels disconnected requests, forwards only five fixed endpoints, and never forwards browser tokens or headers. Only its own X-ML-API-Key header reaches Python. It preserves field validation responses and sanitizes dependency errors. Forecasts never become authoritative marketplace prices or update quote snapshots.

## Endpoints

| Method | Python path | Node path |
|---|---|---|
| GET | /health | /api/ml/health |
| GET | /v1/catalog | /api/ml/v1/catalog |
| GET | /v1/prices/history?produceId=tomato&marketId=dambulla | /api/ml/v1/prices/history?produceId=tomato&marketId=dambulla |
| POST | /v1/prices/forecast | /api/ml/v1/prices/forecast |
| POST | /v1/planting/recommendations | /api/ml/v1/planting/recommendations |

Direct analytical Python routes require X-ML-API-Key when configured. Health is public. The Node proxy's public routes are intended for synthetic Insights and keep the existing API IP limit. They use raw ML JSON; dependency errors from Node use its normal error object.

Forecast input: {produceId,marketId,targetMonth}. Planting input: {plantingMonth,regionProfile,marketId,areaHa?,soilType?,soilPh?,irrigationAvailable?,cultivationCostOverride?}. Dates use YYYY-MM; choose available months from the catalog. Unknown fields/crops, non-finite numbers, unsupported horizons, area outside 0.1–100 ha, pH outside 0–14 and costs outside LKR 0–1,000,000,000/ha are rejected. Financial *_minor amounts are integer LKR minor units; analytical yields may be fractional kg. Marketplace quantities remain whole kg.

## Verification

From the repository root:

```sh
ML_INFERENCE_DEVICE=cpu ml/.venv/bin/python -m pytest ml/test_ml.py ml/test_service_unavailable.py -q
npm --prefix api test
npm --prefix web test
npm --prefix api run build
npm --prefix web run build
```

ML tests load the actual saved models on the configured device and cover all 108 produce/market/horizon combinations, temporal feature parity, input validation, financial arithmetic, calendar changes, artifact/data integrity and unavailable/authentication behavior. No training or CSV regeneration occurs during tests. CUDA serving must be tested separately on CUDA hardware.

## Training and provenance

Training remains an explicit GPU workflow; serving does not train. On the original NVIDIA Windows environment, run python -u -X utf8 -m ml.run_all --reuse-data --verbose-eval 10. Install ml/requirements.lock for CUDA training. Training stages artifacts and publishes them after success; restarting the ML service loads the new set. Model-card scores describe held-out synthetic data, not observed market accuracy.

Dataset hashes use the versioned sha256-lf-v1 format, normalizing only Windows CRLF to LF. Training and serving share that function; model/preprocessor hashes remain byte-exact. The original Windows hashes were verified against identical observations before normalization. Models and training observations were not changed by the CPU integration. See MODEL_CARD.md and artifacts/model_manifest.json.
