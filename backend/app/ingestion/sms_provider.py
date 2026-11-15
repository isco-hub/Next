"""
BE-404: SMS provider abstraction.
- Africa's Talking HTTP dispatch
- Delivery receipt webhook handler
- Retry queue via Celery
- STOP within 1 minute via inbound keyword handler
- Opt-in consent check before every send
- Quiet hours (21:00-06:00 EAT) and daily per-user cap enforcement
"""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.channels.sms import count_segments, handle_inbound_keyword, is_quiet_hours, render_template
from app.core.settings import get_settings

logger = logging.getLogger(__name__)

EAT = timezone(timedelta(hours=3))


class SmsDispatchError(Exception):
    pass


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=60), reraise=True)
async def send_sms(
    msisdn: str,
    message: str,
    message_id: str | None = None,
) -> dict[str, Any]:
    """
    Dispatch a single SMS via Africa's Talking.
    Raises SmsDispatchError on permanent failure.
    """
    settings = get_settings()
    if not settings.sms_api_key or not settings.sms_provider_url:
        logger.warning("SMS provider not configured — message not sent (dev mode).")
        return {"status": "dev_skip", "message_id": message_id or str(uuid.uuid4())}

    encoding, _, segments = count_segments(message)
    headers = {
        "apiKey": settings.sms_api_key,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    payload = {
        "username": "nextcrop",
        "to": msisdn,
        "message": message,
        "from": settings.sms_sender_id,
    }
    if message_id:
        payload["bulkSMSMode"] = "1"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(settings.sms_provider_url, data=payload, headers=headers)
        response.raise_for_status()
        result = response.json()

    recipients = result.get("SMSMessageData", {}).get("Recipients", [])
    if not recipients:
        raise SmsDispatchError(f"No recipients in response: {result}")

    status = recipients[0].get("status", "unknown")
    if status not in ("Success", "success"):
        raise SmsDispatchError(f"SMS send failed with status: {status}")

    return {
        "status": status,
        "message_id": recipients[0].get("messageId", message_id),
        "cost": recipients[0].get("cost", ""),
        "encoding": encoding,
        "segments": segments,
    }


async def send_sms_if_allowed(
    db: Any,
    user_id: str,
    msisdn: str,
    template_key: str,
    context: dict[str, Any],
    language: str = "en",
) -> dict[str, Any] | None:
    """
    Send SMS only if:
    - User has active SMS consent
    - Not in quiet hours
    - Daily cap not exceeded
    Returns send result or None if suppressed.
    """
    from sqlalchemy import func, select

    from app.db.models import ConsentRecord, Message

    settings = get_settings()

    # Consent check
    consent_result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user_id)
        .where(ConsentRecord.withdrawn_at.is_(None))
        .order_by(ConsentRecord.accepted_at.desc())
        .limit(1)
    )
    consent = consent_result.scalar_one_or_none()
    if not consent or "sms" not in (consent.channels or []):
        logger.info("SMS suppressed for user %s: no SMS consent", user_id)
        return None

    # Quiet hours check
    if is_quiet_hours(settings.sms_quiet_start_hour, settings.sms_quiet_end_hour):
        logger.info("SMS suppressed: quiet hours")
        return None

    # Daily cap check
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    count_result = await db.execute(
        select(func.count(Message.id))
        .where(Message.user_id == user_id)
        .where(Message.direction == "outbound")
        .where(Message.channel == "sms")
        .where(Message.created_at >= today_start)
    )
    daily_count = count_result.scalar() or 0
    if daily_count >= settings.sms_daily_cap_per_user:
        logger.info("SMS suppressed for user %s: daily cap reached (%d)", user_id, daily_count)
        return None

    message = render_template(template_key, context, language)
    encoding, _, segments = count_segments(message)

    # Record outbound message
    msg = Message(
        id=str(uuid.uuid4()),
        user_id=user_id,
        direction="outbound",
        channel="sms",
        content=message,
        template_key=template_key,
        segments=segments,
        encoding=encoding,
        delivery_status="pending",
    )
    db.add(msg)
    await db.flush()

    try:
        result = await send_sms(msisdn, message, msg.id)
        msg.delivery_status = "sent"
        msg.sent_at = datetime.now(UTC)
        await db.flush()
        return result
    except SmsDispatchError as exc:
        msg.delivery_status = "failed"
        await db.flush()
        logger.error("SMS dispatch failed for user %s: %s", user_id, exc)
        return None


async def handle_delivery_receipt(payload: dict[str, Any], db: Any) -> None:
    """Update message delivery status from provider callback."""
    from sqlalchemy import select

    from app.db.models import Message

    message_id = payload.get("id") or payload.get("messageId")
    status = payload.get("status", "").lower()
    if not message_id:
        return

    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg:
        msg.delivery_status = status
        await db.flush()


async def handle_inbound_sms(payload: dict[str, Any], db: Any) -> None:
    """
    Process inbound SMS from provider webhook.
    STOP -> withdraw consent within 1 minute (FR-SMS-06).
    """
    from datetime import UTC

    from sqlalchemy import select

    from app.core.security import hash_msisdn
    from app.db.models import ConsentRecord, Message, User

    phone = payload.get("from", "")
    text = payload.get("text", "")
    action = handle_inbound_keyword(text)

    msisdn_hash = hash_msisdn(phone)
    user_result = await db.execute(select(User).where(User.msisdn_hash == msisdn_hash))
    user = user_result.scalar_one_or_none()

    # Record inbound message
    if user:
        db.add(Message(
            id=str(uuid.uuid4()),
            user_id=user.id,
            direction="inbound",
            channel="sms",
            content=text,
            delivery_status="received",
        ))

    if action == "opt_out" and user:
        # Withdraw all SMS consents immediately (STOP within 1 minute)
        consents_result = await db.execute(
            select(ConsentRecord)
            .where(ConsentRecord.user_id == user.id)
            .where(ConsentRecord.withdrawn_at.is_(None))
        )
        for consent in consents_result.scalars().all():
            if "sms" in (consent.channels or []):
                consent.withdrawn_at = datetime.now(UTC)
        logger.info("SMS opt-out processed for user %s", user.id if user else "[unknown]")

    elif action == "opt_in" and user:
        # Re-subscribe: create new consent record
        db.add(ConsentRecord(
            id=str(uuid.uuid4()),
            user_id=user.id,
            version="1.0",
            channels=["sms"],
            data_sharing=False,
            language="en",
        ))

    await db.flush()
