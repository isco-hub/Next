"""Unit tests for outlook service, SMS segment counter, and security utilities."""
from __future__ import annotations

from datetime import date

import pytest

from app.channels.sms import count_segments, detect_encoding, handle_inbound_keyword
from app.core.security import hash_msisdn, is_ugandan_number
from app.domain.outlook.service import (
    ClimateRecord,
    _date_to_dekad,
    _detect_dry_spells,
    _detect_onset,
    compute_outlook,
)


# ── Outlook service ──────────────────────────────────────────────────────────

class TestDateToDekad:
    def test_jan_1(self) -> None:
        assert _date_to_dekad(date(2027, 1, 1)) == 1

    def test_jan_11(self) -> None:
        assert _date_to_dekad(date(2027, 1, 11)) == 2

    def test_dec_31(self) -> None:
        assert _date_to_dekad(date(2027, 12, 31)) == 36

    def test_mar_15(self) -> None:
        assert _date_to_dekad(date(2027, 3, 15)) == 8


class TestDetectOnset:
    def _rain(self, d: date, mm: float) -> ClimateRecord:
        return ClimateRecord(d, "PRECTOTCORR", mm, "NASA_POWER")

    def test_no_records_returns_unknown(self) -> None:
        status, onset = _detect_onset([], date(2027, 3, 20))
        assert status == "unknown"
        assert onset is None

    def test_no_onset_event(self) -> None:
        records = [self._rain(date(2027, 3, i), 5.0) for i in range(1, 20)]
        status, onset = _detect_onset(records, date(2027, 3, 20))
        assert status == "not_started"

    def test_onset_detected_after_21_days(self) -> None:
        records = [self._rain(date(2027, 3, 1), 25.0)]
        records += [self._rain(date(2027, 3, i), 5.0) for i in range(2, 25)]
        status, onset = _detect_onset(records, date(2027, 3, 25))
        assert status == "onset_detected"
        assert onset == date(2027, 3, 1)

    def test_false_start_risk(self) -> None:
        records = [self._rain(date(2027, 3, 1), 25.0)]
        # 8 dry days after onset
        records += [self._rain(date(2027, 3, i), 0.0) for i in range(2, 10)]
        status, onset = _detect_onset(records, date(2027, 3, 10))
        assert status == "false_start_risk"


class TestDetectDrySpells:
    def _rain(self, d: date, mm: float) -> ClimateRecord:
        return ClimateRecord(d, "PRECTOTCORR", mm, "NASA_POWER")

    def test_no_dry_spell(self) -> None:
        records = [self._rain(date(2027, 3, i), 5.0) for i in range(1, 30)]
        days, count = _detect_dry_spells(records, date(2027, 3, 30))
        assert days == 0
        assert count == 0

    def test_one_dry_spell(self) -> None:
        records = [self._rain(date(2027, 3, i), 0.0) for i in range(1, 10)]
        days, count = _detect_dry_spells(records, date(2027, 3, 10))
        assert days == 9
        assert count == 1


class TestComputeOutlook:
    def _rain(self, d: date, mm: float) -> ClimateRecord:
        return ClimateRecord(d, "PRECTOTCORR", mm, "NASA_POWER")

    def test_no_data_returns_safe_defaults(self) -> None:
        result = compute_outlook([], [], date(2027, 3, 20), "A")
        assert result.moisture_class == "normal"
        assert result.confidence == "low"
        assert not result.data_available

    def test_dry_classification(self) -> None:
        # Very low rainfall -> dry
        records = [self._rain(date(2027, 3, i), 0.5) for i in range(1, 31)]
        clim = [{"dekad": d, "parameter": "PRECTOTCORR", "p50": 5.0} for d in range(1, 37)]
        result = compute_outlook(records, clim, date(2027, 3, 31), "A")
        assert result.moisture_class == "dry"

    def test_wet_classification(self) -> None:
        records = [self._rain(date(2027, 3, i), 20.0) for i in range(1, 31)]
        clim = [{"dekad": d, "parameter": "PRECTOTCORR", "p50": 5.0} for d in range(1, 37)]
        result = compute_outlook(records, clim, date(2027, 3, 31), "A")
        assert result.moisture_class == "wet"


# ── SMS segment counter ───────────────────────────────────────────────────────

class TestSmsSegments:
    def test_short_gsm7_is_one_segment(self) -> None:
        enc, chars, segs = count_segments("Hello farmer!")
        assert enc == "GSM-7"
        assert segs == 1

    def test_long_gsm7_splits(self) -> None:
        text = "A" * 161
        enc, chars, segs = count_segments(text)
        assert enc == "GSM-7"
        assert segs == 2

    def test_lango_text_is_ucs2(self) -> None:
        enc, _, _ = count_segments("Wubone i NextCrop. Ŋat me pur.")
        assert enc == "UCS-2"

    def test_stop_keyword(self) -> None:
        assert handle_inbound_keyword("STOP") == "opt_out"
        assert handle_inbound_keyword("stop") == "opt_out"

    def test_yes_keyword(self) -> None:
        assert handle_inbound_keyword("YES") == "opt_in"

    def test_unknown_keyword(self) -> None:
        assert handle_inbound_keyword("HELLO") is None


# ── Security utilities ────────────────────────────────────────────────────────

class TestSecurity:
    def test_ugandan_number_valid(self) -> None:
        assert is_ugandan_number("+256772123456")
        assert is_ugandan_number("0772123456")

    def test_ugandan_number_invalid(self) -> None:
        assert not is_ugandan_number("+447911123456")
        assert not is_ugandan_number("12345")

    def test_msisdn_hash_deterministic(self, monkeypatch) -> None:
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        monkeypatch.setenv("MSISDN_PEPPER", "b" * 32)
        # Same number always produces same hash
        h1 = hash_msisdn("0772123456")
        h2 = hash_msisdn("0772123456")
        assert h1 == h2

    def test_msisdn_hash_normalises(self, monkeypatch) -> None:
        monkeypatch.setenv("SECRET_KEY", "a" * 32)
        monkeypatch.setenv("MSISDN_PEPPER", "b" * 32)
        h1 = hash_msisdn("0772123456")
        h2 = hash_msisdn("+256772123456")
        assert h1 == h2
