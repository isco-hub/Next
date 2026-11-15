"""
NASA POWER ingestion adapter.
Fetches daily climate parameters for a grid cell with exponential backoff.
Produces normalised rows with full provenance (FR-DAT-01, FR-DAT-05, FR-DAT-06).
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.settings import get_settings

logger = logging.getLogger(__name__)

# Parameters per FR-DAT-01
POWER_PARAMETERS = [
    "PRECTOTCORR",   # precipitation corrected (mm/day)
    "T2M",           # temperature at 2m (°C)
    "T2M_MAX",       # max temperature
    "T2M_MIN",       # min temperature
    "RH2M",          # relative humidity
    "ALLSKY_SFC_SW_DWN",  # solar radiation
    "WS2M",          # wind speed
    "GWETROOT",      # root zone soil wetness (0-1)
]

POWER_PRODUCT_VERSION = "2.3.0"
POWER_SOURCE = "NASA_POWER"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
async def fetch_power_daily(
    lat: float,
    lon: float,
    start: date,
    end: date,
    client: httpx.AsyncClient | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch daily POWER data for a point and date range.
    Returns a list of normalised records ready for upsert.
    """
    settings = get_settings()
    params = {
        "parameters": ",".join(POWER_PARAMETERS),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=60.0)
        close_client = True

    try:
        response = await client.get(settings.power_base_url, params=params)
        response.raise_for_status()
        data = response.json()
    finally:
        if close_client:
            await client.aclose()

    return _parse_power_response(data, lat, lon)


def _parse_power_response(
    data: dict[str, Any], lat: float, lon: float
) -> list[dict[str, Any]]:
    """Parse POWER JSON response into normalised records."""
    records: list[dict[str, Any]] = []
    properties = data.get("properties", {})
    parameter_data = properties.get("parameter", {})
    header = data.get("header", {})
    fill_value = header.get("fill_value", -999.0)

    for param, daily_values in parameter_data.items():
        for date_str, value in daily_values.items():
            if value == fill_value or value is None:
                continue
            try:
                record_date = date(
                    int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8])
                )
            except (ValueError, IndexError):
                continue

            records.append({
                "date": record_date,
                "parameter": param,
                "value": float(value),
                "source": POWER_SOURCE,
                "product_version": POWER_PRODUCT_VERSION,
                "quality_flag": "ok",
                "lat": lat,
                "lon": lon,
            })

    return records


async def backfill_power(
    lat: float,
    lon: float,
    years: int = 20,
    client: httpx.AsyncClient | None = None,
) -> list[dict[str, Any]]:
    """Fetch historical POWER data for climatology backfill (BE-201)."""
    end = date.today()
    start = date(end.year - years, 1, 1)
    all_records: list[dict[str, Any]] = []

    # Fetch in yearly chunks to avoid large requests
    current = start
    while current < end:
        chunk_end = min(date(current.year, 12, 31), end)
        try:
            records = await fetch_power_daily(lat, lon, current, chunk_end, client)
            all_records.extend(records)
        except Exception as exc:
            logger.warning("POWER backfill failed for %s-%s: %s", current, chunk_end, exc)
        current = date(current.year + 1, 1, 1)

    return all_records
