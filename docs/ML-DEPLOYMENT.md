# Separate CPU ML service on Render

The browser calls the existing Node API. Node proxies the five Insights endpoints to a separate Python service. Keep the ML URL/key on the Node backend; Vercel needs only VITE_API_BASE_URL. CORS is application middleware and is independent of Render's Network settings. Server-to-server traffic does not use browser CORS.

## 1. Create the Python service

After reviewing and committing the changes to your deployed branch, create a second Render Web Service connected to this repository:

| Setting | Value |
|---|---|
| Name | cropconvoy-ml (or your chosen name) |
| Runtime | Python 3 |
| Root Directory | Leave blank: repository root |
| Build Command | `pip install -r ml/requirements-cpu.lock` |
| Start Command | `python -m uvicorn ml.server:app --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/health` |
| Instance | Free for the prototype; monitor memory and latency |
| Python | Repository .python-version selects the latest Python 3.12 patch |

Do not set Root Directory to ml/: the start command imports the ml package. The saved model artifacts and synthetic CSVs are committed and loaded at startup. Do not run training or regenerate data during build/start. The CPU dependency profile avoids Linux CUDA libraries. Runtime inference uses one worker and one XGBoost thread.

Set these environment variables on the ML service:

```dotenv
ML_INFERENCE_DEVICE=cpu
ML_API_KEY=<a-long-random-shared-secret>
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
```

Generate the secret with a password manager or `openssl rand -hex 32`, then copy the same value to the Node service. Never put the key in Git, browser variables, query strings or logs. Render supplies PORT and RENDER automatically. On Render, missing ML_API_KEY prevents model readiness and analytical routes return 503. `/health` needs no key so Render can check model readiness. Other ML endpoints require X-ML-API-Key.

The checked-in render.yaml contains both services as an optional Blueprint. Match service names before linking it to existing services. It does not change existing Dashboard settings automatically. No service is created or deployed merely by editing that file.

## 2. Connect the existing Node service

Once the Python service is live, copy its public HTTPS URL. In the Node service's Render Environment settings, add:

```dotenv
ML_API_BASE_URL=https://YOUR-ML-SERVICE.onrender.com
ML_API_KEY=<the-same-shared-secret>
ML_REQUEST_TIMEOUT_MS=60000
```

Keep its existing Root Directory=api, build `npm ci --include=dev && npm run build`, and start `npm start`. Deploy the updated Node code and apply the environment changes. The public URL is intentional for separately hosted free services; protection comes from the shared key. A paid setup can instead use an appropriate internal service URL.

The Node proxy passes only its own service key. Browser Authorization headers and client-supplied ML keys are discarded. It validates inputs/responses, rejects redirects and arbitrary routes, and returns sanitized 503 errors for outages, invalid model replies or timeouts. Other marketplace routes keep their existing login/role/owner checks. `/api/ml/*` remains public synthetic decision support under the API's request limiter, matching the public Insights page.

## 3. Connect Vercel

Set the frontend project's variables for the desired Vercel environment:

```dotenv
VITE_API_BASE_URL=https://cropconvoy-nomoretokens.onrender.com
VITE_DATA_MODE=api
```

Remove VITE_ML_API_BASE_URL if present; it is ignored. Do not add ML_API_KEY to Vercel. Rebuild/redeploy the frontend because Vite embeds public values during its build. The browser's Network panel should show `/api/ml/health`, `/api/ml/v1/catalog` and prediction requests on the Node API domain, never port 8001 or the Python domain.

## 4. Verify

1. Open the Python service's `/health`: expect 200, models_loaded=true and inference_device=cpu. Its `/v1/catalog` without a service key should return 401.
2. Open the Node service's `/api/ml/health`: expect the same CPU-ready model result without entering the shared key in the browser.
3. Open Node `/api/ml/v1/catalog` and use its current forecast_months/planting_months values.
4. Open Vercel `/#/insights`. It should display CPU ready, history, a forecast and a planting comparison. All outputs remain explicitly synthetic.
5. Confirm ordinary marketplace login, saved plans and approval/history still work. No database migration is required for this change.

If Node returns ML_NOT_CONFIGURED, check its ML_API_BASE_URL. For ML_UNAVAILABLE, verify Python health and matching keys; also check Python startup logs for missing artifacts or hash errors. ML_TIMEOUT can occur while either free service wakes. A valid search with no eligible crops is a successful empty comparison; never replace it with fabricated predictions.

## Free-tier limits

Render spins idle free services down after 15 minutes, and waking can take about a minute. Either service can sleep. The Node upstream deadline is 60 seconds and the browser deadline is 75 seconds; two cold starts can exceed these limits. Wait and retry, or open the ML health URL first for a demonstration. Inputs remain available when requests fail; repeated automatic retries are not performed.

Free instance hours are shared across the workspace, so two free services consume the shared allowance while running. Monitor memory: dependencies/models may require a paid instance if the deployed process exceeds free limits. These changes were validated locally, not benchmarked on a Render free instance. Models load from committed artifacts after each restart; the ephemeral filesystem is not used for durable training output.

References: [Render FastAPI setup](https://render.com/docs/deploy-fastapi), [Python version selection](https://render.com/docs/python-version), [free service limits](https://render.com/docs/free), [XGBoost CPU installation](https://xgboost.readthedocs.io/en/stable/install.html#minimal-installation-cpu-only).
