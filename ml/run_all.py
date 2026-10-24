"""Run verified CUDA training; reuse existing datasets unless regeneration is requested."""
import argparse
import hashlib
import json
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
import pandas as pd
from .features import FEATURE_VERSION, validate_price_history

class Tee:
    def __init__(self, console, log):
        self.console, self.log = console, log
    def write(self, value):
        self.console.write(value)
        self.log.write(value)
        self.flush()
        return len(value)
    def flush(self):
        self.console.flush()
        self.log.flush()

def write_model_card(base, report, manifest):
    p = report["price_model"]["test_overall"]
    y = report["yield_model"]
    text = f"""# CropConvoy synthetic-data model card

Generated from evaluation_report.json. Training: {report['timestamp']}.
Both XGBoost regressors were trained and refit on verified CUDA. No CPU fallback.

## Intended use
Interactive synthetic-data demo only. The generator's assumptions are illustrative,
not calibrated real-market observations. Scores below are offline synthetic holdout
results, not real-world accuracy or guarantees. WAPE is an error measure, not accuracy.
Price features contain only information available at each origin; inference uses the same builder.
Planting combines yield and harvest-month price predictions with suitability rules and costs.
The -15% price / -20% yield stress scenario is illustrative, not a confidence interval.

## Evaluation
Price train targets through 2023-12; validation 2024; test 2025-01 through {report['data_cutoff']}.
Yield splits use harvest dates; test ends {report['yield_test_end']}.
Final serving models are refit on all available data after holdout evaluation.
Dataset counts: {report['price_rows']} price observations; {report['yield_rows']} cultivation cycles.

| Price metric | XGBoost | Latest price | Same month last year |
|---|---:|---:|---:|
| MAE (LKR/kg) | {p['model_mae_lkr']} | {p['naive_mae_lkr']} | {p['prev_year_mae_lkr']} |
| RMSE (LKR/kg) | {p['model_rmse']} | {p['naive_rmse']} | {p['prev_year_rmse']} |
| WAPE (%) | {p['model_wape_pct']} | {p['naive_wape_pct']} | {p['prev_year_wape_pct']} |

| Yield metric | XGBoost | Crop/region median |
|---|---:|---:|
| MAE (kg/ha) | {y['test_mae_kg_ha']} | {y['baseline_mae_kg_ha']} |
| RMSE (kg/ha) | {y['test_rmse']} | {y['baseline_rmse']} |

## Artifacts and limitations
Feature schema: {manifest['feature_version']}. See artifacts/model_manifest.json for SHA-256
hashes, dataset hashes, training timestamp and library versions.
Six produce items / three markets; planting restricted to tomato, potato and carrot.
No automatic transaction ingestion, retraining, authenticated accounts or production advice.
Unavailable CUDA/models stop predictions with HTTP 503. Unsupported harvest horizons
produce exclusions instead of a substituted price.
"""
    (base / "MODEL_CARD.md").write_text(text, encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-data", action="store_true", help="Read existing CSVs; never regenerate them.")
    parser.add_argument("--verbose-eval", type=int, default=10)
    args = parser.parse_args()
    if args.verbose_eval < 1:
        parser.error("--verbose-eval must be positive")
    base = Path(__file__).parent
    logs = base / "logs"
    logs.mkdir(exist_ok=True)
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = logs / f"training-{run_id}.log"
    with log_path.open("w", encoding="utf-8") as log:
        stdout, stderr = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = Tee(stdout, log), Tee(stderr, log)
        try:
            _run(base, args, run_id, log_path)
        except Exception:
            print("\nFAILED: training did not publish a new artifact set.", flush=True)
            raise
        finally:
            sys.stdout, sys.stderr = stdout, stderr

def _run(base, args, run_id, log_path):
    from .gpu_check import run_gpu_smoke_test
    from .generate_prices import generate_price_data
    from .generate_yields import generate_yield_data
    from .train import train_all
    import xgboost
    started = time.perf_counter()
    staging = base / "logs" / f"artifacts-{run_id}"
    print("CropConvoy - visible CUDA training", flush=True)
    print(f"Log: {log_path.resolve()}", flush=True)
    diag = run_gpu_smoke_test(staging)
    if diag.get("status") != "PASSED":
        raise RuntimeError(diag.get("error", "GPU verification failed"))
    data = base / "data"
    if args.reuse_data:
        prices = pd.read_csv(data / "price_data.csv")
        yields = pd.read_csv(data / "yield_data.csv")
        print("Reusing existing CSVs; datasets will not be regenerated.", flush=True)
    else:
        prices = generate_price_data(output_dir=data)
        yields = generate_yield_data(output_dir=data)
    cutoff = validate_price_history(prices)
    print(f"Data: {len(prices)} price rows, {len(yields)} yield rows. Cutoff {cutoff}.", flush=True)
    print("Temporal split: training through 2023; validation 2024; testing 2025 onward.", flush=True)
    report = train_all(prices, yields, staging, verbose_eval=args.verbose_eval)
    files = ["price_model.ubj","yield_model.ubj","price_preprocessors.pkl","yield_preprocessors.pkl"]
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    manifest = {"feature_version":FEATURE_VERSION,"data_cutoff":cutoff,
        "trained_at":report["timestamp"],"xgboost_version":xgboost.__version__,
        "training_devices":{n:report[n+"_model"]["effective_device"] for n in ("price","yield")},
        "sha256":{name:digest(staging/name) for name in files},
        "dataset_sha256":{name:digest(data/name) for name in ("price_data.csv","yield_data.csv")}}
    (staging/"model_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    artifacts = base/"artifacts"
    artifacts.mkdir(exist_ok=True)
    for source in staging.iterdir():
        target = artifacts/source.name
        temporary = artifacts/(source.name+".new")
        shutil.copyfile(source,temporary)
        temporary.replace(target)
    write_model_card(base,report,manifest)
    print(json.dumps(report,indent=2),flush=True)
    print(f"\nSUCCESS - both models trained on CUDA in {time.perf_counter()-started:.2f}s",flush=True)
    print(f"Artifacts: {artifacts.resolve()}\nLog: {log_path.resolve()}",flush=True)

if __name__ == "__main__":
    main()
