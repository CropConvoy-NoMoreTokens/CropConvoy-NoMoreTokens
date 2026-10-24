"""
Dataset B — synthetic cultivation cycle generator.

Produces 10 000 completed growing cycles with planting conditions that
are knowable at decision time (no post-planting weather leak).
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    CLIMATE_PROFILES,
    CROPS,
    DATA_SOURCE,
    GENERATOR_VERSION,
    SEED,
    SOIL_TYPES,
)

N_CYCLES = 10_000


def generate_yield_data(
    n: int = N_CYCLES,
    output_dir: str | Path | None = None,
) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)

    crop_ids = list(CROPS.keys())
    region_ids = list(CLIMATE_PROFILES.keys())

    rows: list[dict] = []
    for i in range(n):
        crop_id = rng.choice(crop_ids)
        region_id = rng.choice(region_ids)
        crop = CROPS[crop_id]
        climate = CLIMATE_PROFILES[region_id]

        # Random planting date 2016-2025
        planting_date = date(2016, 1, 1) + timedelta(days=int(rng.integers(0, 3650)))
        harvest_date = planting_date + timedelta(days=crop["duration_days"])

        # Soil
        soil_type = rng.choice(SOIL_TYPES)
        soil_ph = round(float(rng.uniform(4.5, 8.0)), 1)

        # Irrigation
        irrigation = bool(rng.random() > 0.3)

        # Expected growing-window conditions (known at planting)
        exp_temp = round(float(rng.normal(climate["temp_mean"], climate["temp_std"])), 1)
        exp_rainfall = round(
            max(0.0, float(rng.normal(climate["rainfall_mean"], climate["rainfall_std"]))),
            1,
        )

        # ── Yield simulation ──────────────────────────────────────
        ref_yield = crop["ref_yield_kg_ha"]
        factor = 1.0

        # Temperature suitability
        if exp_temp < crop["temp_min"] or exp_temp > crop["temp_max"]:
            # Outside optimal range → significant penalty
            deviation = max(crop["temp_min"] - exp_temp, exp_temp - crop["temp_max"])
            factor *= max(0.0, 1.0 - 0.08 * deviation)

        # Soil pH suitability
        if soil_ph < crop["ph_min"] or soil_ph > crop["ph_max"]:
            deviation = max(crop["ph_min"] - soil_ph, soil_ph - crop["ph_max"])
            factor *= max(0.0, 1.0 - 0.12 * deviation)

        # Soil type penalty
        if soil_type == "clay":
            factor *= 0.70  # heavy clay — significant yield reduction
        elif soil_type == "sandy_loam":
            factor *= 0.92

        # Irrigation benefit
        if not irrigation:
            # Rain-fed: scale by rainfall relative to a reasonable requirement
            water_ratio = min(1.0, exp_rainfall / 140)
            factor *= 0.6 + 0.4 * water_ratio

        # Seasonal factor (planting month)
        month_factor = 0.9 + 0.1 * np.sin(2 * np.pi * (planting_date.month - 3) / 12)
        factor *= month_factor

        # Random variation (weather shocks, pests, etc. — realized, not input)
        noise = float(rng.normal(1.0, 0.10))
        yield_kg = max(0.0, ref_yield * factor * noise)

        rows.append(
            {
                "cycle_id": f"CYC-{i:05d}",
                "crop_id": crop_id,
                "region_profile": region_id,
                "planting_date": planting_date.isoformat(),
                "harvest_date": harvest_date.isoformat(),
                "soil_type": soil_type,
                "soil_ph": soil_ph,
                "irrigation_available": irrigation,
                "expected_temperature_c": exp_temp,
                "expected_rainfall_mm_month": exp_rainfall,
                "yield_kg_per_ha": round(yield_kg, 1),
                "data_source": DATA_SOURCE,
                "generator_version": GENERATOR_VERSION,
            }
        )

    df = pd.DataFrame(rows)

    if output_dir is not None:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        path = out / "yield_data.csv"
        df.to_csv(path, index=False)
        print(f"  📄 Wrote {len(df)} cultivation cycles → {path}")

    return df


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Dataset B (yields)")
    parser.add_argument("--output-dir", default=str(Path(__file__).parent / "data"))
    args = parser.parse_args()
    df = generate_yield_data(output_dir=args.output_dir)
    print(f"\n  Summary: {len(df)} cycles, "
          f"{df['crop_id'].nunique()} crops, "
          f"{df['region_profile'].nunique()} regions")
