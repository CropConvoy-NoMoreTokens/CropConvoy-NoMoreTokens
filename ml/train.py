"""
CropConvoy ML — GPU model training pipeline.

Trains two XGBoost models sequentially on CUDA:
  1. Price forecasting (proportional change, multi-horizon direct model)
  2. Cultivation yield (kg/ha)

Uses temporal splits, early stopping on validation, and evaluates
against simple baselines.  Final serving models are refit through the
latest data using the selected round counts.
"""

from __future__ import annotations

import gc
import json
import math
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder

from .config import (
    CROPS,
    EARLY_STOPPING,
    MAX_ROUNDS,
    PRODUCE,
    SEED,
    TEST_START,
    TRAIN_END,
    VAL_END,
    VAL_START,
    XGB_PARAMS,
    XGB_PARAMS_REDUCED,
)

# ───────────────────────────────────────────────────────────────────
#  Price model feature engineering
# ───────────────────────────────────────────────────────────────────

def _price_features(df: pd.DataFrame) -> pd.DataFrame:
    """Use the exact same origin-only feature builder as API inference."""
    from .features import price_features
    rows = []
    for (pid, mid), group in df.groupby(["produce_id", "market_id"]):
        group = group.sort_values("month")
        prices = group.price_per_kg_minor.to_numpy() / 100.0
        months = group.month.tolist()
        for origin in range(12, len(prices)):
            for horizon in range(1, 7):
                target = origin + horizon
                if target >= len(prices):
                    break
                rows.append({"produce_id": pid, "market_id": mid,
                    "origin_month": months[origin], "target_month": months[target],
                    **price_features(prices, months, months[target], origin),
                    "target": prices[target] / prices[origin] - 1})
    return pd.DataFrame(rows)


# ───────────────────────────────────────────────────────────────────
#  Yield model feature engineering
# ───────────────────────────────────────────────────────────────────

def _yield_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["planting_month"] = pd.to_datetime(df["planting_date"]).dt.month
    df["planting_month_sin"] = np.sin(2 * np.pi * df["planting_month"] / 12)
    df["planting_month_cos"] = np.cos(2 * np.pi * df["planting_month"] / 12)
    df["irrigation_int"] = df["irrigation_available"].astype(int)
    return df


# ───────────────────────────────────────────────────────────────────
#  Training orchestration
# ───────────────────────────────────────────────────────────────────

def _require_cuda(model):
    device = json.loads(model.save_config())["learner"]["generic_param"]["device"]
    if not device.startswith("cuda"):
        raise RuntimeError("Training aborted: CPU fallback detected.")
    print(f"  Verified effective device: {device}", flush=True)


