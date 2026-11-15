from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, get_current_user
from app.core.errors import RateLimitError, UnauthorizedError, ValidationAppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    encrypt_msisdn,
    generate_otp,
    hash_msisdn,
    hash_token,
    is_ugandan_number,
)
from app.core.settings import get_settings
from app.db.models import AuthSession, ConsentRecord, OtpRequest, Plot, Recommendation, User
from app.db.session import get_db

router = APIRouter()


class OtpRequestBody(BaseModel):
    phone: str
    purpose: Literal["signin", "signup"] = "signin"
    role: Literal["farmer", "extension_officer", "cooperative", "agronomist", "admin"] | None = None
    display_name: str | None = Field(default=None, max_length=128)
    language: str = "en"
    district_id: str | None = None
    subcounty_ids: list[str] = Field(default_factory=list)


class OtpVerifyBody(BaseModel):
    request_id: str
    code: str


class RefreshBody(BaseModel):
    refresh_token: str


class ConsentBody(BaseModel):
    version: str
    channels: list[str]
    data_sharing: bool
    language: str = "en"


@router.post("/auth/otp/request", status_code=200)
async def request_otp(
    body: OtpRequestBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()

    if not is_ugandan_number(body.phone):
        raise ValidationAppError("Phone number must be a valid Ugandan number.")

    msisdn_hash = hash_msisdn(body.phone)
    client_ip = request.client.host if request.client else "unknown"
    request_ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    # Rate limit: max OTPs per number and per source address each hour.
    cutoff = datetime.now(UTC) - timedelta(hours=1)
    result = await db.execute(
        select(OtpRequest)
        .where(OtpRequest.msisdn_hash == msisdn_hash)
        .where(OtpRequest.created_at >= cutoff)
    )
    recent = result.scalars().all()
    if len(recent) >= settings.rate_limit_otp_per_number_per_hour:
        raise RateLimitError("Too many OTP requests. Try again later.")

    ip_result = await db.execute(
        select(OtpRequest)
        .where(OtpRequest.request_ip_hash == request_ip_hash)
        .where(OtpRequest.created_at >= cutoff)
    )
    if len(ip_result.scalars().all()) >= settings.rate_limit_otp_per_ip_per_hour:
        raise RateLimitError("Too many OTP requests from this network. Try again later.")

    existing_user = await db.execute(
        select(User).where(User.msisdn_hash == msisdn_hash)
    )
    user = existing_user.scalar_one_or_none()
    if body.purpose == "signin" and user is None:
        raise ValidationAppError("No account found for this number. Create an account first.")
    if user is not None and body.role is not None and user.role != body.role:
        raise ValidationAppError(
            "This phone is not registered with the selected role."
        )
    if user is None and body.role not in (None, "farmer"):
        raise ValidationAppError(
            "Staff accounts are created by the NextCrop administrator."
        )

    code = generate_otp()
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.otp_expire_seconds)

    otp = OtpRequest(
        id=str(uuid.uuid4()),
        msisdn_hash=msisdn_hash,
        msisdn_encrypted=encrypt_msisdn(body.phone),
        code_hash=code_hash,
        purpose=body.purpose,
        display_name=body.display_name,
        language=body.language,
        district_id=body.district_id,
        subcounty_ids=body.subcounty_ids,
        request_ip_hash=request_ip_hash,
        expires_at=expires_at,
    )
    db.add(otp)
    await db.flush()

    # Send OTP via SMS provider. In local development, surface the code so the
    # passwordless flow can be tested without a live SMS provider.
    import logging
    _log = logging.getLogger(__name__)
    dev_code: str | None = None
    try:
        from app.channels.sms import render_template
        from app.ingestion.sms_provider import send_sms
        message = render_template("sms.otp", {"code": code}, "en")
        send_result = await send_sms(body.phone, message, otp.id)
        if send_result.get("status") == "dev_skip" and settings.environment != "production":
            dev_code = code
            _log.info("OTP for [PHONE]: %s (dev only)", code)
    except Exception as exc:
        _log.warning("OTP SMS send failed (dev mode or provider not configured): %s", exc)
        if settings.environment != "production":
            dev_code = code
            _log.info("OTP for [PHONE]: %s (dev only)", code)

    return {
        "request_id": otp.id,
        "expires_in_seconds": settings.otp_expire_seconds,
        "channel": "sms",
        "dev_code": dev_code,
    }


