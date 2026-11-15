"""
BE-602: Generate 50+ agronomic validation scenarios and export for panel review.
Covers the full input space: crops, soils, goals, flags, seasons, moisture classes.
Run: python scripts/agronomic_validation.py > validation_scenarios.csv
"""
from __future__ import annotations

import csv
import sys
from itertools import product

from app.domain.rules.engine import EngineInputs, run_engine
from app.domain.rules.loader import load_published_pack

SCENARIOS = [
    # (previous_crop, soil_type, goal, flags, moisture_class, season)
    ("maize",        "loam",    "restore_soil",    [],                    "normal", "A"),
    ("maize",        "loam",    "max_cash",        [],                    "normal", "A"),
    ("maize",        "loam",    "drought_survival", [],                   "dry",    "A"),
    ("maize",        "sandy",   "restore_soil",    [],                    "normal", "A"),
    ("maize",        "clay",    "max_cash",        [],                    "wet",    "A"),
    ("soya",         "loam",    "max_cash",        [],                    "normal", "A"),
    ("soya",         "loam",    "restore_soil",    [],                    "normal", "B"),
    ("sorghum",      "loam",    "drought_survival", [],                   "dry",    "A"),
    ("sorghum",      "sandy",   "drought_survival", [],                   "dry",    "B"),
    ("groundnut",    "loam",    "max_cash",        [],                    "normal", "A"),
    ("groundnut",    "loam",    "restore_soil",    [],                    "normal", "B"),
    ("cassava",      "loam",    "max_cash",        [],                    "normal", "A"),
    ("cassava",      "clay",    "restore_soil",    [],                    "wet",    "B"),
    ("bean",         "loam",    "restore_soil",    [],                    "normal", "B"),
    ("simsim",       "sandy",   "max_cash",        [],                    "normal", "B"),
    ("sunflower",    "loam",    "drought_survival", [],                   "dry",    "B"),
    ("cowpea",       "sandy",   "drought_survival", [],                   "dry",    "A"),
    ("finger_millet","loam",    "drought_survival", [],                   "dry",    "A"),
    ("other",        "loam",    "max_cash",        [],                    "normal", "A"),
    ("other",        "unknown", "restore_soil",    [],                    "normal", "A"),
    # With flags
    ("maize",        "loam",    "restore_soil",    ["striga"],            "normal", "A"),
    ("maize",        "loam",    "max_cash",        ["striga"],            "normal", "B"),
    ("soya",         "loam",    "max_cash",        ["armyworm"],          "normal", "A"),
    ("maize",        "loam",    "restore_soil",    ["low_fertility"],     "normal", "A"),
    ("groundnut",    "loam",    "max_cash",        ["groundnut_disease"], "normal", "A"),
    ("cassava",      "loam",    "restore_soil",    ["cassava_disease"],   "normal", "A"),
    ("maize",        "loam",    "restore_soil",    ["striga","armyworm"], "normal", "A"),
    ("soya",         "loam",    "restore_soil",    ["low_fertility"],     "normal", "B"),
    # Moisture extremes
    ("soya",         "loam",    "drought_survival", [],                   "dry",    "A"),
    ("maize",        "loam",    "max_cash",        [],                    "wet",    "A"),
    ("simsim",       "sandy",   "max_cash",        [],                    "wet",    "B"),
    ("sorghum",      "loam",    "drought_survival", [],                   "dry",    "B"),
    ("finger_millet","sandy",   "drought_survival", [],                   "dry",    "B"),
    ("cowpea",       "loam",    "drought_survival", [],                   "dry",    "B"),
    # Season B focus
    ("maize",        "loam",    "max_cash",        [],                    "normal", "B"),
    ("bean",         "clay",    "restore_soil",    [],                    "wet",    "B"),
    ("simsim",       "loam",    "max_cash",        [],                    "normal", "B"),
    ("groundnut",    "loam",    "max_cash",        [],                    "normal", "B"),
    # Sandy soil edge cases
    ("maize",        "sandy",   "max_cash",        [],                    "dry",    "A"),
    ("bean",         "sandy",   "restore_soil",    [],                    "normal", "A"),
    ("soya",         "sandy",   "restore_soil",    [],                    "normal", "A"),
    # Clay soil
    ("maize",        "clay",    "restore_soil",    [],                    "wet",    "A"),
    ("sorghum",      "clay",    "drought_survival", [],                   "normal", "A"),
    # Unknown soil
    ("maize",        "unknown", "max_cash",        [],                    "normal", "A"),
    ("soya",         "unknown", "restore_soil",    [],                    "normal", "A"),
    # Multi-flag
    ("maize",        "loam",    "restore_soil",    ["striga","low_fertility","armyworm"], "dry", "A"),
    ("soya",         "loam",    "max_cash",        ["armyworm","groundnut_disease"],      "normal", "A"),
    # All moisture × all goals for maize
    ("soya",         "loam",    "restore_soil",    [],                    "wet",    "A"),
    ("soya",         "loam",    "max_cash",        [],                    "dry",    "A"),
    ("soya",         "loam",    "drought_survival", [],                   "wet",    "A"),
    # Cassava block follow-on
    ("cassava",      "loam",    "restore_soil",    [],                    "normal", "B"),
]


def generate_validation_report() -> None:
    pack = load_published_pack()
    writer = csv.writer(sys.stdout)
    writer.writerow([
        "scenario_id", "previous_crop", "soil_type", "goal", "flags",
        "moisture_class", "season",
        "s1_crop", "s1_rationale", "s1_fallback",
        "s2_crop", "s3_crop", "s4_crop",
        "rule_ids_fired",
        "panel_rating",  # Unsafe / Acceptable / Good — filled by agronomist
        "panel_notes",
    ])

    for i, (prev_crop, soil, goal, flags, moisture, season) in enumerate(SCENARIOS, 1):
        inputs = EngineInputs(
            previous_crops=[prev_crop],
            soil_type=soil,
            goal=goal,
            flags=flags,
            moisture_class=moisture,
            season=season,
            seasons_requested=4,
            language="en",
        )
        result = run_engine(inputs, pack)
        seasons = result.seasons

        writer.writerow([
            f"SC-{i:03d}",
            prev_crop, soil, goal, "|".join(flags), moisture, season,
            seasons[0].crop if len(seasons) > 0 else "",
            seasons[0].rationale[:80] if len(seasons) > 0 else "",
            seasons[0].fallback if len(seasons) > 0 else "",
            seasons[1].crop if len(seasons) > 1 else "",
            seasons[2].crop if len(seasons) > 2 else "",
            seasons[3].crop if len(seasons) > 3 else "",
            "|".join(result.rule_ids_fired),
            "",  # panel_rating — blank for agronomist
            "",  # panel_notes — blank for agronomist
        ])


if __name__ == "__main__":
    generate_validation_report()

