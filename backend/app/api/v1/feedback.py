from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, get_optional_user
from app.core.errors import NotFoundError
from app.db.models import Feedback, Recommendation
from app.db.session import get_db

router = APIRouter()


class FeedbackBody(BaseModel):
    recommendation_id: str
    season: str
    followed: bool
    crop_planted: str
    rating: str | None = None
    thumbs: str | None = None
    reason_code: str | None = None
    comment: str | None = None


@router.post("/feedback", status_code=201)
async def submit_feedback(
    body: FeedbackBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser | None = Depends(get_optional_user),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    if idempotency_key:
        existing = await db.execute(
            select(Feedback).where(Feedback.idempotency_key == idempotency_key)
        )
        fb = existing.scalar_one_or_none()
        if fb:
            return _fb_dict(fb)

    # Resolve rule_ids from the recommendation
    rec_result = await db.execute(
        select(Recommendation).where(Recommendation.id == body.recommendation_id)
    )
    rec = rec_result.scalar_one_or_none()
    if rec is None:
        raise NotFoundError(f"Recommendation {body.recommendation_id} not found.")

    rule_ids = rec.rule_ids_fired or []

    fb = Feedback(
        id=str(uuid.uuid4()),
        recommendation_id=body.recommendation_id,
        user_id=user.user_id if user else None,
        season=body.season,
        followed=body.followed,
        crop_planted=body.crop_planted,
        rating=body.rating,
        thumbs=body.thumbs,
        reason_code=body.reason_code,
        comment=body.comment,
        rule_ids=rule_ids,
        idempotency_key=idempotency_key,
    )
    db.add(fb)
    await db.flush()
    return _fb_dict(fb)


def _fb_dict(fb: Feedback) -> dict:
    return {
        "id": fb.id,
        "recommendation_id": fb.recommendation_id,
        "season": fb.season,
        "followed": fb.followed,
        "crop_planted": fb.crop_planted,
        "rating": fb.rating,
        "thumbs": fb.thumbs,
        "reason_code": fb.reason_code,
        "comment": fb.comment,
        "rule_ids": fb.rule_ids,
        "created_at": fb.created_at.isoformat(),
    }
