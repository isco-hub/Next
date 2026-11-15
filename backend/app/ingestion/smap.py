"""
BE-304 / BE-504: NASA SMAP L4 soil moisture ingestion adapter.
Uses earthaccess for Earthdata authentication.
Fetches SPL4SMGP (SMAP L4 Global Surface and Rootzone Soil Moisture).
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

SMAP_SOURCE = "NASA_SMAP_L4"
SMAP_PRODUCT = "SPL4SMGP"
SMAP_VERSION = "007"
SMAP_RESOLUTION_DEG = 0.09  # ~9 km


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=120), reraise=True)
async def fetch_smap_daily(
    lat: float,
    lon: float,
    target_date: date,
) -> list[dict[str, Any]]:
    """
    Fetch SMAP L4 soil moisture for a point and date.
    Returns normalised records compatible with climate_daily schema.
    """
    try:
        import earthaccess
        import numpy as np
    except ImportError:
        logger.warning("earthaccess not installed — SMAP fetch skipped")
        return []

    from app.core.settings import get_settings

    settings = get_settings()
    if not settings.earthdata_username or not settings.earthdata_password:
        logger.warning("Earthdata credentials not configured — SMAP fetch skipped")
        return []

    try:
        earthaccess.login(
            strategy="environment",
            persist=False,
        )
    except Exception as exc:
        logger.error("Earthdata login failed: %s", exc)
        return []

    date_str = target_date.strftime("%Y-%m-%d")
    try:
        results = earthaccess.search_data(
            short_name=SMAP_PRODUCT,
            version=SMAP_VERSION,
            temporal=(date_str, date_str),
            bounding_box=(lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1),
        )
    except Exception as exc:
        logger.error("SMAP search failed for %s: %s", date_str, exc)
        return []

    if not results:
        logger.info("No SMAP data for %s at (%.2f, %.2f)", date_str, lat, lon)
        return []

    records: list[dict[str, Any]] = []
    try:
        files = earthaccess.open(results[:1])
        import xarray as xr

        ds = xr.open_dataset(files[0], group="Geophysical_Data")

        # Find nearest grid point
        lats = ds["latitude"].values if "latitude" in ds else None
        lons = ds["longitude"].values if "longitude" in ds else None

        for var_name, param_name in [
            ("sm_rootzone", "SMAP_ROOTZONE_SM"),
            ("sm_surface", "SMAP_SURFACE_SM"),
        ]:
            if var_name not in ds:
                continue
            data = ds[var_name]
            # Extract nearest point value
            if lats is not None and lons is not None:
                lat_idx = int(np.argmin(np.abs(lats - lat)))
                lon_idx = int(np.argmin(np.abs(lons - lon)))
                value = float(data.values[lat_idx, lon_idx])
            else:
                value = float(data.mean().values)

            if np.isnan(value) or value < 0:
                continue

            records.append({
                "date": target_date,
                "parameter": param_name,
                "value": value,
                "source": SMAP_SOURCE,
                "product_version": SMAP_VERSION,
                "quality_flag": "ok",
                "lat": lat,
                "lon": lon,
            })

        ds.close()
    except Exception as exc:
        logger.error("SMAP data extraction failed: %s", exc)

    return records


async def backfill_smap(
    lat: float,
    lon: float,
    days: int = 30,
) -> list[dict[str, Any]]:
    """Fetch recent SMAP data for a location."""
    all_records: list[dict[str, Any]] = []
    end = date.today()
    for i in range(days):
        target = end - timedelta(days=i)
        try:
            records = await fetch_smap_daily(lat, lon, target)
            all_records.extend(records)
        except Exception as exc:
            logger.warning("SMAP backfill failed for %s: %s", target, exc)
    return all_records

