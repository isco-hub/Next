"""
BE-504: NASA MODIS MOD13Q1 NDVI ingestion and GPM IMERG consistency check.
NDVI anomaly is labelled as "crop stress history" per the workplan.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

MODIS_SOURCE = "NASA_MODIS_MOD13Q1"
MODIS_PRODUCT = "MOD13Q1"
MODIS_VERSION = "061"

IMERG_SOURCE = "NASA_GPM_IMERG"
IMERG_PRODUCT = "GPM_3IMERGDF"
IMERG_VERSION = "07"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=120), reraise=True)
async def fetch_modis_ndvi(
    lat: float,
    lon: float,
    target_date: date,
) -> list[dict[str, Any]]:
    """
    Fetch MODIS MOD13Q1 NDVI for a point.
    MOD13Q1 is 16-day composite; we store the composite value with the acquisition date.
    NDVI anomaly is labelled 'crop_stress_history' per FR-DAT-04.
    """
    try:
        import earthaccess
        import numpy as np
    except ImportError:
        logger.warning("earthaccess not installed — MODIS fetch skipped")
        return []

    from app.core.settings import get_settings

    settings = get_settings()
    if not settings.earthdata_username:
        return []

    try:
        earthaccess.login(strategy="environment", persist=False)
        date_str = target_date.strftime("%Y-%m-%d")
        results = earthaccess.search_data(
            short_name=MODIS_PRODUCT,
            version=MODIS_VERSION,
            temporal=(date_str, date_str),
            bounding_box=(lon - 0.15, lat - 0.15, lon + 0.15, lat + 0.15),
        )
    except Exception as exc:
        logger.error("MODIS search failed: %s", exc)
        return []

    if not results:
        return []

    records: list[dict[str, Any]] = []
    try:
        import xarray as xr

        files = earthaccess.open(results[:1])
        ds = xr.open_dataset(files[0])

        for var_name, param_name in [
            ("250m 16 days NDVI", "MODIS_NDVI"),
            ("250m 16 days EVI", "MODIS_EVI"),
        ]:
            if var_name not in ds:
                continue
            value = float(ds[var_name].mean().values)
            if np.isnan(value):
                continue
            # Scale factor for MOD13Q1 NDVI is 0.0001
            scaled = value * 0.0001
            quality_flag = "ok" if -0.2 <= scaled <= 1.0 else "range_violation"
            records.append({
                "date": target_date,
                "parameter": param_name,
                "value": scaled,
                "source": MODIS_SOURCE,
                "product_version": MODIS_VERSION,
                "quality_flag": quality_flag,
                "lat": lat,
                "lon": lon,
            })
        ds.close()
    except Exception as exc:
        logger.error("MODIS extraction failed: %s", exc)

    return records


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=120), reraise=True)
async def fetch_imerg_daily(
    lat: float,
    lon: float,
    target_date: date,
) -> list[dict[str, Any]]:
    """
    Fetch GPM IMERG daily precipitation for a point (FR-DAT-03).
    Used for consistency check against POWER precipitation.
    """
    try:
        import earthaccess
        import numpy as np
    except ImportError:
        return []

    from app.core.settings import get_settings

    if not get_settings().earthdata_username:
        return []

    try:
        earthaccess.login(strategy="environment", persist=False)
        date_str = target_date.strftime("%Y-%m-%d")
        results = earthaccess.search_data(
            short_name=IMERG_PRODUCT,
            version=IMERG_VERSION,
            temporal=(date_str, date_str),
            bounding_box=(lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1),
        )
    except Exception as exc:
        logger.error("IMERG search failed: %s", exc)
        return []

    if not results:
        return []

    records: list[dict[str, Any]] = []
    try:
        import xarray as xr

        files = earthaccess.open(results[:1])
        ds = xr.open_dataset(files[0])
        precip_var = next((v for v in ds.data_vars if "precipitation" in v.lower()), None)
        if precip_var:
            value = float(ds[precip_var].mean().values)
            if not np.isnan(value) and value >= 0:
                records.append({
                    "date": target_date,
                    "parameter": "imerg_precip",
                    "value": value,
                    "source": IMERG_SOURCE,
                    "product_version": IMERG_VERSION,
                    "quality_flag": "ok",
                    "lat": lat,
                    "lon": lon,
                })
        ds.close()
    except Exception as exc:
        logger.error("IMERG extraction failed: %s", exc)

    return records


def check_imerg_power_consistency(
    imerg_mm: float,
    power_mm: float,
    threshold_ratio: float = 3.0,
) -> str:
    """
    FR-DAT-03: Flag large discrepancies between IMERG and POWER precipitation.
    Returns 'ok', 'warning', or 'inconsistent'.
    """
    if power_mm <= 0 and imerg_mm <= 0:
        return "ok"
    if power_mm <= 0 or imerg_mm <= 0:
        return "warning"
    ratio = max(imerg_mm, power_mm) / min(imerg_mm, power_mm)
    if ratio > threshold_ratio:
        return "inconsistent"
    return "ok"
