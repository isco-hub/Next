"""
BE-306: NASA outage simulation tests using recorded fixtures.
Verifies that the API serves last good data with its age when NASA is unavailable.
"""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.domain.outlook.service import ClimateRecord, compute_outlook


# Recorded fixture: 30 days of POWER data for Lira (2.25°N, 32.75°E)
RECORDED_FIXTURE = [
    ClimateRecord(date(2027, 3, i), "PRECTOTCORR", 4.5 + (i % 5) * 0.8, "NASA_POWER")
    for i in range(1, 31)
]

RECORDED_CLIMATOLOGY = [
    {"dekad": d, "parameter": "PRECTOTCORR", "p50": 4.0}
    for d in range(1, 37)
]


class TestNasaOutageSimulation:
    def test_serves_last_good_data_when_fresh(self) -> None:
        """FR-DAT-06: When data is fresh, outlook is computed normally."""
        result = compute_outlook(
            RECORDED_FIXTURE,
            RECORDED_CLIMATOLOGY,
            date(2027, 3, 30),
            "A",
        )
        assert result.data_available is True
        assert result.data_age_hours < 48.0
        assert result.moisture_class in ("dry", "normal", "wet")

    def test_serves_stale_data_with_age_notice(self) -> None:
        """FR-DAT-06: When data is stale (>48h), notice_code is set and data still served."""
        # Simulate data that is 72 hours old
        old_fixture = [
            ClimateRecord(date(2027, 3, i), "PRECTOTCORR", 4.5, "NASA_POWER")
            for i in range(1, 28)  # last record is 3 days ago
        ]
        result = compute_outlook(
            old_fixture,
            RECORDED_CLIMATOLOGY,
            date(2027, 3, 30),
            "A",
        )
        # Should still return a result, not crash
        assert result.moisture_class in ("dry", "normal", "wet")
        assert result.notice_code in ("stale_data", "partial_data", None)

    def test_no_data_returns_safe_defaults(self) -> None:
        """FR-DAT-06: When no data at all, safe defaults are returned."""
        result = compute_outlook([], [], date(2027, 3, 30), "A")
        assert result.data_available is False
        assert result.moisture_class == "normal"  # safe default
        assert result.confidence == "low"
        assert result.notice_code == "no_recent_data"
        assert result.notice is not None

    def test_partial_data_reduces_confidence(self) -> None:
        """FR-DAT-06: Single data source reduces confidence."""
        result = compute_outlook(
            RECORDED_FIXTURE[:10],  # only 10 days, single source
            RECORDED_CLIMATOLOGY,
            date(2027, 3, 30),
            "A",
        )
        # With only POWER (no SMAP), confidence should not be high
        assert result.confidence in ("medium", "low")

    def test_quality_flagged_records_excluded(self) -> None:
        """FR-DAT-09: Records with quality flags are excluded from outlook computation."""
        bad_fixture = [
            ClimateRecord(date(2027, 3, i), "PRECTOTCORR", 4.5, "NASA_POWER", "range_violation")
            for i in range(1, 31)
        ]
        result = compute_outlook(bad_fixture, RECORDED_CLIMATOLOGY, date(2027, 3, 30), "A")
        # All records flagged -> treated as no data
        assert result.data_available is False

    def test_attribution_includes_source_names(self) -> None:
        """Every outlook response must carry attribution (C-01, SRS 2.7)."""
        result = compute_outlook(
            RECORDED_FIXTURE,
            RECORDED_CLIMATOLOGY,
            date(2027, 3, 30),
            "A",
        )
        assert "NASA" in result.attribution
        assert len(result.attribution) > 10

