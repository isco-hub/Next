"""
BE-505: SMS alert tasks — onset, dry spell, planting window.
Throttling, quiet hours (21:00-06:00 EAT), daily per-user caps, global spend alarm.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300)
def send_onset_alerts(self) -> dict:  # type: ignore[override]
    """FR-SMS-04: Send onset SMS alerts when onset_status transitions to onset_detected."""
    try:
        return asyncio.run(_send_onset_alerts())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300)
def send_dry_spell_alerts(self) -> dict:  # type: ignore[override]
    """FR-SMS-07: Send dry spell alerts when dry_spell_days >= threshold."""
    try:
        return asyncio.run(_send_dry_spell_alerts())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=300)
def send_planting_window_alerts(self) -> dict:  # type: ignore[override]
    """FR-NOT-01: Send planting window open alerts."""
    try:
        return asyncio.run(_send_planting_window_alerts())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task
def check_sms_spend() -> None:
    """FR-SMS-07: Alert if cumulative SMS spend exceeds the configured alarm threshold."""
    asyncio.run(_check_spend())


async def _send_onset_alerts() -> dict:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import GridCell, OutlookSnapshot, Plot, User
    from app.ingestion.sms_provider import send_sms_if_allowed

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    sent = 0
    suppressed = 0

    async with session_factory() as db:
        # Find cells with onset_detected in the latest snapshot
        snaps_result = await db.execute(
            select(OutlookSnapshot)
            .where(OutlookSnapshot.onset_status == "onset_detected")
            .order_by(OutlookSnapshot.computed_at.desc())
        )
        onset_cell_ids = {s.grid_cell_id for s in snaps_result.scalars().all()}

        if not onset_cell_ids:
            return {"sent": 0, "suppressed": 0}

        # Find users with plots in those cells
        plots_result = await db.execute(
            select(Plot).where(Plot.grid_cell_id.in_(onset_cell_ids))
        )
        for plot in plots_result.scalars().all():
            if not plot.user_id:
                continue
            user_result = await db.execute(select(User).where(User.id == plot.user_id))
            user = user_result.scalar_one_or_none()
            if not user:
                continue

            result = await send_sms_if_allowed(
                db, user.id, user.msisdn_encrypted,
                "sms.alert.onset", {}, user.language,
            )
            if result:
                sent += 1
            else:
                suppressed += 1

        await db.commit()

    await engine.dispose()
    logger.info("Onset alerts: sent=%d suppressed=%d", sent, suppressed)
    return {"sent": sent, "suppressed": suppressed}


async def _send_dry_spell_alerts() -> dict:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import GridCell, OutlookSnapshot, Plot, User
    from app.ingestion.sms_provider import send_sms_if_allowed

    DRY_SPELL_ALERT_DAYS = 7

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    sent = 0
    suppressed = 0

    async with session_factory() as db:
        snaps_result = await db.execute(
            select(OutlookSnapshot)
            .where(OutlookSnapshot.dry_spell_days >= DRY_SPELL_ALERT_DAYS)
            .order_by(OutlookSnapshot.computed_at.desc())
        )
        dry_cells = {s.grid_cell_id: s.dry_spell_days for s in snaps_result.scalars().all()}

        for cell_id, days in dry_cells.items():
            plots_result = await db.execute(
                select(Plot).where(Plot.grid_cell_id == cell_id)
            )
            for plot in plots_result.scalars().all():
                if not plot.user_id:
                    continue
                user_result = await db.execute(select(User).where(User.id == plot.user_id))
                user = user_result.scalar_one_or_none()
                if not user:
                    continue
                result = await send_sms_if_allowed(
                    db, user.id, user.msisdn_encrypted,
                    "sms.alert.dry_spell", {"days": days}, user.language,
                )
                if result:
                    sent += 1
                else:
                    suppressed += 1

        await db.commit()

    await engine.dispose()
    logger.info("Dry spell alerts: sent=%d suppressed=%d", sent, suppressed)
    return {"sent": sent, "suppressed": suppressed}


async def _send_planting_window_alerts() -> dict:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import Plot, User
    from app.ingestion.sms_provider import send_sms_if_allowed

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    # Determine current season and window open date
    today = date.today()
    if today.month == 3 and today.day == 15:
        season, open_date = "A", "15 March"
    elif today.month == 8 and today.day == 15:
        season, open_date = "B", "15 August"
    else:
        return {"sent": 0, "suppressed": 0, "reason": "not a window open date"}

    sent = 0
    suppressed = 0

    async with session_factory() as db:
        users_result = await db.execute(select(User))
        for user in users_result.scalars().all():
            result = await send_sms_if_allowed(
                db, user.id, user.msisdn_encrypted,
                "sms.alert.planting_window",
                {"season": season, "date": open_date},
                user.language,
            )
            if result:
                sent += 1
            else:
                suppressed += 1
        await db.commit()

    await engine.dispose()
    return {"sent": sent, "suppressed": suppressed}


async def _check_spend() -> None:
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import Message

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        result = await db.execute(
            select(func.sum(Message.segments))
            .where(Message.direction == "outbound")
            .where(Message.channel == "sms")
            .where(Message.created_at >= month_start)
        )
        total_segments = result.scalar() or 0

    # Rough cost estimate: $0.004 per segment (Africa's Talking Uganda rate)
    estimated_cost_usd = total_segments * 0.004
    if estimated_cost_usd >= settings.sms_spend_alarm_usd:
        logger.warning(
            "SMS SPEND ALARM: estimated $%.2f this month (%d segments)",
            estimated_cost_usd, total_segments,
        )
        # TODO: integrate with Sentry/PagerDuty alert in BE-507

    await engine.dispose()

