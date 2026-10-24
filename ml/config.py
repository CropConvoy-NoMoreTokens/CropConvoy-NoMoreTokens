"""
CropConvoy ML extension — shared configuration.

All crop assumptions, market multipliers, climate profiles and model
parameters live here so generators, trainers, the API and the frontend
catalog all draw from one place.
"""

from __future__ import annotations

GENERATOR_VERSION = "1.0.0"
DATA_SOURCE = "synthetic"
SEED = 42

# ── Produce catalog (price model) ──────────────────────────────────
PRODUCE = {
    "tomato":    {"label": "Tomato",    "ref_price_lkr_kg": 220},
    "potato":    {"label": "Potato",    "ref_price_lkr_kg": 240},
    "carrot":    {"label": "Carrot",    "ref_price_lkr_kg": 180},
    "banana":    {"label": "Banana",    "ref_price_lkr_kg": 160},
    "papaya":    {"label": "Papaya",    "ref_price_lkr_kg": 140},
    "pineapple": {"label": "Pineapple", "ref_price_lkr_kg": 220},
}

# ── Markets ────────────────────────────────────────────────────────
MARKETS = {
    "dambulla": {"label": "Dambulla", "multiplier": 1.00},
    "colombo":  {"label": "Colombo",  "multiplier": 1.06},
    "kandy":    {"label": "Kandy",    "multiplier": 1.03},
}

# ── Crops for planting recommendations ─────────────────────────────
CROPS = {
    "tomato": {
        "label": "Tomato",
        "duration_days": 90,
        "ref_yield_kg_ha": 25_000,
        "cost_lkr_ha": 1_800_000,
        "temp_min": 16, "temp_max": 32,
        "ph_min": 5.5, "ph_max": 7.5,
    },
    "potato": {
        "label": "Potato",
        "duration_days": 110,
        "ref_yield_kg_ha": 18_000,
        "cost_lkr_ha": 2_200_000,
        "temp_min": 10, "temp_max": 25,
        "ph_min": 5.0, "ph_max": 6.5,
    },
    "carrot": {
        "label": "Carrot",
        "duration_days": 90,
        "ref_yield_kg_ha": 30_000,
        "cost_lkr_ha": 1_600_000,
        "temp_min": 10, "temp_max": 28,
        "ph_min": 5.5, "ph_max": 7.5,
    },
}

# ── Climate profiles ──────────────────────────────────────────────
CLIMATE_PROFILES = {
    "warm_lowland": {
        "label": "Warm lowland",
        "temp_mean": 28, "temp_std": 2.0,
        "rainfall_mean": 180, "rainfall_std": 60,
    },
    "mild_midcountry": {
        "label": "Mild mid-country",
        "temp_mean": 24, "temp_std": 2.5,
        "rainfall_mean": 150, "rainfall_std": 50,
    },
    "cool_upland": {
        "label": "Cool upland",
        "temp_mean": 18, "temp_std": 3.0,
        "rainfall_mean": 120, "rainfall_std": 40,
    },
}

SOIL_TYPES = ["loam", "sandy_loam", "clay"]

# ── Financial defaults ─────────────────────────────────────────────
DEFAULT_AREA_HA = 1.0
DEFAULT_LOSS_RATE = 0.10
DEFAULT_MARKETING_TRANSPORT_LKR_KG = 15
STRESS_PRICE_DISCOUNT = 0.15
STRESS_YIELD_DISCOUNT = 0.20
ANNUAL_TREND = 0.04

# ── Model training parameters ─────────────────────────────────────
XGB_PARAMS = {
    "objective": "reg:squarederror",
    "eval_metric": "mae",
    "tree_method": "hist",
    "device": "cuda:0",
    "max_depth": 6,
    "max_bin": 128,
    "eta": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.9,
    "min_child_weight": 5,
    "lambda": 1.0,
    "seed": SEED,
    "nthread": 4,
}
XGB_PARAMS_REDUCED = {**XGB_PARAMS, "max_depth": 4, "max_bin": 64}
MAX_ROUNDS = 400
EARLY_STOPPING = 30

# ── Temporal splits ───────────────────────────────────────────────
TRAIN_END = "2023-12"
VAL_START = "2024-01"
VAL_END = "2024-12"
TEST_START = "2025-01"

# ── Seasonal phase offsets (month of peak price, per produce) ──────
SEASONAL_PHASES = {
    "tomato": 3,     # peak around March
    "potato": 7,     # peak around July
    "carrot": 5,     # peak around May
    "banana": 11,    # peak around November
    "papaya": 1,     # peak around January
    "pineapple": 6,  # peak around June
}
