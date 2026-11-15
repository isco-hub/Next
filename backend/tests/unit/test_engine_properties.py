"""
Property-based tests using Hypothesis (SRS 10.1, BE-206).
Thousands of random inputs verify:
- Plan is never empty (FR-ROT-08)
- No crop appears in consecutive seasons (HR-01 spirit)
- Hard rules are never violated
"""
from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain.rules.engine import EngineInputs, run_engine
from app.domain.rules.loader import load_published_pack

CROPS = ["maize", "sorghum", "finger_millet", "soya", "groundnut", "bean", "cowpea", "simsim", "sunflower", "cassava", "other"]
SOILS = ["sandy", "loam", "clay", "unknown"]
GOALS = ["restore_soil", "max_cash", "drought_survival"]
FLAGS = ["striga", "cassava_disease", "armyworm", "low_fertility", "groundnut_disease"]
MOISTURE = ["dry", "normal", "wet"]
SEASONS = ["A", "B"]


@pytest.fixture(scope="module")
def pack() -> dict:
    return load_published_pack()


@given(
    previous_crops=st.lists(st.sampled_from(CROPS), min_size=0, max_size=3),
    soil_type=st.sampled_from(SOILS),
    goal=st.sampled_from(GOALS),
    flags=st.lists(st.sampled_from(FLAGS), min_size=0, max_size=5, unique=True),
    moisture_class=st.sampled_from(MOISTURE),
    season=st.sampled_from(SEASONS),
    seasons_requested=st.integers(min_value=1, max_value=6),
)
@settings(max_examples=500, deadline=2000)
def test_plan_never_empty(
    previous_crops: list[str],
    soil_type: str,
    goal: str,
    flags: list[str],
    moisture_class: str,
    season: str,
    seasons_requested: int,
    pack: dict,
) -> None:
    inputs = EngineInputs(
        previous_crops=previous_crops or ["other"],
        soil_type=soil_type,
        goal=goal,
        flags=flags,
        moisture_class=moisture_class,
        season=season,
        seasons_requested=seasons_requested,
    )
    result = run_engine(inputs, pack)
    assert len(result.seasons) == seasons_requested, (
        f"Expected {seasons_requested} seasons, got {len(result.seasons)}"
    )


@given(
    previous_crops=st.lists(st.sampled_from(CROPS), min_size=0, max_size=2),
    soil_type=st.sampled_from(SOILS),
    goal=st.sampled_from(GOALS),
    flags=st.lists(st.sampled_from(FLAGS), min_size=0, max_size=3, unique=True),
    moisture_class=st.sampled_from(MOISTURE),
    season=st.sampled_from(SEASONS),
)
@settings(max_examples=500, deadline=2000)
def test_no_consecutive_same_crop(
    previous_crops: list[str],
    soil_type: str,
    goal: str,
    flags: list[str],
    moisture_class: str,
    season: str,
    pack: dict,
) -> None:
    inputs = EngineInputs(
        previous_crops=previous_crops or ["other"],
        soil_type=soil_type,
        goal=goal,
        flags=flags,
        moisture_class=moisture_class,
        season=season,
        seasons_requested=4,
    )
    result = run_engine(inputs, pack)
    crops = [s.crop for s in result.seasons if not s.locked]
    for i in range(len(crops) - 1):
        # Cassava is allowed to repeat (it's locked for 2 seasons)
        if crops[i] != "cassava":
            assert crops[i] != crops[i + 1], (
                f"Consecutive same crop '{crops[i]}' at seasons {i} and {i+1}"
            )


@given(
    soil_type=st.sampled_from(SOILS),
    goal=st.sampled_from(GOALS),
    flags=st.lists(st.sampled_from(FLAGS), min_size=0, max_size=5, unique=True),
    moisture_class=st.sampled_from(MOISTURE),
    season=st.sampled_from(SEASONS),
)
@settings(max_examples=500, deadline=2000)
def test_hard_rules_never_violated(
    soil_type: str,
    goal: str,
    flags: list[str],
    moisture_class: str,
    season: str,
    pack: dict,
) -> None:
    inputs = EngineInputs(
        previous_crops=["maize"],
        soil_type=soil_type,
        goal=goal,
        flags=flags,
        moisture_class=moisture_class,
        season=season,
        seasons_requested=4,
    )
    result = run_engine(inputs, pack)

    for s in result.seasons:
        if s.locked:
            continue
        crop = s.crop

        # HR-02: striga -> no cereals
        if "striga" in flags:
            assert crop not in ["maize", "sorghum", "finger_millet"], (
                f"HR-02 violated: {crop} chosen with striga flag"
            )

        # HR-03: cassava_disease -> no cassava
        if "cassava_disease" in flags:
            assert crop != "cassava", f"HR-03 violated: cassava chosen with cassava_disease flag"

        # HR-04: groundnut_disease -> no groundnut
        if "groundnut_disease" in flags:
            assert crop != "groundnut", f"HR-04 violated: groundnut chosen with groundnut_disease flag"

        # HR-06: dry -> no maize
        if moisture_class == "dry":
            assert crop != "maize", f"HR-06 violated: maize chosen in dry conditions"

        # HR-07: wet -> no simsim
        if moisture_class == "wet":
            assert crop != "simsim", f"HR-07 violated: simsim chosen in wet conditions"

