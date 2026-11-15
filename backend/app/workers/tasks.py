from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def run_nightly_pipeline(self) -> dict:  # type: ignore[override]
    """
    Nightly pipeline (BE-204): ingest -> validate -> climatology deltas -> outlook snapshots.
    Must complete in under 2 hours.
    """
    try:
        return asyncio.run(_nightly_pipeline())
    except Exception as exc:
        logger.error("Nightly pipeline failed: %s", exc)
        raise self.retry(exc=exc)


async def _nightly_pipeline() -> dict:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import ClimateDaily, Climatology, GridCell, OutlookSnapshot
    from app.domain.outlook.service import ClimateRecord, compute_outlook
    from app.ingestion.power import fetch_power_daily
    from app.ingestion.quality import check_quality

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    start_time = datetime.now(UTC)
    cells_processed = 0
    errors = 0

    async with session_factory() as db:
        from sqlalchemy import select

        cells_result = await db.execute(select(GridCell))
        cells = cells_result.scalars().all()

        import httpx

        async with httpx.AsyncClient(timeout=60.0) as client:
            for cell in cells:
                try:
                    # Fetch last 40 days
                    end = date.today()
                    start = end - timedelta(days=40)
                    raw_records = await fetch_power_daily(
                        cell.lat, cell.lon, start, end, client
                    )
                    checked = check_quality(raw_records)

                    # Upsert into climate_daily
                    for r in checked:
                        from sqlalchemy.dialects.postgresql import insert as pg_insert

                        stmt = pg_insert(ClimateDaily).values(
                            grid_cell_id=cell.id,
                            date=r["date"],
                            parameter=r["parameter"],
                            value=r["value"],
                            source=r["source"],
                            product_version=r["product_version"],
                            quality_flag=r["quality_flag"],
                        ).on_conflict_do_update(
                            index_elements=["grid_cell_id", "date", "parameter", "source"],
                            set_={"value": r["value"], "quality_flag": r["quality_flag"]},
                        )
                        await db.execute(stmt)

                    # Compute and store outlook snapshot
                    all_records_result = await db.execute(
                        select(ClimateDaily)
                        .where(ClimateDaily.grid_cell_id == cell.id)
                        .where(ClimateDaily.date >= start)
                    )
                    all_records = all_records_result.scalars().all()

                    clim_result = await db.execute(
                        select(Climatology).where(Climatology.grid_cell_id == cell.id)
                    )
                    climatology = clim_result.scalars().all()

                    season = "A" if 3 <= date.today().month <= 7 else "B"
                    outlook = compute_outlook(
                        [
                            ClimateRecord(
                                r.date, r.parameter, r.value, r.source, r.quality_flag
                            )
                            for r in all_records
                        ],
                        [
                            {"dekad": c.dekad, "parameter": c.parameter, "p50": c.p50}
                            for c in climatology
                        ],
                        date.today(),
                        season,
                    )

                    snapshot = OutlookSnapshot(
                        grid_cell_id=cell.id,
                        season=outlook.season,
                        moisture_class=outlook.moisture_class,
                        onset_status=outlook.onset_status,
                        onset_date=outlook.onset_date,
                        dry_spell_days=outlook.dry_spell_days,
                        dry_spells_count=outlook.dry_spells_count,
                        confidence=outlook.confidence,
                        data_age_hours=outlook.data_age_hours,
                        data_available=outlook.data_available,
                        data_sources=outlook.data_sources,
                        rainfall_30d=outlook.rainfall_30d,
                        rainfall_actual_total=outlook.rainfall_actual_total,
                        rainfall_normal_total=outlook.rainfall_normal_total,
                        notice_code=outlook.notice_code,
                        notice=outlook.notice,
                        attribution=outlook.attribution,
                    )
                    db.add(snapshot)
                    cells_processed += 1

                except Exception as exc:
                    logger.error("Pipeline error for cell %s: %s", cell.id, exc)
                    errors += 1

        await db.commit()

    elapsed = (datetime.now(UTC) - start_time).total_seconds()
    logger.info(
        "Nightly pipeline complete: %d cells, %d errors, %.1fs",
        cells_processed, errors, elapsed,
    )
    return {"cells_processed": cells_processed, "errors": errors, "elapsed_seconds": elapsed}


