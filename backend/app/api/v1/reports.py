from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, require_roles
from app.db.models import Feedback, Recommendation
from app.db.session import get_db

router = APIRouter()

_SUPPRESSION_THRESHOLD = 10


@router.get("/reports/summary")
async def report_summary(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(
        require_roles("admin", "extension_officer", "cooperative", "agronomist")
    ),
) -> dict:
    from datetime import UTC, datetime

    # Usage by channel
    channel_result = await db.execute(
        select(Recommendation.channel, func.count(Recommendation.id))
        .group_by(Recommendation.channel)
    )
    usage_by_channel = [
        {"channel": row[0], "count": row[1]} for row in channel_result.all()
    ]

    # Adoption funnel (simplified)
    total_recs = sum(r["count"] for r in usage_by_channel)
    fb_result = await db.execute(select(func.count(Feedback.id)))
    total_feedback = fb_result.scalar() or 0
    followed_result = await db.execute(
        select(func.count(Feedback.id)).where(Feedback.followed.is_(True))
    )
    total_followed = followed_result.scalar() or 0

    adoption_funnel = [
        {"stage": "recommendations", "count": total_recs},
        {"stage": "feedback_submitted", "count": total_feedback},
        {"stage": "plan_followed", "count": total_followed},
    ]

    # Follow rate by rule ID (suppress if sample < threshold)
    fb_rows = await db.execute(select(Feedback))
    rule_stats: dict[str, dict] = {}
    for fb in fb_rows.scalars().all():
        for rid in fb.rule_ids:
            if rid not in rule_stats:
                rule_stats[rid] = {"followed": 0, "total": 0, "crop": fb.crop_planted}
            rule_stats[rid]["total"] += 1
            if fb.followed:
                rule_stats[rid]["followed"] += 1

    follow_rate_by_rule = [
        {
            "rule_id": rid,
            "crop": stats["crop"],
            "follow_rate": stats["followed"] / stats["total"] if stats["total"] else 0.0,
            "sample_size": stats["total"],
        }
        for rid, stats in rule_stats.items()
        if stats["total"] >= _SUPPRESSION_THRESHOLD
    ]

    suppressed = any(
        stats["total"] < _SUPPRESSION_THRESHOLD for stats in rule_stats.values()
    )

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "suppressed": suppressed,
        "usage_by_channel": usage_by_channel,
        "adoption_funnel": adoption_funnel,
        "follow_rate_by_rule": follow_rate_by_rule,
    }