@router.post("/auth/otp/verify", status_code=200)
async def verify_otp(
    body: OtpVerifyBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()

    result = await db.execute(
        select(OtpRequest).where(OtpRequest.id == body.request_id)
    )
    otp = result.scalar_one_or_none()
    if otp is None or otp.used:
        raise UnauthorizedError("Invalid or expired OTP request.")

    if datetime.now(UTC) > otp.expires_at:
        raise UnauthorizedError("OTP has expired.")

    if otp.attempts >= settings.otp_max_attempts:
        raise RateLimitError("Too many failed attempts.")

    code_hash = hashlib.sha256(body.code.encode()).hexdigest()
    if code_hash != otp.code_hash:
        otp.attempts += 1
        await db.flush()
        raise UnauthorizedError("Invalid OTP code.")

    otp.used = True
    await db.flush()

    user_result = await db.execute(
        select(User).where(User.msisdn_hash == otp.msisdn_hash)
    )
    user = user_result.scalar_one_or_none()
    if user is None:
        if otp.purpose != "signup":
            raise UnauthorizedError("No account found for this number.")
        user = User(
            id=str(uuid.uuid4()),
            msisdn_hash=otp.msisdn_hash,
            msisdn_encrypted=otp.msisdn_encrypted,
            role="farmer",
            display_name=otp.display_name,
            language=otp.language,
            district_id=otp.district_id,
            subcounty_ids=otp.subcounty_ids,
        )
        db.add(user)
        await db.flush()
    elif otp.purpose == "signup" and otp.display_name and not user.display_name:
        user.display_name = otp.display_name

    session_id = str(uuid.uuid4())
    refresh_token = create_refresh_token(user.id, session_id)
    refresh_expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        AuthSession(
            id=session_id,
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            expires_at=refresh_expires,
        )
    )
    await db.flush()

    return _session_response(user, session_id, refresh_token, refresh_expires)


@router.post("/auth/refresh", status_code=200)
async def refresh_session(
    body: RefreshBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    settings = get_settings()
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as exc:
        raise UnauthorizedError("Invalid refresh token.") from exc
    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid refresh token.")

    session_result = await db.execute(
        select(AuthSession).where(AuthSession.id == payload.get("sid", ""))
    )
    auth_session = session_result.scalar_one_or_none()
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or auth_session.refresh_token_hash != hash_token(body.refresh_token)
        or datetime.now(UTC) > auth_session.expires_at
    ):
        raise UnauthorizedError("Session has expired. Sign in again.")

    user_result = await db.execute(
        select(User).where(User.id == auth_session.user_id)
    )
    user = user_result.scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("Account no longer exists.")

    auth_session.revoked_at = datetime.now(UTC)
    new_session_id = str(uuid.uuid4())
    refresh_token = create_refresh_token(user.id, new_session_id)
    refresh_expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        AuthSession(
            id=new_session_id,
            user_id=user.id,
            refresh_token_hash=hash_token(refresh_token),
            expires_at=refresh_expires,
        )
    )
    await db.flush()
    return _session_response(user, new_session_id, refresh_token, refresh_expires)


