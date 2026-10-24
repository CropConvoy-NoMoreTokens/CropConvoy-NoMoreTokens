"""
Dataset A — monthly wholesale market-price generator.

Produces reproducible synthetic observations from January 2016 through
the last *completed* month.  Never includes the current running month.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    ANNUAL_TREND,
    DATA_SOURCE,
    GENERATOR_VERSION,
    MARKETS,
    PRODUCE,
    SEASONAL_PHASES,
    SEED,
)


def _last_completed_month(today: date | None = None) -> tuple[int, int]:
    """Return (year, month) of the most recently completed calendar month."""
    today = today or date.today()
    if today.month == 1:
        return today.year - 1, 12
    return today.year, today.month - 1


def generate_price_data(
    start_year: int = 2016,
    start_month: int = 1,
    today: date | None = None,
    output_dir: str | Path | None = None,
) -> pd.DataFrame:
    """Generate Dataset A and optionally save to CSV."""

    end_year, end_month = _last_completed_month(today)
    rng = np.random.default_rng(SEED)

    rows: list[dict] = []
    # Pre-compute correlated noise (shared across items within a month)
    # Build month list first
    months_list: list[tuple[int, int]] = []
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        months_list.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1

    n_months = len(months_list)
    # Correlated monthly macro factor (AR(1) process)
    macro_noise = np.zeros(n_months)
    macro_noise[0] = rng.normal(0, 0.02)
    for i in range(1, n_months):
        macro_noise[i] = 0.7 * macro_noise[i - 1] + rng.normal(0, 0.02)

    for produce_id, produce_cfg in PRODUCE.items():
        ref_price = produce_cfg["ref_price_lkr_kg"]
        phase = SEASONAL_PHASES[produce_id]
        # Item-specific noise series
        item_noise = rng.normal(0, 0.03, n_months)

        for idx, (yr, mo) in enumerate(months_list):
            months_since_start = (yr - start_year) * 12 + (mo - start_month)
            # Trend
            trend = (1 + ANNUAL_TREND) ** (months_since_start / 12)
            # Seasonal — sinusoidal with produce-specific phase
            seasonal = 1.0 + 0.15 * math.sin(2 * math.pi * (mo - phase) / 12)
            # Supply shock ~4 % of months
            shock = 1.0
            if rng.random() < 0.04:
                shock = 1.0 + rng.choice([-1, 1]) * rng.uniform(0.15, 0.35)

            base_price = ref_price * trend * seasonal * shock
            base_price *= 1.0 + macro_noise[idx] + item_noise[idx]

            for market_id, market_cfg in MARKETS.items():
                price = base_price * market_cfg["multiplier"]
                # Small per-market jitter
                price *= 1.0 + rng.normal(0, 0.01)
                price = max(price, 1.0)  # safety floor
                rows.append(
                    {
                        "produce_id": produce_id,
                        "market_id": market_id,
                        "month": f"{yr:04d}-{mo:02d}",
                        "price_per_kg_minor": int(round(price * 100)),
                        "price_level": "wholesale",
                        "grade": "standard",
                        "data_source": DATA_SOURCE,
                        "generator_version": GENERATOR_VERSION,
                    }
                )

    df = pd.DataFrame(rows)
    df = df.sort_values(["produce_id", "market_id", "month"]).reset_index(drop=True)

    if output_dir is not None:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        path = out / "price_data.csv"
        df.to_csv(path, index=False)
        print(f"  📄 Wrote {len(df)} price observations → {path}")

    return df


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Dataset A (prices)")
    parser.add_argument("--output-dir", default=str(Path(__file__).parent / "data"))
    args = parser.parse_args()
    df = generate_price_data(output_dir=args.output_dir)
    print(f"\n  Summary: {len(df)} rows, "
          f"{df['produce_id'].nunique()} produce, "
          f"{df['market_id'].nunique()} markets, "
          f"{df['month'].nunique()} months")
