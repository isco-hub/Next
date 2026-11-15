from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, require_roles
from app.channels.sms import count_segments, detect_encoding
from app.core.errors import ForbiddenError, NotFoundError
from app.db.models import ConsentRecord, FieldObservation, GridCell, OutlookSnapshot, Plot, Recommendation, User
from app.db.session import get_db

router = APIRouter()

OfficerOrAdmin = Depends(
    require_roles("extension_officer", "cooperative", "agronomist", "admin")
)


class AssistedRegistrationBody(BaseModel):
    farmer_name: str
    phone: str
    language: str = "en"
    subcounty_id: str
    consent: bool
    plot: dict


class FieldObservationBody(BaseModel):
    plot_id: str | None = None
    farmer_ref: str | None = None
    crop_planted: str
    pest_sighting: str | None = None
    disease_sighting: str | None = None
    note: str | None = None


class BulkSmsBody(BaseModel):
    subcounty_id: str
    message: str
    language: str = "en"


@router.post("/extension/register", status_code=201)
async def assisted_registration(
    body: AssistedRegistrationBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = OfficerOrAdmin,
) -> dict:
    from app.core.security import hash_msisdn

    if not body.consent:
        raise ForbiddenError("Consent must be given before registration.")

    # Scope check: officer must cover this subcounty
    officer_result = await db.execute(select(User).where(User.id == user.user_id))
    officer = officer_result.scalar_one_or_none()
    if officer and officer.subcounty_ids and body.subcounty_id not in officer.subcounty_ids:
        raise ForbiddenError("Officer not scoped to this sub-county.")

    msisdn_hash = hash_msisdn(body.phone)
    existing = await db.execute(select(User).where(User.msisdn_hash == msisdn_hash))
    farmer = existing.scalar_one_or_none()

    if farmer is None:
        farmer = User(
            id=str(uuid.uuid4()),
            msisdn_hash=msisdn_hash,
            msisdn_encrypted=msisdn_hash,
            role="farmer",
            display_name=body.farmer_name,
            language=body.language,
            subcounty_ids=[body.subcounty_id],
        )
        db.add(farmer)
        await db.flush()

    # Record consent
    consent_version = "1.0"
    consent = ConsentRecord(
        id=str(uuid.uuid4()),
        user_id=farmer.id,
        version=consent_version,
        channels=["sms", "ussd"],
        data_sharing=False,
        language=body.language,
    )
    db.add(consent)
    farmer.consent_version = consent_version

    # Create plot
    plot_data = body.plot
    plot = Plot(
        id=str(uuid.uuid4()),
        user_id=farmer.id,
        name=plot_data.get("name", "My Plot"),
        lat=plot_data["lat"],
        lon=plot_data["lon"],
        soil_type=plot_data.get("soil_type", "unknown"),
        size_acres=plot_data.get("size_acres", 1.0),
        previous_crops=plot_data.get("previous_crops", []),
        subcounty_id=body.subcounty_id,
    )
    db.add(plot)
    await db.flush()

    return {
        "farmer_ref": farmer.id,
        "plot_id": plot.id,
        "consent_version": consent_version,
        "message": f"Farmer {body.farmer_name} registered successfully.",
    }


@router.get("/extension/summary")
async def subcounty_summary(
    subcounty_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = OfficerOrAdmin,
):
    officer_result = await db.execute(select(User).where(User.id == user.user_id))
    officer = officer_result.scalar_one_or_none()
    subcounty_ids = officer.subcounty_ids if officer else []

    if subcounty_id:
        if user.role != "admin" and subcounty_id not in subcounty_ids:
            raise ForbiddenError("You can only view your assigned sub-counties.")
        subcounty_ids = [subcounty_id]

    summaries = []
    for sc_id in subcounty_ids:
        farmers_result = await db.execute(
            select(func.count(User.id)).where(User.subcounty_ids.contains([sc_id]))
        )
        farmers_count = farmers_result.scalar() or 0

        cell_result = await db.execute(
            select(GridCell).where(GridCell.subcounty_id == sc_id).limit(1)
        )
        cell = cell_result.scalar_one_or_none()

        moisture_class = "normal"
        onset_status = "unknown"
        updated_at = datetime.now(UTC).isoformat()

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
                onset_status = snap.onset_status
                updated_at = snap.computed_at.isoformat()

        # Top recommended crops (suppress if < 10 farmers)
        suppressed = farmers_count < 10
        recommended_crops: list[dict] = []
        if not suppressed:
            recs_result = await db.execute(
                select(Recommendation)
                .join(User, Recommendation.user_id == User.id)
                .where(User.subcounty_ids.contains([sc_id]))
                .order_by(Recommendation.created_at.desc())
                .limit(100)
            )
            crop_counts: dict[str, int] = {}
            for rec in recs_result.scalars().all():
                for s in rec.seasons[:1]:
                    crop = s.get("crop", "")
                    crop_counts[crop] = crop_counts.get(crop, 0) + 1
            recommended_crops = [
                {"crop": c, "count": n}
                for c, n in sorted(crop_counts.items(), key=lambda x: -x[1])[:3]
            ]

        summaries.append({
            "district_id": officer.district_id or "",
            "subcounty_id": sc_id,
            "subcounty_name": sc_id.replace("_", " ").title(),
            "farmers_count": farmers_count,
            "moisture_class": moisture_class,
            "onset_status": onset_status,
            "updated_at": updated_at,
            "recommended_crops": recommended_crops,
            "suppressed": suppressed,
        })

    if subcounty_id:
        return summaries[0] if summaries else None
    return summaries


