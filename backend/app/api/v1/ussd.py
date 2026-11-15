from __future__ import annotations

import hashlib
import hmac
import json
from datetime import date
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import PlainTextResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.ussd import (
    UssdSession,
    process_ussd,
    session_key,
)
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.settings import get_settings
from app.db.session import get_db

router = APIRouter()

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            str(settings.redis_url).replace("/0", f"/{settings.redis_session_db}")
        )
    return _redis_client


class UssdCallbackBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sessionId: str = Field(validation_alias=AliasChoices("sessionId", "session_id"))
    serviceCode: str = Field(validation_alias=AliasChoices("serviceCode", "service_code"))
    phoneNumber: str = Field(validation_alias=AliasChoices("phoneNumber", "phone_number"))
    networkCode: str = Field(validation_alias=AliasChoices("networkCode", "network_code"))
    text: str


@router.post("/ussd/callback")
async def ussd_callback(
    body: UssdCallbackBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_africastalking_signature: Annotated[str | None, Header()] = None,
) -> PlainTextResponse:
    settings = get_settings()

    # IP allowlist check (SEC-06)
    if settings.ussd_allowed_ips:
        client_ip = request.client.host if request.client else ""
        if client_ip not in settings.ussd_allowed_ips:
            raise ForbiddenError("IP not allowed.")

    # Shared secret validation
    if settings.ussd_shared_secret and x_africastalking_signature:
        expected = hmac.new(
            settings.ussd_shared_secret.encode(),
            (await request.body()),
            digestmod=hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_africastalking_signature):
            raise UnauthorizedError("Invalid webhook signature.")

    redis = _get_redis()
    from app.core.security import hash_msisdn

    msisdn_hash = hash_msisdn(body.phoneNumber)
    key = session_key(msisdn_hash, body.sessionId)

    # Load session from Redis
    raw = await redis.get(key)
    session: UssdSession | None = None
    if raw:
        session = UssdSession.from_dict(json.loads(raw))

    # Resolve recommendation when user confirms (step=confirm, input=1)
    recommendation_result: dict | None = None
    parts = body.text.split("*") if body.text else [""]
    last_input = parts[-1].strip() if parts else ""
    if session and session.step == "confirm" and last_input == "1":
        recommendation_result = await _get_ussd_recommendation(db, session)

    # Process
    response_text, updated_session, is_end = process_ussd(
        session, body.sessionId, body.phoneNumber, body.text, recommendation_result
    )

    # Persist or delete session
    if is_end:
        await redis.delete(key)
    else:
        await redis.setex(
            key,
            settings.ussd_session_ttl_seconds,
            json.dumps(updated_session.to_dict()),
        )

    return PlainTextResponse(response_text)


async def _get_ussd_recommendation(db: AsyncSession, session: UssdSession) -> dict | None:
    """Run the rule engine for a USSD session and return the seasons result."""
    from app.api.v1.outlook import _resolve_cell
    from app.db.models import OutlookSnapshot
    from app.domain.rules.engine import EngineInputs, run_engine
    from app.domain.rules.loader import load_published_pack

    try:
        pack = load_published_pack()
    except RuntimeError:
        return None

    cell = await _resolve_cell(db, None, None, session.district_id, None)
    moisture_class = "normal"
    if cell:
        snap_result = await db.execute(
            select(OutlookSnapshot)
            .where(OutlookSnapshot.grid_cell_id == cell.id)
            .order_by(OutlookSnapshot.computed_at.desc())
            .limit(1)
        )
        snap = snap_result.scalar_one_or_none()
        if snap:
            moisture_class = snap.moisture_class

    season = "A" if 3 <= date.today().month <= 7 else "B"
    inputs = EngineInputs(
        previous_crops=[session.prev_crop] if session.prev_crop else ["other"],
        soil_type=session.soil_type or "unknown",
        goal=session.goal or "restore_soil",
        flags=session.flags,
        moisture_class=moisture_class,
        season=season,
        seasons_requested=3,
        language=session.language,
    )
    result = run_engine(inputs, pack)
    return {
        "seasons": [
            {
                "season": s.season,
                "crop": s.crop,
                "rationale": s.rationale,
                "window_start": s.window_start,
            }
            for s in result.seasons
        ]
    }


@router.post("/sms/delivery")
async def sms_delivery_receipt(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Africa's Talking delivery receipt webhook (FR-SMS-05)."""
    payload = await request.json()
    from app.ingestion.sms_provider import handle_delivery_receipt
    await handle_delivery_receipt(payload, db)
    return {"ok": True}


@router.post("/sms/inbound")
async def sms_inbound(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Africa's Talking inbound SMS webhook — handles STOP/YES/HELP (FR-SMS-06)."""
    payload = await request.json()
    from app.ingestion.sms_provider import handle_inbound_sms
    await handle_inbound_sms(payload, db)
    return {"ok": True}

