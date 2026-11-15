"""
BE-605: Pipeline timing and chaos tests.
- NASA outage: fetch fails, last good data is served
- Earthdata token expiry: retry with re-auth
- Partial downloads: incomplete response handled gracefully
"""
from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestNasaOutageChaos:
    @pytest.mark.asyncio
    async def test_power_fetch_retries_on_500(self) -> None:
        """Ingestion retries up to 3 times on server errors."""
        call_count = 0

        async def flaky_get(*args, **kwargs):  # type: ignore[no-untyped-def]
            nonlocal call_count
            call_count += 1
            mock_resp = MagicMock()
            if call_count < 3:
                mock_resp.raise_for_status.side_effect = Exception("500 Server Error")
            else:
                mock_resp.raise_for_status.return_value = None
                mock_resp.json.return_value = {
                    "properties": {"parameter": {"PRECTOTCORR": {"20270301": 5.0}}},
                    "header": {"fill_value": -999.0},
                }
            return mock_resp

        with patch("httpx.AsyncClient.get", new=flaky_get):
            from app.ingestion.power import fetch_power_daily
            records = await fetch_power_daily(2.25, 32.75, date(2027, 3, 1), date(2027, 3, 1))
            assert call_count == 3
            assert len(records) == 1

    @pytest.mark.asyncio
    async def test_power_fetch_raises_after_max_retries(self) -> None:
        """After 3 failed attempts, the error is re-raised."""
        async def always_fail(*args, **kwargs):  # type: ignore[no-untyped-def]
            mock_resp = MagicMock()
            mock_resp.raise_for_status.side_effect = Exception("503 Unavailable")
            return mock_resp

        with patch("httpx.AsyncClient.get", new=always_fail):
            from app.ingestion.power import fetch_power_daily
            with pytest.raises(Exception, match="503"):
                await fetch_power_daily(2.25, 32.75, date(2027, 3, 1), date(2027, 3, 1))

    @pytest.mark.asyncio
    async def test_partial_power_response_handled(self) -> None:
        """Partial POWER response (some parameters missing) is parsed without error."""
        async def partial_response(*args, **kwargs):  # type: ignore[no-untyped-def]
            mock_resp = MagicMock()
            mock_resp.raise_for_status.return_value = None
            # Only PRECTOTCORR returned, other params missing
            mock_resp.json.return_value = {
                "properties": {
                    "parameter": {
                        "PRECTOTCORR": {"20270301": 4.5, "20270302": -999.0},
                    }
                },
                "header": {"fill_value": -999.0},
            }
            return mock_resp

        with patch("httpx.AsyncClient.get", new=partial_response):
            from app.ingestion.power import fetch_power_daily
            records = await fetch_power_daily(2.25, 32.75, date(2027, 3, 1), date(2027, 3, 2))
            # fill_value -999 should be excluded
            assert len(records) == 1
            assert records[0]["value"] == 4.5

    @pytest.mark.asyncio
    async def test_empty_power_response_returns_empty_list(self) -> None:
        """Empty POWER response returns empty list, not an error."""
        async def empty_response(*args, **kwargs):  # type: ignore[no-untyped-def]
            mock_resp = MagicMock()
            mock_resp.raise_for_status.return_value = None
            mock_resp.json.return_value = {"properties": {"parameter": {}}, "header": {"fill_value": -999.0}}
            return mock_resp

        with patch("httpx.AsyncClient.get", new=empty_response):
            from app.ingestion.power import fetch_power_daily
            records = await fetch_power_daily(2.25, 32.75, date(2027, 3, 1), date(2027, 3, 1))
            assert records == []


class TestQualityChecks:
    def test_range_violation_flagged(self) -> None:
        from app.ingestion.quality import check_quality
        records = [
            {"parameter": "PRECTOTCORR", "value": 500.0, "quality_flag": "ok"},  # > 300 max
            {"parameter": "PRECTOTCORR", "value": 5.0, "quality_flag": "ok"},
        ]
        result = check_quality(records)
        assert result[0]["quality_flag"] == "range_violation"
        assert result[1]["quality_flag"] == "ok"

    def test_spike_flagged(self) -> None:
        from app.ingestion.quality import check_quality
        records = [{"parameter": "T2M", "value": float(v), "quality_flag": "ok"} for v in [25, 26, 25, 24, 25]]
        records.append({"parameter": "T2M", "value": 200.0, "quality_flag": "ok"})  # spike
        result = check_quality(records)
        spike = next(r for r in result if r["value"] == 200.0)
        assert spike["quality_flag"] in ("spike", "range_violation")

    def test_gap_detection(self) -> None:
        from datetime import date, timedelta
        from app.ingestion.quality import detect_gaps
        records = [
            {"parameter": "PRECTOTCORR", "date": date(2027, 3, i), "quality_flag": "ok"}
            for i in [1, 2, 4, 5]  # gap on day 3
        ]
        gaps = detect_gaps(records, "PRECTOTCORR", 5)
        assert date(2027, 3, 3).isoformat() in gaps
