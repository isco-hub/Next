from __future__ import annotations

import uuid
from datetime import UTC, datetime, date
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, get_optional_user
from app.core.errors import ConflictError, NotFoundError
from app.db.models import OutlookSnapshot, Recommendation
from app.db.session import get_db
from app.domain.rules.engine import EngineInputs, run_engine
from app.domain.rules.loader import load_published_pack

router = APIRouter()


class RecommendationRequest(BaseModel):
    lat: float | None = None
    lon: float | None = None
    district_id: str | None = None
    subcounty_id: str | None = None
    previous_crops: list[str] = Field(default_factory=list)
    soil_type: str = "unknown"
    goal: str = "restore_soil"
    flags: list[str] = Field(default_factory=list)
    seasons: int = Field(default=4, ge=1, le=8)
    language: str = "en"
    channel: str = "web"
    start_season: str | None = None


@router.post("/recommendations", status_code=201)
async def create_recommendation(
    body: RecommendationRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser | None = Depends(get_optional_user),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    # Idempotency check (G-11)
    if idempotency_key:
        existing = await db.execute(
            select(Recommendation).where(Recommendation.idempotency_key == idempotency_key)
        )
        rec = existing.scalar_one_or_none()
        if rec:
            return _rec_to_dict(rec)

    # Load published pack
    pack = load_published_pack()
    pack_version = pack["version"]

    # Resolve outlook
    outlook_data, outlook_id = await _resolve_outlook(db, body)

    # Determine start season
    start_season = body.start_season or _current_season()

    # Run engine
    inputs = EngineInputs(
        previous_crops=body.previous_crops or ["other"],
        soil_type=body.soil_type,
        goal=body.goal,
        flags=body.flags,
        moisture_class=outlook_data.get("moisture_class", "normal"),
        season=start_season,
        seasons_requested=body.seasons,
        language=body.language,
    )
    result = run_engine(inputs, pack)

    # Build disclaimer
    messages = pack.get("messages", {})
    disclaimer_key = pack.get("disclaimer_key", "disclaimer")
    disclaimer = (messages.get(disclaimer_key) or {}).get(body.language) or (
        messages.get(disclaimer_key) or {}
    ).get("en", "")

    # Persist
    rec_id = str(uuid.uuid4())
    seasons_json = [
        {
            "season_index": s.season_index,
            "season": s.season,
            "year": int(s.window_start[:4]),
            "crop": s.crop,
            "window_start": s.window_start,
            "window_end": s.window_end,
            "rationale": s.rationale,
            "rationale_key": s.rationale_key,
            "alternatives": [
                {"crop": a.crop, "rationale": a.rationale, "rationale_key": a.rationale_key}
                for a in s.alternatives
            ],
            "warnings": [
                {"code": w.code, "message": w.message, "message_key": w.message_key}
                for w in s.warnings
            ],
            "rule_ids": s.rule_ids,
            "fallback": s.fallback,
            "locked": s.locked,
        }
        for s in result.seasons
    ]

    rec = Recommendation(
        id=rec_id,
        user_id=user.user_id if user else None,
        outlook_id=outlook_id,
        pack_version=pack_version,
        inputs=body.model_dump(),
        seasons=seasons_json,
        rule_ids_fired=result.rule_ids_fired,
        channel=body.channel,
        language=body.language,
        idempotency_key=idempotency_key,
    )
    db.add(rec)
    await db.flush()

    return {
        "id": rec_id,
        "pack_version": pack_version,
        "created_at": datetime.now(UTC).isoformat(),
        "channel": body.channel,
        "language": body.language,
        "inputs": body.model_dump(),
        "outlook": outlook_data,
        "seasons": seasons_json,
        "disclaimer": disclaimer,
        "disclaimer_key": disclaimer_key,
    }


@router.get("/recommendations")
async def list_recommendations(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser | None = Depends(get_optional_user),
) -> list[dict]:
    q = select(Recommendation).order_by(Recommendation.created_at.desc()).limit(50)
    if user:
        q = q.where(Recommendation.user_id == user.user_id)
    result = await db.execute(q)
    recs = result.scalars().all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat(),
            "pack_version": r.pack_version,
            "crops": [s["crop"] for s in r.seasons],
            "season": r.seasons[0]["season"] if r.seasons else "A",
        }
        for r in recs
    ]


@router.get("/recommendations/{rec_id}")
async def get_recommendation(
    rec_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Recommendation).where(Recommendation.id == rec_id)
    )
    rec = result.scalar_one_or_none()
    if rec is None:
        raise NotFoundError(f"Recommendation {rec_id} not found.")
    return _rec_to_dict(rec)


async def _resolve_outlook(
    db: AsyncSession, body: RecommendationRequest
) -> tuple[dict, str | None]:
    """Resolve the latest outlook snapshot for the given location."""
    from app.api.v1.outlook import _resolve_cell, _snapshot_to_dict

    cell = await _resolve_cell(db, body.lat, body.lon, body.district_id, body.subcounty_id)
    if cell is None:
        return _default_outlook(), None

    result = await db.execute(
        select(OutlookSnapshot)
        .where(OutlookSnapshot.grid_cell_id == cell.id)
        .order_by(OutlookSnapshot.computed_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if snapshot:
        return _snapshot_to_dict(snapshot, cell), snapshot.id

    return _default_outlook(), None


def _default_outlook() -> dict:
    return {
        "grid_cell_id": "",
        "district_id": "",
        "subcounty_id": "",
        "computed_at": datetime.now(UTC).isoformat(),
        "season": _current_season(),
        "moisture_class": "normal",
        "onset_status": "unknown",
        "onset_date": None,
        "dry_spell_days": 0,
        "dry_spells_count": 0,
        "confidence": "low",
        "data_age_hours": 999.0,
        "data_available": False,
        "data_sources": [],
        "rainfall_30d": [],
        "rainfall_actual_total": 0.0,
        "rainfall_normal_total": 0.0,
        "seasonal_outlook": None,
        "notice_code": "no_recent_data",
        "notice": "No location data available. Using safe defaults.",
        "attribution": "No data available.",
    }


def _current_season() -> str:
    month = date.today().month
    return "A" if 3 <= month <= 7 else "B"


def _rec_to_dict(rec: Recommendation) -> dict:
    return {
        "id": rec.id,
        "pack_version": rec.pack_version,
        "created_at": rec.created_at.isoformat(),
        "channel": rec.channel,
        "language": rec.language,
        "inputs": rec.inputs,
        "outlook": {},
        "seasons": rec.seasons,
        "disclaimer": "",
        "disclaimer_key": "disclaimer",
    }

