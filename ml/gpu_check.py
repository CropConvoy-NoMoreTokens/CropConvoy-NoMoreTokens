"""
GPU verification gate — runs a tiny CUDA regression fit and saves diagnostics.

Exit code 0 only if the XGBoost booster actually trained on a CUDA device.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import xgboost as xgb


def run_gpu_smoke_test(output_dir: str | Path) -> dict:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    diag: dict = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z")}

    # ── 1. Build info ──────────────────────────────────────────────
    build = xgb.build_info()
    diag["xgboost_version"] = xgb.__version__
    diag["build_info"] = {k: str(v) for k, v in build.items()}
    cuda_support = build.get("USE_CUDA", False)
    diag["cuda_support_in_build"] = bool(cuda_support)
    if not cuda_support:
        diag["error"] = "XGBoost wheel was NOT built with CUDA support."
        _save(diag, output_dir)
        return diag

    # ── 2. Small CUDA regression fit ──────────────────────────────
    rng = np.random.default_rng(42)
    X = rng.standard_normal((200, 4)).astype(np.float32)
    y = (X[:, 0] * 3.0 + X[:, 1] - X[:, 2] * 0.5 + rng.normal(0, 0.1, 200)).astype(np.float32)

    dtrain = xgb.DMatrix(X, label=y)

    params = {
        "objective": "reg:squarederror",
        "tree_method": "hist",
        "device": "cuda:0",
        "max_depth": 4,
        "eta": 0.3,
        "seed": 42,
    }

    try:
        t0 = time.perf_counter()
        bst = xgb.train(params, dtrain, num_boost_round=10)
        elapsed = time.perf_counter() - t0
        diag["training_time_s"] = round(elapsed, 4)
    except xgb.core.XGBoostError as exc:
        diag["error"] = f"CUDA training failed: {exc}"
        _save(diag, output_dir)
        return diag

    # ── 3. Verify effective device ────────────────────────────────
    config = json.loads(bst.save_config())
    effective_device = config["learner"]["generic_param"]["device"]
    diag["effective_device"] = effective_device

    if not effective_device.startswith("cuda"):
        diag["error"] = (
            f"Silent CPU fallback detected! effective_device={effective_device}. "
            "XGBoost did NOT use the GPU."
        )
        _save(diag, output_dir)
        return diag

    # ── 4. Quick prediction sanity ────────────────────────────────
    preds = bst.predict(dtrain)
    diag["sample_predictions"] = preds[:5].tolist()
    diag["prediction_finite"] = bool(np.all(np.isfinite(preds)))
    if not diag["prediction_finite"]:
        diag["error"] = "GPU smoke prediction produced a non-finite value."
        _save(diag, output_dir)
        return diag

    # ── 5. GPU name (via nvidia-smi fallback) ─────────────────────
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            diag["gpu_name"] = result.stdout.strip()
    except Exception:
        diag["gpu_name"] = "unknown (nvidia-smi unavailable)"

    diag["status"] = "PASSED"
    _save(diag, output_dir)
    return diag


def _save(diag: dict, output_dir: Path) -> None:
    path = output_dir / "gpu_diagnostics.json"
    path.write_text(json.dumps(diag, indent=2), encoding="utf-8")
    print(json.dumps(diag, indent=2))


if __name__ == "__main__":
    out = os.environ.get("ML_ARTIFACTS_DIR", str(Path(__file__).parent / "artifacts"))
    result = run_gpu_smoke_test(out)
    if result.get("status") != "PASSED":
        print(f"\n[FAIL] GPU SMOKE TEST FAILED: {result.get('error', 'unknown')}", file=sys.stderr)
        sys.exit(1)
    print("\n[PASS] GPU smoke test PASSED")
