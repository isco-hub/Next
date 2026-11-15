"""
Golden test cases GT-01 to GT-12 (SRS 10.1).
Each case specifies inputs and the expected first-season crop.
These must pass before any rule pack can be published.
"""
from __future__ import annotations

GOLDEN_CASES: list[dict] = [
    {
        "id": "GT-01",
        "scenario": "Maize after maize, loam soil, restore soil, normal moisture, Season A",
        "inputs": {
            "previous_crops": ["maize"],
            "soil_type": "loam",
            "goal": "restore_soil",
            "flags": [],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "soya",  # HR-01 blocks cereal; legume best for restore_soil
    },
    {
        "id": "GT-02",
        "scenario": "Striga flag, loam soil, max cash, normal moisture, Season A",
        "inputs": {
            "previous_crops": ["soya"],
            "soil_type": "loam",
            "goal": "max_cash",
            "flags": ["striga"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "groundnut",  # HR-02 blocks all cereals; groundnut top for max_cash
    },
    {
        "id": "GT-03",
        "scenario": "Dry moisture, loam soil, drought survival, Season A",
        "inputs": {
            "previous_crops": ["soya"],
            "soil_type": "loam",
            "goal": "drought_survival",
            "flags": [],
            "moisture_class": "dry",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "sorghum",  # HR-06 excludes maize; sorghum top for drought_survival
    },
    {
        "id": "GT-04",
        "scenario": "Wet moisture, loam soil, max cash, Season B",
        "inputs": {
            "previous_crops": ["maize"],
            "soil_type": "loam",
            "goal": "max_cash",
            "flags": [],
            "moisture_class": "wet",
            "season": "B",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "bean",  # HR-07 excludes simsim; bean best in Season B for max_cash
    },
    {
        "id": "GT-05",
        "scenario": "Cassava disease flag, loam soil, restore soil, Season A",
        "inputs": {
            "previous_crops": ["cassava"],
            "soil_type": "loam",
            "goal": "restore_soil",
            "flags": ["cassava_disease"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "soya",  # HR-03 blocks cassava; soya top for restore_soil
    },
    {
        "id": "GT-06",
        "scenario": "Sandy soil, restore soil, normal moisture, Season A",
        "inputs": {
            "previous_crops": ["sorghum"],
            "soil_type": "sandy",
            "goal": "restore_soil",
            "flags": [],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "soya",  # HR-05 blocks bean on sandy; soya top for restore_soil
    },
    {
        "id": "GT-07",
        "scenario": "Low fertility flag, loam soil, restore soil, Season A",
        "inputs": {
            "previous_crops": ["maize"],
            "soil_type": "loam",
            "goal": "restore_soil",
            "flags": ["low_fertility"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "soya",  # HR-01 blocks cereal; soya top for restore_soil
    },
    {
        "id": "GT-08",
        "scenario": "Groundnut disease flag, loam soil, max cash, Season A",
        "inputs": {
            "previous_crops": ["soya"],
            "soil_type": "loam",
            "goal": "max_cash",
            "flags": ["groundnut_disease"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "maize",  # HR-04 blocks groundnut; maize top for max_cash Season A
    },
    {
        "id": "GT-09",
        "scenario": "No previous crop (other), loam soil, max cash, Season A",
        "inputs": {
            "previous_crops": ["other"],
            "soil_type": "loam",
            "goal": "max_cash",
            "flags": [],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "maize",  # No HR-01 constraint; maize top for max_cash Season A
    },
    {
        "id": "GT-10",
        "scenario": "Armyworm flag, loam soil, max cash, Season A",
        "inputs": {
            "previous_crops": ["soya"],
            "soil_type": "loam",
            "goal": "max_cash",
            "flags": ["armyworm"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "groundnut",  # SR-01 reduces maize priority; groundnut next for max_cash
    },
    {
        "id": "GT-11",
        "scenario": "Season B, simsim best season, drought survival",
        "inputs": {
            "previous_crops": ["maize"],
            "soil_type": "loam",
            "goal": "drought_survival",
            "flags": [],
            "moisture_class": "normal",
            "season": "B",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "simsim",  # HR-01 blocks all cereals after maize; simsim best gate (best) + weight in Season B for drought_survival
    },
    {
        "id": "GT-12",
        "scenario": "All hard flags active, loam soil, restore soil, Season A",
        "inputs": {
            "previous_crops": ["maize"],
            "soil_type": "loam",
            "goal": "restore_soil",
            "flags": ["striga", "cassava_disease", "armyworm", "low_fertility"],
            "moisture_class": "normal",
            "season": "A",
            "seasons_requested": 4,
            "language": "en",
        },
        "expected_first_crop": "soya",  # HR-01 + HR-02 block cereals; soya top for restore_soil
    },
]

