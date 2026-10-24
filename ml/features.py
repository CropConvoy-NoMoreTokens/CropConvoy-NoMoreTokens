"""One feature contract for temporal training and inference."""
import math
import hashlib
import re
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
from .config import MARKETS, PRODUCE

FEATURE_VERSION = "2.0.0"
PRICE_FEATURE_COLUMNS = ["produce_enc", "market_enc", "horizon_months",
    "target_month_sin", "target_month_cos", "latest_price", "chg_1m",
    "chg_3m", "chg_6m", "chg_12m", "roll_mean_12", "roll_std_12", "prev_year_price"]

DATASET_HASH_FORMAT = "sha256-lf-v1"


def dataset_sha256(path):
    """Ignore only Windows line endings; retain all CSV values and formatting."""
    return hashlib.sha256(Path(path).read_bytes().replace(b"\r\n", b"\n")).hexdigest()

def colombo_today():
    return datetime.now(ZoneInfo("Asia/Colombo")).date()

def parse_month(value):
    if not re.fullmatch(r"[0-9]{4}-(0[1-9]|1[0-2])", value):
        raise ValueError("Use a month in YYYY-MM format.")
    return date(int(value[:4]), int(value[5:]), 1)

def add_months(value, offset):
    parsed = parse_month(value)
    year, month = divmod(parsed.year * 12 + parsed.month - 1 + offset, 12)
    return f"{year:04d}-{month + 1:02d}"

def month_distance(origin, target):
    a, b = parse_month(origin), parse_month(target)
    return (b.year - a.year) * 12 + b.month - a.month

def price_features(prices, months, target_month, origin_idx=None):
    """Observations after the forecast origin are never read."""
    prices = np.asarray(prices, dtype=float)
    months = list(months)
    origin = len(prices) - 1 if origin_idx is None else origin_idx
    if origin < 12:
        raise ValueError("At least 13 months of history are required.")
    horizon = month_distance(months[origin], target_month)
    if not 1 <= horizon <= 6:
        raise ValueError("Forecasts support one to six months after the data cutoff.")
    seasonal_idx = months[:origin + 1].index(add_months(target_month, -12))
    latest = float(prices[origin])
    window = prices[origin - 11:origin + 1]
    month = parse_month(target_month).month
    return {"horizon_months": horizon,
        "target_month_sin": math.sin(2 * math.pi * month / 12),
        "target_month_cos": math.cos(2 * math.pi * month / 12),
        "latest_price": latest,
        **{f"chg_{k}m": latest / float(prices[origin-k]) - 1 for k in (1,3,6,12)},
        "roll_mean_12": float(np.mean(window)), "roll_std_12": float(np.std(window)),
        "prev_year_price": float(prices[seasonal_idx])}

def validate_price_history(df, today=None):
    required = {"produce_id", "market_id", "month", "price_per_kg_minor"}
    if df.empty or not required.issubset(df.columns):
        raise ValueError("Price history is missing or has an invalid schema.")
    if df.duplicated(["produce_id", "market_id", "month"]).any():
        raise ValueError("Price history contains duplicate months.")
    values = pd.to_numeric(df["price_per_kg_minor"], errors="coerce").to_numpy()
    if not np.isfinite(values).all() or (values <= 0).any() or (values % 1 != 0).any():
        raise ValueError("Historical prices must be positive integer minor units.")
    for value in df.month:
        parse_month(value)
    if set(zip(df.produce_id, df.market_id)) != {(p,m) for p in PRODUCE for m in MARKETS}:
        raise ValueError("History must contain every supported produce and market.")
    cutoff = str(df.month.max())
    if cutoff > add_months((today or colombo_today()).strftime("%Y-%m"), -1):
        raise ValueError("History includes an unfinished or future month.")
    for _, group in df.groupby(["produce_id", "market_id"]):
        months = sorted(group.month.tolist())
        if len(months) < 13 or months[-1] != cutoff:
            raise ValueError("Every series needs 13 months and a consistent cutoff.")
        if any(month_distance(a,b) != 1 for a,b in zip(months,months[1:])):
            raise ValueError("History contains a missing month.")
    return cutoff
