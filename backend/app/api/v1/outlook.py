from __future__ import annotations

from datetime import UTC, datetime, date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import ClimateDaily, Climatology, GridCell, OutlookSnapshot
from app.db.session import get_db
from app.domain.outlook.service import ClimateRecord, compute_outlook

router = APIRouter()


@router.get("/outlook")
async def get_outlook(
    lat: Annotated[float | None, Query()] = None,
    lon: Annotated[float | None, Query()] = None,
    district_id: Annotated[str | None, Query()] = None,
    subcounty_id: Annotated[str | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Resolve grid cell
    cell = await _resolve_cell(db, lat, lon, district_id, subcounty_id)
    if cell is None:
        raise NotFoundError("No grid cell found for the given location.")

    # Try to return the latest precomputed outlook snapshot
    snapshot = await _latest_snapshot(db, cell.id)
    if snapshot:
        return _snapshot_to_dict(snapshot, cell)

    # Compute on-the-fly from climate_daily (fallback)
    records = await _load_climate_records(db, cell.id)
    climatology = await _load_climatology(db, cell.id)
    season = _current_season()
    outlook = compute_outlook(
        [ClimateRecord(r.date, r.parameter, r.value, r.source, r.quality_flag) for r in records],
        [{"dekad": c.dekad, "parameter": c.parameter, "p50": c.p50} for c in climatology],
        date.today(),
        season,
    )

    return {
        "grid_cell_id": cell.id,
        "district_id": cell.district_id,
        "subcounty_id": cell.subcounty_id,
        "computed_at": datetime.now(UTC).isoformat(),
        "season": outlook.season,
        "moisture_class": outlook.moisture_class,
        "onset_status": outlook.onset_status,
        "onset_date": outlook.onset_date.isoformat() if outlook.onset_date else None,
        "dry_spell_days": outlook.dry_spell_days,
        "dry_spells_count": outlook.dry_spells_count,
        "confidence": outlook.confidence,
        "data_age_hours": outlook.data_age_hours,
        "data_available": outlook.data_available,
        "data_sources": outlook.data_sources,
        "rainfall_30d": outlook.rainfall_30d,
        "rainfall_actual_total": outlook.rainfall_actual_total,
        "rainfall_normal_total": outlook.rainfall_normal_total,
        "seasonal_outlook": None,
        "notice_code": outlook.notice_code,
        "notice": outlook.notice,
        "attribution": outlook.attribution,
    }


async def _resolve_cell(
    db: AsyncSession,
    lat: float | None,
    lon: float | None,
    district_id: str | None,
    subcounty_id: str | None,
) -> GridCell | None:
    if subcounty_id:
        result = await db.execute(
            select(GridCell).where(GridCell.subcounty_id == subcounty_id).limit(1)
        )
        cell = result.scalar_one_or_none()
        if cell is not None:
            return cell

    if district_id:
        result = await db.execute(
            select(GridCell).where(GridCell.district_id == district_id).limit(1)
        )
        cell = result.scalar_one_or_none()
        if cell is not None:
            return cell

    if lat is not None and lon is not None:
        # Find nearest cell by distance
        result = await db.execute(
            select(GridCell).order_by(
                func.ST_Distance(
                    GridCell.centroid,
                    func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326),
                )
            ).limit(1)
        )
        return result.scalar_one_or_none()

    return None


async def _latest_snapshot(db: AsyncSession, cell_id: str) -> OutlookSnapshot | None:
    result = await db.execute(
        select(OutlookSnapshot)
        .where(OutlookSnapshot.grid_cell_id == cell_id)
        .order_by(OutlookSnapshot.computed_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _load_climate_records(db: AsyncSession, cell_id: str) -> list[ClimateDaily]:
    from datetime import timedelta
    cutoff = date.today() - timedelta(days=40)
    result = await db.execute(
        select(ClimateDaily)
        .where(ClimateDaily.grid_cell_id == cell_id)
        .where(ClimateDaily.date >= cutoff)
        .order_by(ClimateDaily.date)
    )
    return list(result.scalars().all())


async def _load_climatology(db: AsyncSession, cell_id: str) -> list[Climatology]:
    result = await db.execute(
        select(Climatology).where(Climatology.grid_cell_id == cell_id)
    )
    return list(result.scalars().all())


def _current_season() -> str:
    month = date.today().month
    return "A" if 3 <= month <= 7 else "B"


def _snapshot_to_dict(s: OutlookSnapshot, cell: GridCell) -> dict:
    return {
        "grid_cell_id": s.grid_cell_id,
        "district_id": cell.district_id,
        "subcounty_id": cell.subcounty_id,
        "computed_at": s.computed_at.isoformat(),
        "season": s.season,
        "moisture_class": s.moisture_class,
        "onset_status": s.onset_status,
        "onset_date": s.onset_date.isoformat() if s.onset_date else None,
        "dry_spell_days": s.dry_spell_days,
        "dry_spells_count": s.dry_spells_count,
        "confidence": s.confidence,
        "data_age_hours": s.data_age_hours,
        "data_available": s.data_available,
        "data_sources": s.data_sources,
        "rainfall_30d": s.rainfall_30d,
        "rainfall_actual_total": s.rainfall_actual_total,
        "rainfall_normal_total": s.rainfall_normal_total,
        "seasonal_outlook": s.seasonal_outlook,
        "notice_code": s.notice_code,
        "notice": s.notice,
        "attribution": s.attribution,
    }