@celery_app.task
def check_data_freshness() -> None:
    """Alert if data is stale (FR-DAT-06, SRS 11.2)."""
    asyncio.run(_check_freshness())


async def _check_freshness() -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(
            text(
                "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(retrieved_at)))/3600 "
                "FROM climate_daily"
            )
        )
        age_hours = result.scalar()

    if age_hours and float(age_hours) > settings.ingestion_stale_alert_hours:
        logger.warning("DATA STALE: last ingestion was %.1f hours ago", float(age_hours))
        # TODO: send alert via Sentry/Prometheus in BE-507


@celery_app.task(bind=True, max_retries=3, default_retry_delay=600)
def backfill_climatology(self, cell_id: str, lat: float, lon: float) -> dict:  # type: ignore[override]
    """Backfill 20+ years of POWER data and compute climatology (BE-201)."""
    try:
        return asyncio.run(_backfill(cell_id, lat, lon))
    except Exception as exc:
        raise self.retry(exc=exc)


async def _backfill(cell_id: str, lat: float, lon: float) -> dict:
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import ClimateDaily, Climatology
    from app.ingestion.power import backfill_power
    from app.ingestion.quality import check_quality

    records = await backfill_power(lat, lon, years=20)
    checked = check_quality(records)
    logger.info("Backfill for cell %s: %d records", cell_id, len(checked))

    if not checked:
        return {"cell_id": cell_id, "records": 0, "climatology_rows": 0}

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        # Upsert all historical records
        for r in checked:
            stmt = pg_insert(ClimateDaily).values(
                grid_cell_id=cell_id,
                date=r["date"],
                parameter=r["parameter"],
                value=r["value"],
                source=r["source"],
                product_version=r["product_version"],
                quality_flag=r["quality_flag"],
            ).on_conflict_do_update(
                index_elements=["grid_cell_id", "date", "parameter", "source"],
                set_={"value": r["value"], "quality_flag": r["quality_flag"]},
            )
            await db.execute(stmt)

        # Compute dekadal climatology (percentiles) per parameter
        clim_rows = _compute_climatology(checked, cell_id)
        for row in clim_rows:
            stmt = pg_insert(Climatology).values(**row).on_conflict_do_update(
                index_elements=["grid_cell_id", "dekad", "parameter", "source"],
                set_={
                    "p10": row["p10"], "p25": row["p25"], "p50": row["p50"],
                    "p75": row["p75"], "p90": row["p90"],
                    "record_years": row["record_years"],
                },
            )
            await db.execute(stmt)

        await db.commit()

    await engine.dispose()
    return {"cell_id": cell_id, "records": len(checked), "climatology_rows": len(clim_rows)}


def _compute_climatology(records: list[dict], cell_id: str) -> list[dict]:
    """Compute dekadal percentiles (p10-p90) from historical records."""
    from datetime import date as date_type
    import statistics

    def _date_to_dekad(d: date_type) -> int:
        return (d.month - 1) * 3 + (d.day - 1) // 10 + 1

    # Group by (parameter, dekad)
    groups: dict[tuple[str, int], list[float]] = {}
    for r in records:
        if r["quality_flag"] != "ok":
            continue
        dekad = _date_to_dekad(r["date"])
        key = (r["parameter"], dekad)
        groups.setdefault(key, []).append(r["value"])

    clim_rows = []
    for (param, dekad), values in groups.items():
        if len(values) < 3:
            continue
        sorted_vals = sorted(values)
        n = len(sorted_vals)

        def _percentile(p: float) -> float:
            idx = (p / 100) * (n - 1)
            lo, hi = int(idx), min(int(idx) + 1, n - 1)
            return sorted_vals[lo] + (idx - lo) * (sorted_vals[hi] - sorted_vals[lo])

        # Estimate record years from number of values (one per dekad per year)
        record_years = max(1, n // 1)

        clim_rows.append({
            "grid_cell_id": cell_id,
            "dekad": dekad,
            "parameter": param,
            "p10": round(_percentile(10), 4),
            "p25": round(_percentile(25), 4),
            "p50": round(_percentile(50), 4),
            "p75": round(_percentile(75), 4),
            "p90": round(_percentile(90), 4),
            "record_years": record_years,
            "source": "NASA_POWER",
        })

    return clim_rows