@router.get("/auth/me")
async def me(
    db: AsyncSession = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> dict:
    result = await db.execute(select(User).where(User.id == current.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("Account no longer exists.")
    return _user_dict(user)


@router.delete("/auth/session", status_code=204)
async def sign_out(
    db: AsyncSession = Depends(get_db),
    current: CurrentUser = Depends(get_current_user),
) -> None:
    session_id = current.payload.get("sid")
    if session_id:
        result = await db.execute(
            select(AuthSession).where(AuthSession.id == session_id)
        )
        auth_session = result.scalar_one_or_none()
        if auth_session is not None:
            auth_session.revoked_at = datetime.now(UTC)
    await db.flush()


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "role": user.role,
        "display_name": user.display_name,
        "language": user.language,
        "district_id": user.district_id,
        "subcounty_ids": user.subcounty_ids,
        "consent_version": user.consent_version,
        "mfa_required": user.mfa_required,
    }


def _session_response(
    user: User, session_id: str, refresh_token: str, refresh_expires: datetime
) -> dict:
    settings = get_settings()
    access_token = create_access_token(
        user.id, user.role, extra={"sid": session_id}
    )
    return {
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": _user_dict(user),
        "expires_at": (
            datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
        ).isoformat(),
        "refresh_expires_at": refresh_expires.isoformat(),
    }


@router.post("/auth/consent", status_code=201)
async def record_consent(
    body: ConsentBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    consent = ConsentRecord(
        id=str(uuid.uuid4()),
        user_id=user.user_id,
        version=body.version,
        channels=body.channels,
        data_sharing=body.data_sharing,
        language=body.language,
    )
    db.add(consent)

    # Update user consent version
    user_result = await db.execute(select(User).where(User.id == user.user_id))
    db_user = user_result.scalar_one_or_none()
    if db_user:
        db_user.consent_version = body.version
    await db.flush()

    return {
        "id": consent.id,
        "user_id": user.user_id,
        "version": body.version,
        "channels": body.channels,
        "data_sharing": body.data_sharing,
        "language": body.language,
        "accepted_at": datetime.now(UTC).isoformat(),
        "withdrawn_at": None,
    }


@router.get("/auth/me/data-rights")
async def data_rights(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    user_result = await db.execute(select(User).where(User.id == user.user_id))
    db_user = user_result.scalar_one_or_none()

    plots_result = await db.execute(select(Plot).where(Plot.user_id == user.user_id))
    plots = plots_result.scalars().all()

    recs_result = await db.execute(
        select(Recommendation).where(Recommendation.user_id == user.user_id).limit(100)
    )
    recs = recs_result.scalars().all()

    consents_result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.user_id == user.user_id)
    )
    consents = consents_result.scalars().all()

    return {
        "user": {
            "id": db_user.id if db_user else user.user_id,
            "role": db_user.role if db_user else "farmer",
            "display_name": db_user.display_name if db_user else None,
            "language": db_user.language if db_user else "en",
            "district_id": db_user.district_id if db_user else None,
            "subcounty_ids": db_user.subcounty_ids if db_user else [],
            "consent_version": db_user.consent_version if db_user else None,
            "mfa_required": db_user.mfa_required if db_user else False,
        },
        "plots": [
            {
                "id": p.id, "name": p.name, "lat": p.lat, "lon": p.lon,
                "soil_type": p.soil_type, "size_acres": p.size_acres,
                "previous_crops": p.previous_crops,
            }
            for p in plots
        ],
        "recommendations": [
            {
                "id": r.id, "created_at": r.created_at.isoformat(),
                "pack_version": r.pack_version,
                "crops": [s["crop"] for s in r.seasons],
                "season": r.seasons[0]["season"] if r.seasons else "A",
            }
            for r in recs
        ],
        "consents": [
            {
                "id": c.id, "version": c.version, "channels": c.channels,
                "data_sharing": c.data_sharing, "language": c.language,
                "accepted_at": c.accepted_at.isoformat(),
                "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None,
            }
            for c in consents
        ],
    }


@router.delete("/auth/me", status_code=204)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Data subject deletion right (FR-AUT-04, DPPA)."""
    from sqlalchemy import delete as sql_delete

    await db.execute(sql_delete(Plot).where(Plot.user_id == user.user_id))
    await db.execute(
        sql_delete(ConsentRecord).where(ConsentRecord.user_id == user.user_id)
    )
    await db.execute(sql_delete(User).where(User.id == user.user_id))

