from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    settings = get_settings()
    status = "ok"
    data_freshness_hours = 999.0

    try:
        result = await db.execute(
            text(
                "SELECT EXTRACT(EPOCH FROM (NOW() - MAX(retrieved_at)))/3600 "
                "FROM climate_daily"
            )
        )
        row = result.scalar()
        if row is not None:
            data_freshness_hours = float(row)
        if data_freshness_hours > settings.ingestion_stale_alert_hours:
            status = "degraded"
    except Exception:
        status = "degraded"

    return {
        "status": status,
        "data_freshness_hours": round(data_freshness_hours, 1),
        "version": settings.version,
        "time": datetime.now(UTC).isoformat(),
    }
