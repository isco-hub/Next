"""
Outlook engine: computes moisture class, season onset, dry-spell indicators
and confidence from climate_daily records. Pure computation, no I/O.
Implements ADR-06 fallback chain: SMAP -> POWER root-zone -> climatology.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any


@dataclass
class ClimateRecord:
    date: date
    parameter: str
    value: float
    source: str
    quality_flag: str = "ok"


@dataclass
class OutlookComputation:
    season: str
    moisture_class: str  # dry | normal | wet
    onset_status: str  # not_started | onset_candidate | onset_detected | false_start_risk | unknown
    onset_date: date | None
    dry_spell_days: int
    dry_spells_count: int
    confidence: str  # high | medium | low
    data_age_hours: float
    data_available: bool
    data_sources: list[str]
    rainfall_30d: list[dict[str, Any]]
    rainfall_actual_total: float
    rainfall_normal_total: float
    notice_code: str | None
    notice: str | None
    attribution: str


_ONSET_THRESHOLD_MM = 20.0
_ONSET_CONFIRMATION_DAYS = 21
_DRY_SPELL_DAYS = 7  # consecutive days < 1mm = dry spell
_DRY_THRESHOLD_MM = 1.0
_STALE_HOURS = 48.0

# Percentile thresholds for moisture classification
_DRY_PERCENTILE = 30.0
_WET_PERCENTILE = 70.0


def compute_outlook(
    records: list[ClimateRecord],
    climatology: list[dict[str, Any]],  # [{dekad, parameter, p10, p25, p50, p75, p90}]
    reference_date: date,
    season: str,
) -> OutlookComputation:
    """
    Compute the outlook from available records.
    Falls back gracefully when data is missing (ADR-06, FR-DAT-06).
    """
    if not records:
        return _no_data_outlook(season, reference_date)

    # Filter to good-quality records only
    good = [r for r in records if r.quality_flag == "ok"]
    if not good:
        return _no_data_outlook(season, reference_date)

    # Determine data age
    latest_date = max(r.date for r in good)
    data_age_hours = (reference_date - latest_date).total_seconds() / 3600
    data_available = data_age_hours < _STALE_HOURS * 2

    # Collect data sources
    sources = list({r.source for r in good})

    # Rainfall records (last 30 days)
    rain_records = [
        r for r in good
        if r.parameter in ("PRECTOTCORR", "precipitation", "imerg_precip")
        and (reference_date - r.date).days <= 30
    ]
    rain_records.sort(key=lambda r: r.date)

    # Build 30-day rainfall series
    rainfall_30d = _build_rainfall_series(rain_records, climatology, reference_date)
    actual_total = sum(p["actual_mm"] for p in rainfall_30d)
    normal_total = sum(p["normal_mm"] for p in rainfall_30d)

    # Moisture classification via percentile comparison
    moisture_class, confidence = _classify_moisture(
        actual_total, normal_total, climatology, reference_date, sources
    )

    # Season onset detection (G-01: provisional states)
    onset_status, onset_date = _detect_onset(rain_records, reference_date)

    # Dry spell detection
    dry_spell_days, dry_spells_count = _detect_dry_spells(rain_records, reference_date)

    # Notice
    notice_code, notice = _build_notice(data_age_hours, sources, data_available)

    attribution = _build_attribution(sources)

    return OutlookComputation(
        season=season,
        moisture_class=moisture_class,
        onset_status=onset_status,
        onset_date=onset_date,
        dry_spell_days=dry_spell_days,
        dry_spells_count=dry_spells_count,
        confidence=confidence,
        data_age_hours=max(0.0, data_age_hours),
        data_available=data_available,
        data_sources=sources,
        rainfall_30d=rainfall_30d,
        rainfall_actual_total=actual_total,
        rainfall_normal_total=normal_total,
        notice_code=notice_code,
        notice=notice,
        attribution=attribution,
    )


def _classify_moisture(
    actual: float,
    normal: float,
    climatology: list[dict[str, Any]],
    ref_date: date,
    sources: list[str],
) -> tuple[str, str]:
    if normal <= 0:
        return "normal", "low"

    ratio = actual / normal
    confidence = "high" if any("smap" in s.lower() for s in sources) else "medium"
    if not climatology:
        confidence = "low"

    if ratio < 0.7:
        return "dry", confidence
    if ratio > 1.3:
        return "wet", confidence
    return "normal", confidence


def _detect_onset(
    rain_records: list[ClimateRecord], ref_date: date
) -> tuple[str, date | None]:
    """
    G-01: onset_candidate until 21 clear days pass after 20mm event.
    Returns (onset_status, onset_date).
    """
    if not rain_records:
        return "unknown", None

    # Find first date with >= 20mm
    onset_candidate: date | None = None
    for r in rain_records:
        if r.value >= _ONSET_THRESHOLD_MM:
            onset_candidate = r.date
            break

    if onset_candidate is None:
        return "not_started", None

    days_since = (ref_date - onset_candidate).days
    if days_since < _ONSET_CONFIRMATION_DAYS:
        # Check for false start: any dry spell > 7 days after onset
        post_onset = [r for r in rain_records if r.date > onset_candidate]
        dry_run = 0
        for r in post_onset:
            if r.value < _DRY_THRESHOLD_MM:
                dry_run += 1
                if dry_run >= _DRY_SPELL_DAYS:
                    return "false_start_risk", onset_candidate
            else:
                dry_run = 0
        return "onset_detected", onset_candidate

    return "onset_detected", onset_candidate


def _detect_dry_spells(
    rain_records: list[ClimateRecord], ref_date: date
) -> tuple[int, int]:
    if not rain_records:
        return 0, 0

    current_dry = 0
    max_dry = 0
    dry_spells = 0
    in_spell = False

    for r in sorted(rain_records, key=lambda x: x.date):
        if r.value < _DRY_THRESHOLD_MM:
            current_dry += 1
            if current_dry >= _DRY_SPELL_DAYS and not in_spell:
                dry_spells += 1
                in_spell = True
            max_dry = max(max_dry, current_dry)
        else:
            current_dry = 0
            in_spell = False

    return max_dry, dry_spells


def _build_rainfall_series(
    rain_records: list[ClimateRecord],
    climatology: list[dict[str, Any]],
    ref_date: date,
) -> list[dict[str, Any]]:
    clim_by_dekad = {c["dekad"]: c for c in climatology if c.get("parameter") == "PRECTOTCORR"}
    actual_by_date = {r.date: r.value for r in rain_records}

    series = []
    for i in range(30):
        d = ref_date - timedelta(days=29 - i)
        dekad = _date_to_dekad(d)
        clim = clim_by_dekad.get(dekad, {})
        normal = clim.get("p50", 3.0)  # 3mm/day default
        series.append({
            "date": d.isoformat(),
            "actual_mm": actual_by_date.get(d, 0.0),
            "normal_mm": normal,
        })
    return series


def _date_to_dekad(d: date) -> int:
    """Convert date to dekad number 1-36."""
    month_dekad = min((d.day - 1) // 10, 2)  # 0, 1, or 2 (clamp day 31 to dekad 3)
    return (d.month - 1) * 3 + month_dekad + 1


def _build_notice(
    data_age_hours: float, sources: list[str], data_available: bool
) -> tuple[str | None, str | None]:
    if not data_available:
        return "no_recent_data", "No recent satellite data. Showing last available values."
    if data_age_hours > _STALE_HOURS:
        return "stale_data", f"Data is {int(data_age_hours)} hours old. Conditions may have changed."
    if len(sources) < 2:
        return "partial_data", "Only partial data sources available. Confidence is reduced."
    return None, None


def _build_attribution(sources: list[str]) -> str:
    parts = []
    if any("power" in s.lower() for s in sources):
        parts.append("NASA POWER (power.larc.nasa.gov)")
    if any("smap" in s.lower() for s in sources):
        parts.append("NASA SMAP L4 (nsidc.org)")
    if any("modis" in s.lower() for s in sources):
        parts.append("NASA MODIS (lpdaac.usgs.gov)")
    if any("imerg" in s.lower() for s in sources):
        parts.append("NASA GPM IMERG (gpm.nasa.gov)")
    if not parts:
        parts.append("Climatological baseline")
    return "Data: " + "; ".join(parts) + ". Resolution is regional, not plot-level."


def _no_data_outlook(season: str, ref_date: date) -> OutlookComputation:
    return OutlookComputation(
        season=season,
        moisture_class="normal",
        onset_status="unknown",
        onset_date=None,
        dry_spell_days=0,
        dry_spells_count=0,
        confidence="low",
        data_age_hours=999.0,
        data_available=False,
        data_sources=[],
        rainfall_30d=[],
        rainfall_actual_total=0.0,
        rainfall_normal_total=0.0,
        notice_code="no_recent_data",
        notice="No satellite data available. Using safe defaults.",
        attribution="No data available. Using climatological defaults.",
    )
