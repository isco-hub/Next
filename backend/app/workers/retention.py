"""
BE-606: Data retention and anonymisation jobs (SRS 6.3).
- Recommendations: anonymise after 24 months
- Messages: delete after 12 months
- Audit log: retain 3 years (immutable, no delete)
- Inactive users: anonymise after 24 months of no activity
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

RECOMMENDATION_ANONYMISE_MONTHS = 24
MESSAGE_DELETE_MONTHS = 12
USER_INACTIVE_ANONYMISE_MONTHS = 24


@celery_app.task(bind=True, max_retries=2)
def run_retention_jobs(self) -> dict:  # type: ignore[override]
    """Run all retention and anonymisation jobs. Scheduled monthly."""
    try:
        return asyncio.run(_run_all())
    except Exception as exc:
        raise self.retry(exc=exc)


async def _run_all() -> dict:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        recs_anonymised = await _anonymise_old_recommendations(db)
        msgs_deleted = await _delete_old_messages(db)
        users_anonymised = await _anonymise_inactive_users(db)
        await db.commit()

    await engine.dispose()
    result = {
        "recommendations_anonymised": recs_anonymised,
        "messages_deleted": msgs_deleted,
        "users_anonymised": users_anonymised,
    }
    logger.info("Retention jobs complete: %s", result)
    return result


async def _anonymise_old_recommendations(db: object) -> int:
    """
    Anonymise recommendations older than 24 months by nulling user_id.
    Keeps the plan data for agronomic analysis but removes the link to the user.
    """
    from sqlalchemy import select, update

    from app.db.models import Recommendation

    cutoff = datetime.now(UTC) - timedelta(days=RECOMMENDATION_ANONYMISE_MONTHS * 30)
    result = await db.execute(
        update(Recommendation)
        .where(Recommendation.created_at < cutoff)
        .where(Recommendation.user_id.isnot(None))
        .values(user_id=None)
        .returning(Recommendation.id)
    )
    count = len(result.fetchall())
    if count:
        logger.info("Anonymised %d old recommendations", count)
    return count


async def _delete_old_messages(db: object) -> int:
    """Delete SMS/USSD message records older than 12 months."""
    from sqlalchemy import delete

    from app.db.models import Message

    cutoff = datetime.now(UTC) - timedelta(days=MESSAGE_DELETE_MONTHS * 30)
    result = await db.execute(
        delete(Message)
        .where(Message.created_at < cutoff)
        .returning(Message.id)
    )
    count = len(result.fetchall())
    if count:
        logger.info("Deleted %d old message records", count)
    return count


async def _anonymise_inactive_users(db: object) -> int:
    """
    Anonymise users with no activity in 24 months.
    Replaces msisdn_encrypted with a placeholder; msisdn_hash is retained for dedup.
    """
    from sqlalchemy import select, update

    from app.db.models import Recommendation, User

    cutoff = datetime.now(UTC) - timedelta(days=USER_INACTIVE_ANONYMISE_MONTHS * 30)

    # Find users with no recent recommendations
    active_result = await db.execute(
        select(Recommendation.user_id)
        .where(Recommendation.created_at >= cutoff)
        .where(Recommendation.user_id.isnot(None))
        .distinct()
    )
    active_user_ids = {row[0] for row in active_result.fetchall()}

    result = await db.execute(
        select(User)
        .where(User.created_at < cutoff)
        .where(User.id.notin_(active_user_ids))
        .where(User.msisdn_encrypted != "[anonymised]")
    )
    users = result.scalars().all()

    for user in users:
        user.msisdn_encrypted = "[anonymised]"
        user.display_name = None

    count = len(users)
    if count:
        logger.info("Anonymised %d inactive users", count)
    return count

