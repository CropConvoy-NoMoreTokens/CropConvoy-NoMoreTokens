# Prediction demo handoff

Implemented on 24 October 2026. Open the local website's Insights link:
http://127.0.0.1:4173/#/insights

## What changed

- Shared training/inference features fix previous-year target-month prices across all six horizons.
- Verified CUDA loading and predictions; no silent CPU fallback. A persistent worker keeps Windows CUDA contexts stable.
- Strict input/history validation, structured 422 feedback and fail-closed 503 behavior.
- Planting uses actual supported harvest-month forecasts; no silent latest-price substitution.
- Exact minor-unit financial breakdowns; positive, break-even and negative outcomes have distinct labels.
- Catalog-driven calendars and assumptions, explicit update actions, preserved inputs/results, cancellation and duplicate-submit protection.
- Six generated transparent produce cutouts, responsive image selections, clearer price result and crop comparison cards.
- Native keyboard tabs, accessible chart table, error summaries, loading/error states and reduced-motion support.

## Training

Both models were trained once in a visible PowerShell window, left open afterward, on the RTX 4070.
The run reused the existing synthetic CSVs and verified cuda:0 for both regressors.
Elapsed time: 2.34 seconds. Transcript: ml/logs/training-20261024-135121.log.
The model card now derives its metric tables from the saved evaluation report.
Artifact/data hashes and schema version are in ml/artifacts/model_manifest.json.
Training time depends on hardware and dataset size.

## Final verification

64 ML tests passed; 49 frontend tests passed; production build and whitespace checks passed.
All 108 live produce/market/horizon forecasts succeeded with cuda:0 after restarting the service.
Default planting conditions now rank tomato first after correcting harvest-month price inputs.
Responsive checks covered both screens at 360, 390, 768 and 1440 pixels, light and dark, with
no horizontal overflow or visible broken images. The image variants total about 683 KiB.

Measured Lighthouse scores:
price: 88 performance, 100 accessibility, 100 best practices, 100 SEO (CLS 0);
planting: 86 performance, 100 accessibility, 100 best practices, 100 SEO (CLS 0.112).
A final loading-space adjustment was subsequently build/test verified.
Logs, reports and screenshots are under ml/logs, excluded from Git.

Native 200% zoom could not be verified: the in-app shortcut had no effect and browser access
was later disabled in Work settings. The 200% text QA helper now includes both prediction routes,
but the final enlargement walkthrough remains unchecked. Reduced motion has component/CSS coverage.
See TEST-CHECKLIST.md for individual observed controls and verification boundaries.

## Demo sequence

1. Keep the ML service running on port 8001 and open Insights.
2. Pick Carrot, choose a market/month, then Update forecast.
3. Open All history and the accessible table; inspect or copy the result.
4. Switch to What to plant and inspect the default comparison.
5. Change soil to Clay; compare to show explicit exclusions.
6. Return soil to Loam, open costs, enter high costs for all three crops, and compare to show loss labels.
7. Restore costs by clearing overrides and compare again.

These are synthetic scenarios, not validated price/yield predictions or real financial advice.
There is no transaction ingestion, automatic retraining, production authentication or deployment.
