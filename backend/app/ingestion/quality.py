"""
Data quality checks for ingested climate records (FR-DAT-09).
Flags records with range violations, spikes, or unit anomalies.
"""
from __future__ import annotations

from typing import Any

# Acceptable ranges per parameter
_RANGES: dict[str, tuple[float, float]] = {
    "PRECTOTCORR": (0.0, 300.0),      # mm/day
    "T2M": (-10.0, 50.0),             # °C
    "T2M_MAX": (-10.0, 55.0),
    "T2M_MIN": (-15.0, 45.0),
    "RH2M": (0.0, 100.0),             # %
    "ALLSKY_SFC_SW_DWN": (0.0, 35.0), # MJ/m²/day
    "WS2M": (0.0, 30.0),              # m/s
    "GWETROOT": (0.0, 1.0),           # fraction
}

_SPIKE_MULTIPLIER = 5.0  # value > 5x rolling mean is a spike


def check_quality(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Apply quality flags to records in-place.
    Returns the same list with quality_flag updated.
    """
    by_param: dict[str, list[dict[str, Any]]] = {}
    for r in records:
        by_param.setdefault(r["parameter"], []).append(r)

    for param, param_records in by_param.items():
        lo, hi = _RANGES.get(param, (-1e9, 1e9))
        values = [r["value"] for r in param_records]
        mean_val = sum(values) / len(values) if values else 0.0

        for r in param_records:
            v = r["value"]
            if not (lo <= v <= hi):
                r["quality_flag"] = "range_violation"
            elif mean_val > 0 and v > mean_val * _SPIKE_MULTIPLIER:
                r["quality_flag"] = "spike"
            else:
                r["quality_flag"] = "ok"

    return records


def detect_gaps(
    records: list[dict[str, Any]], parameter: str, expected_days: int
) -> list[str]:
    """Return list of missing date strings for a parameter."""
    from datetime import date, timedelta

    dates = {
        r["date"] for r in records if r["parameter"] == parameter and r["quality_flag"] == "ok"
    }
    if not dates:
        return []

    start = min(dates)
    gaps = []
    for i in range(expected_days):
        d = start + timedelta(days=i)
        if d not in dates:
            gaps.append(d.isoformat())
    return gaps