@router.get("/extension/observations")
async def list_observations(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = OfficerOrAdmin,
) -> list[dict]:
    query = select(FieldObservation).order_by(FieldObservation.observed_at.desc()).limit(200)
    if user.role != "admin":
        query = query.where(FieldObservation.officer_id == user.user_id)
    result = await db.execute(query)
    return [
        {
            "id": obs.id,
            "officer_id": obs.officer_id,
            "plot_id": obs.plot_id,
            "farmer_ref": obs.farmer_ref,
            "crop_planted": obs.crop_planted,
            "pest_sighting": obs.pest_sighting,
            "disease_sighting": obs.disease_sighting,
            "note": obs.note,
            "observed_at": obs.observed_at.isoformat(),
        }
        for obs in result.scalars().all()
    ]


@router.post("/extension/observations", status_code=201)
async def create_observation(
    body: FieldObservationBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = OfficerOrAdmin,
) -> dict:
    obs = FieldObservation(
        id=str(uuid.uuid4()),
        officer_id=user.user_id,
        plot_id=body.plot_id,
        farmer_ref=body.farmer_ref,
        crop_planted=body.crop_planted,
        pest_sighting=body.pest_sighting,
        disease_sighting=body.disease_sighting,
        note=body.note,
    )
    db.add(obs)
    await db.flush()
    return {
        "id": obs.id,
        "officer_id": obs.officer_id,
        "plot_id": obs.plot_id,
        "farmer_ref": obs.farmer_ref,
        "crop_planted": obs.crop_planted,
        "pest_sighting": obs.pest_sighting,
        "disease_sighting": obs.disease_sighting,
        "note": obs.note,
        "observed_at": obs.observed_at.isoformat(),
    }


@router.post("/extension/bulk-sms")
async def bulk_sms(
    body: BulkSmsBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = OfficerOrAdmin,
) -> dict:
    # Count eligible recipients (consented to SMS)
    consents_result = await db.execute(
        select(ConsentRecord)
        .join(User, ConsentRecord.user_id == User.id)
        .where(User.subcounty_ids.contains([body.subcounty_id]))
        .where(ConsentRecord.withdrawn_at.is_(None))
    )
    consents = consents_result.scalars().all()
    eligible = [c for c in consents if "sms" in (c.channels or [])]
    total = len(eligible)
    suppressed = max(0, len(consents) - total)

    encoding, char_count, segments = count_segments(body.message)

    # Dispatch SMS to all eligible recipients
    dispatched = 0
    failed = 0
    for consent in eligible:
        if not consent.user_id:
            continue
        user_result = await db.execute(select(User).where(User.id == consent.user_id))
        farmer = user_result.scalar_one_or_none()
        if not farmer:
            continue
        from app.ingestion.sms_provider import send_sms_if_allowed
        result = await send_sms_if_allowed(
            db, farmer.id, farmer.msisdn_encrypted,
            "bulk", {}, body.language,
        )
        if result:
            dispatched += 1
        else:
            failed += 1

    return {
        "recipients": total,
        "suppressed": suppressed,
        "dispatched": dispatched,
        "failed": failed,
        "encoding": encoding,
        "segments_per_message": segments,
        "total_segments": total * segments,
    }
