"""
Golden tests GT-01 to GT-12 (SRS 10.1).
These must all pass in CI and before any rule pack publish.
"""
import pytest

from app.domain.rules.engine import EngineInputs, run_engine
from app.domain.rules.loader import load_published_pack
from tests.golden.cases import GOLDEN_CASES


@pytest.fixture(scope="module")
def pack() -> dict:
    return load_published_pack()


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[c["id"] for c in GOLDEN_CASES])
def test_golden(case: dict, pack: dict) -> None:
    inputs = EngineInputs(**case["inputs"])
    result = run_engine(inputs, pack)

    assert result.seasons, f"{case['id']}: engine returned no seasons"
    actual = result.seasons[0].crop
    assert actual == case["expected_first_crop"], (
        f"{case['id']} FAILED: expected '{case['expected_first_crop']}', got '{actual}'\n"
        f"Scenario: {case['scenario']}\n"
        f"Rule IDs fired: {result.rule_ids_fired}"
    )


def test_all_golden_cases_covered() -> None:
    """Ensure we have at least 12 golden cases."""
    assert len(GOLDEN_CASES) >= 12