def train_all(
    price_df: pd.DataFrame,
    yield_df: pd.DataFrame,
    artifacts_dir: str | Path,
    verbose_eval: int = 10,
) -> dict:
    """Train both models sequentially on CUDA.  Returns evaluation report."""

    artifacts = Path(artifacts_dir)
    artifacts.mkdir(parents=True, exist_ok=True)

    report: dict = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "price_model": {},
        "yield_model": {},
    }

    # ── Price model ─────────────────────────────────────────────────
    print("\n══ Price model ══")
    price_feat = _price_features(price_df)
    print(f"  Feature rows: {len(price_feat)}")

    # Encode categoricals
    produce_enc = LabelEncoder().fit(list(PRODUCE.keys()))
    market_enc = LabelEncoder().fit(price_feat["market_id"].unique())

    price_feat["produce_enc"] = produce_enc.transform(price_feat["produce_id"])
    price_feat["market_enc"] = market_enc.transform(price_feat["market_id"])

    feature_cols_price = [
        "produce_enc", "market_enc", "horizon_months",
        "target_month_sin", "target_month_cos",
        "latest_price", "chg_1m", "chg_3m", "chg_6m", "chg_12m",
        "roll_mean_12", "roll_std_12", "prev_year_price",
    ]

    # Temporal split (based on target_month)
    train_mask = price_feat["target_month"] <= TRAIN_END
    val_mask = (price_feat["target_month"] >= VAL_START) & (price_feat["target_month"] <= VAL_END)
    test_mask = price_feat["target_month"] >= TEST_START

    X_train = price_feat.loc[train_mask, feature_cols_price].values.astype(np.float32)
    y_train = price_feat.loc[train_mask, "target"].values.astype(np.float32)
    X_val = price_feat.loc[val_mask, feature_cols_price].values.astype(np.float32)
    y_val = price_feat.loc[val_mask, "target"].values.astype(np.float32)
    X_test = price_feat.loc[test_mask, feature_cols_price].values.astype(np.float32)
    y_test = price_feat.loc[test_mask, "target"].values.astype(np.float32)

    print(f"  Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    params = dict(XGB_PARAMS)
    max_bin = params["max_bin"]
    dtrain_price = xgb.QuantileDMatrix(X_train, label=y_train, max_bin=max_bin)
    dval_price = xgb.QuantileDMatrix(X_val, label=y_val, ref=dtrain_price, max_bin=max_bin)

    try:
        bst_price = xgb.train(
            params, dtrain_price,
            num_boost_round=MAX_ROUNDS,
            evals=[(dtrain_price, "train"), (dval_price, "val")],
            early_stopping_rounds=EARLY_STOPPING,
            verbose_eval=verbose_eval,
        )
    except xgb.core.XGBoostError as exc:
        if not any(word in str(exc).lower() for word in ("out of memory", "bad allocation", "bad_alloc")):
            raise
        print("  [WARN] OOM -- retrying with reduced params")
        params = dict(XGB_PARAMS_REDUCED)
        report["price_model"]["reduced_params"] = True
        max_bin = params["max_bin"]
        del dtrain_price, dval_price
        gc.collect()
        dtrain_price = xgb.QuantileDMatrix(X_train, label=y_train, max_bin=max_bin)
        dval_price = xgb.QuantileDMatrix(X_val, label=y_val, ref=dtrain_price, max_bin=max_bin)
        bst_price = xgb.train(
            params, dtrain_price,
            num_boost_round=MAX_ROUNDS,
            evals=[(dtrain_price, "train"), (dval_price, "val")],
            early_stopping_rounds=EARLY_STOPPING,
            verbose_eval=verbose_eval,
        )

    _require_cuda(bst_price)
    best_round_price = bst_price.best_iteration
    print(f"  Best round: {best_round_price}")

    # ── Price evaluation ──────────────────────────────────────────
    dtest_price = xgb.DMatrix(X_test)
    pred_change_test = bst_price.predict(dtest_price, iteration_range=(0, best_round_price + 1))

    test_rows = price_feat.loc[test_mask].copy()
    test_rows["pred_change"] = pred_change_test
    test_rows["pred_price"] = test_rows["latest_price"] * (1 + test_rows["pred_change"])
    test_rows["actual_price"] = test_rows["latest_price"] * (1 + test_rows["target"])

    # Baselines
    test_rows["naive_price"] = test_rows["latest_price"]
    test_rows["prev_year_baseline"] = test_rows["prev_year_price"]

    def _price_metrics(actual: np.ndarray, predicted: np.ndarray, prefix: str) -> dict:
        errors = actual - predicted
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        wape = float(np.sum(np.abs(errors)) / np.sum(np.abs(actual))) * 100 if np.sum(np.abs(actual)) > 0 else 0
        return {f"{prefix}_mae_lkr": round(mae, 2), f"{prefix}_rmse": round(rmse, 2), f"{prefix}_wape_pct": round(wape, 2)}

    actual_arr = test_rows["actual_price"].values
    report["price_model"]["test_overall"] = _price_metrics(actual_arr, test_rows["pred_price"].values, "model")
    report["price_model"]["test_overall"].update(_price_metrics(actual_arr, test_rows["naive_price"].values, "naive"))
    report["price_model"]["test_overall"].update(_price_metrics(actual_arr, test_rows["prev_year_baseline"].values, "prev_year"))

    # By crop
    by_crop: dict = {}
    for pid in test_rows["produce_id"].unique():
        mask = test_rows["produce_id"] == pid
        by_crop[pid] = _price_metrics(
            test_rows.loc[mask, "actual_price"].values,
            test_rows.loc[mask, "pred_price"].values,
            "model",
        )
    report["price_model"]["test_by_crop"] = by_crop

    # By horizon
    by_horizon: dict = {}
    for h in range(1, 7):
        mask = test_rows["horizon_months"] == h
        if mask.sum() > 0:
            by_horizon[str(h)] = _price_metrics(
                test_rows.loc[mask, "actual_price"].values,
                test_rows.loc[mask, "pred_price"].values,
                "model",
            )
    report["price_model"]["test_by_horizon"] = by_horizon
    report["price_model"]["best_round"] = best_round_price
    report["price_model"]["params_used"] = params

    # Save eval model's effective device
    cfg = json.loads(bst_price.save_config())
    report["price_model"]["effective_device"] = cfg["learner"]["generic_param"]["device"]

    # Release evaluation DMatrices
    del dtest_price, dtrain_price, dval_price
    gc.collect()

    # ── Refit price model on all data through latest month ────────
    print("  Refitting price model on full data...")
    full_mask = price_feat["target_month"] <= price_feat["target_month"].max()
    X_full = price_feat.loc[full_mask, feature_cols_price].values.astype(np.float32)
    y_full = price_feat.loc[full_mask, "target"].values.astype(np.float32)
    dfull_price = xgb.QuantileDMatrix(X_full, label=y_full, max_bin=max_bin)
    bst_price_final = xgb.train(params, dfull_price, num_boost_round=best_round_price + 1, verbose_eval=0)
    _require_cuda(bst_price_final)
    bst_price_final.save_model(str(artifacts / "price_model.ubj"))
    print(f"  Saved price_model.ubj (rounds={best_round_price + 1})")

    del dfull_price, bst_price, X_full, y_full
    gc.collect()

    # Save encoders
    joblib.dump(
        {
            "produce_encoder": produce_enc,
            "market_encoder": market_enc,
            "feature_cols": feature_cols_price,
        },
        artifacts / "price_preprocessors.pkl",
    )

    # ════════════════════════════════════════════════════════════════
    # ── Yield model ────────────────────────────────────────────────
    # ════════════════════════════════════════════════════════════════
    print("\n══ Yield model ══")
    yield_feat = _yield_features(yield_df)

    crop_enc = LabelEncoder().fit(list(CROPS.keys()))
    region_enc = LabelEncoder().fit(yield_feat["region_profile"].unique())
    soil_enc = LabelEncoder().fit(yield_feat["soil_type"].unique())

    yield_feat["crop_enc"] = crop_enc.transform(yield_feat["crop_id"])
    yield_feat["region_enc"] = region_enc.transform(yield_feat["region_profile"])
    yield_feat["soil_enc"] = soil_enc.transform(yield_feat["soil_type"])

    feature_cols_yield = [
        "crop_enc", "region_enc", "planting_month_sin", "planting_month_cos",
        "soil_enc", "soil_ph", "irrigation_int",
        "expected_temperature_c", "expected_rainfall_mm_month",
    ]

    # Temporal split: harvest date determines when the label is known
    yield_feat["harvest_dt"] = pd.to_datetime(yield_feat["harvest_date"])
    yield_train = yield_feat[yield_feat["harvest_dt"] <= pd.Timestamp(TRAIN_END + "-31")]
    yield_val = yield_feat[
        (yield_feat["harvest_dt"] >= pd.Timestamp(VAL_START + "-01"))
        & (yield_feat["harvest_dt"] <= pd.Timestamp(VAL_END + "-31"))
    ]
    yield_test = yield_feat[yield_feat["harvest_dt"] >= pd.Timestamp(TEST_START + "-01")]

    X_train_y = yield_train[feature_cols_yield].values.astype(np.float32)
    y_train_y = yield_train["yield_kg_per_ha"].values.astype(np.float32)
    X_val_y = yield_val[feature_cols_yield].values.astype(np.float32)
    y_val_y = yield_val["yield_kg_per_ha"].values.astype(np.float32)
    X_test_y = yield_test[feature_cols_yield].values.astype(np.float32)
    y_test_y = yield_test["yield_kg_per_ha"].values.astype(np.float32)

    print(f"  Train: {len(X_train_y)}, Val: {len(X_val_y)}, Test: {len(X_test_y)}")

    params_y = dict(XGB_PARAMS)
    max_bin_y = params_y["max_bin"]
    dtrain_yield = xgb.QuantileDMatrix(X_train_y, label=y_train_y, max_bin=max_bin_y)
    dval_yield = xgb.QuantileDMatrix(X_val_y, label=y_val_y, ref=dtrain_yield, max_bin=max_bin_y)

    try:
        bst_yield = xgb.train(
            params_y, dtrain_yield,
            num_boost_round=MAX_ROUNDS,
            evals=[(dtrain_yield, "train"), (dval_yield, "val")],
            early_stopping_rounds=EARLY_STOPPING,
            verbose_eval=verbose_eval,
        )
    except xgb.core.XGBoostError as exc:
        if not any(word in str(exc).lower() for word in ("out of memory", "bad allocation", "bad_alloc")):
            raise
        print("  [WARN] OOM -- retrying with reduced params")
        params_y = dict(XGB_PARAMS_REDUCED)
        report["yield_model"]["reduced_params"] = True
        max_bin_y = params_y["max_bin"]
        del dtrain_yield, dval_yield
        gc.collect()
        dtrain_yield = xgb.QuantileDMatrix(X_train_y, label=y_train_y, max_bin=max_bin_y)
        dval_yield = xgb.QuantileDMatrix(X_val_y, label=y_val_y, ref=dtrain_yield, max_bin=max_bin_y)
        bst_yield = xgb.train(
            params_y, dtrain_yield,
            num_boost_round=MAX_ROUNDS,
            evals=[(dtrain_yield, "train"), (dval_yield, "val")],
            early_stopping_rounds=EARLY_STOPPING,
            verbose_eval=verbose_eval,
        )

    _require_cuda(bst_yield)
    best_round_yield = bst_yield.best_iteration
    print(f"  Best round: {best_round_yield}")

    # ── Yield evaluation ──────────────────────────────────────────
    dtest_yield = xgb.DMatrix(X_test_y)
    pred_yield_test = bst_yield.predict(dtest_yield, iteration_range=(0, best_round_yield + 1))
    pred_yield_test = np.maximum(pred_yield_test, 0)

    errors_y = y_test_y - pred_yield_test
    report["yield_model"]["test_mae_kg_ha"] = round(float(np.mean(np.abs(errors_y))), 1)
    report["yield_model"]["test_rmse"] = round(float(np.sqrt(np.mean(errors_y ** 2))), 1)

    # Baseline: crop/region median
    medians = yield_train.groupby(["crop_id", "region_profile"])["yield_kg_per_ha"].median()
    baseline_preds = yield_test.apply(
        lambda r: medians.get((r["crop_id"], r["region_profile"]), y_train_y.mean()), axis=1
    ).values
    baseline_errors = y_test_y - baseline_preds
    report["yield_model"]["baseline_mae_kg_ha"] = round(float(np.mean(np.abs(baseline_errors))), 1)
    report["yield_model"]["baseline_rmse"] = round(float(np.sqrt(np.mean(baseline_errors ** 2))), 1)

    report["yield_model"]["best_round"] = best_round_yield
    report["yield_model"]["params_used"] = params_y

    cfg_y = json.loads(bst_yield.save_config())
    report["yield_model"]["effective_device"] = cfg_y["learner"]["generic_param"]["device"]

    del dtest_yield, dtrain_yield, dval_yield
    gc.collect()

    # ── Refit yield model on full data ────────────────────────────
    print("  Refitting yield model on full data...")
    X_all_y = yield_feat[feature_cols_yield].values.astype(np.float32)
    y_all_y = yield_feat["yield_kg_per_ha"].values.astype(np.float32)
    dall_yield = xgb.QuantileDMatrix(X_all_y, label=y_all_y, max_bin=max_bin_y)
    bst_yield_final = xgb.train(params_y, dall_yield, num_boost_round=best_round_yield + 1, verbose_eval=0)
    _require_cuda(bst_yield_final)
    bst_yield_final.save_model(str(artifacts / "yield_model.ubj"))
    print(f"  Saved yield_model.ubj (rounds={best_round_yield + 1})")

    del dall_yield, bst_yield, X_all_y, y_all_y
    gc.collect()

    joblib.dump(
        {
            "crop_encoder": crop_enc,
            "region_encoder": region_enc,
            "soil_encoder": soil_enc,
            "feature_cols": feature_cols_yield,
        },
        artifacts / "yield_preprocessors.pkl",
    )

    # ── Save full report ──────────────────────────────────────────
    report_path = artifacts / "evaluation_report.json"
    report["data_cutoff"] = str(price_df.month.max())
    report["price_rows"] = len(price_df)
    report["yield_rows"] = len(yield_df)
    report["price_test_start"] = TEST_START
    report["yield_test_end"] = str(yield_df.harvest_date.max())
    report_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"\n  [REPORT] Evaluation report -> {report_path}")

    return report


if __name__ == "__main__":
    from .run_all import main
    main()
