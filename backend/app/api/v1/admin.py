from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, require_roles
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.db.models import AuditLog, RulePack
from app.db.session import get_db
from app.domain.rules.engine import EngineInputs, run_engine
from app.domain.rules.loader import compute_hash, load_pack

router = APIRouter()

AgronomistOrAdmin = Depends(require_roles("agronomist", "admin"))


class RulePackBody(BaseModel):
    version: str
    yaml_document: str
    base_version: str | None = None


class RulePackUpdateBody(BaseModel):
    yaml_document: str


class SimulationBody(BaseModel):
    previous_crops: list[str]
    soil_type: str
    goal: str
    flags: list[str] = []
    seasons: int = 4
    language: str = "en"
    channel: str = "web"
    start_season: str | None = None


@router.get("/admin/rule-packs")
async def list_packs(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> list[dict]:
    result = await db.execute(select(RulePack).order_by(RulePack.created_at.desc()))
    return [_pack_dict(p) for p in result.scalars().all()]


@router.get("/admin/rule-packs/{pack_id}")
async def get_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    pack = await _get_pack(db, pack_id)
    return _pack_dict(pack)


@router.patch("/admin/rule-packs/{pack_id}")
async def update_pack(
    pack_id: str,
    body: RulePackUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    pack = await _get_pack(db, pack_id)
    if pack.status != "draft":
        raise ConflictError("Only draft packs can be edited.")
    try:
        load_pack(body.yaml_document)
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc
    pack.yaml_document = body.yaml_document
    pack.pack_hash = compute_hash(body.yaml_document)
    await _audit(db, user.user_id, "update_pack", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs", status_code=201)
async def create_pack(
    body: RulePackBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    try:
        load_pack(body.yaml_document)
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc

    existing = await db.execute(select(RulePack).where(RulePack.version == body.version))
    if existing.scalar_one_or_none():
        raise ConflictError(f"Version {body.version} already exists.")

    pack = RulePack(
        id=str(uuid.uuid4()),
        version=body.version,
        status="draft",
        yaml_document=body.yaml_document,
        pack_hash=compute_hash(body.yaml_document),
        created_by=user.user_id,
        base_version=body.base_version,
    )
    db.add(pack)
    await _audit(db, user.user_id, "create_pack", f"rule_pack:{pack.id}", body.version)
    await db.flush()
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/submit-review")
async def submit_for_review(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    pack = await _get_pack(db, pack_id)
    if pack.status != "draft":
        raise ConflictError("Only draft packs can be submitted for review.")
    pack.status = "in_review"
    await _audit(db, user.user_id, "submit_review", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/approve")
async def approve_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_roles("agronomist", "admin")),
) -> dict:
    pack = await _get_pack(db, pack_id)
    if pack.status != "in_review":
        raise ConflictError("Only packs in review can be approved.")
    # Two-person rule: approver must differ from creator (FR-ADM-05)
    if pack.created_by == user.user_id:
        raise ForbiddenError("The creator cannot approve their own pack.")
    pack.status = "approved"
    pack.approved_by = user.user_id
    await _audit(db, user.user_id, "approve_pack", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/publish")
async def publish_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin")),
) -> dict:
    pack = await _get_pack(db, pack_id)
    if pack.status != "approved":
        raise ConflictError("Only approved packs can be published.")

    golden_passed, golden_results = _run_golden_tests(pack.yaml_document)
    pack.golden_tests_passed = golden_passed
    pack.golden_tests = golden_results
    if not golden_passed:
        raise ValidationAppError("Golden tests failed. Fix the pack before publishing.")

    current_result = await db.execute(select(RulePack).where(RulePack.status == "published"))
    for current in current_result.scalars().all():
        current.status = "archived"

    pack.status = "published"
    pack.published_at = datetime.now(UTC)
    await _audit(db, user.user_id, "publish_pack", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/rollback")
async def rollback_pack(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin")),
) -> dict:
    pack = await _get_pack(db, pack_id)
    if pack.status not in ("archived", "approved"):
        raise ConflictError("Can only rollback archived or approved packs.")

    current_result = await db.execute(select(RulePack).where(RulePack.status == "published"))
    for current in current_result.scalars().all():
        current.status = "archived"

    pack.status = "published"
    pack.published_at = datetime.now(UTC)
    await _audit(db, user.user_id, "rollback_pack", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/golden-tests")
async def run_golden_tests(
    pack_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    pack = await _get_pack(db, pack_id)
    passed, results = _run_golden_tests(pack.yaml_document)
    pack.golden_tests_passed = passed
    pack.golden_tests = results
    await _audit(db, user.user_id, "run_golden_tests", f"rule_pack:{pack_id}", pack.version)
    await db.flush()
    await db.refresh(pack)
    return _pack_dict(pack)


@router.post("/admin/rule-packs/{pack_id}/simulate")
async def simulate_pack(
    pack_id: str,
    body: SimulationBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = AgronomistOrAdmin,
) -> dict:
    pack = await _get_pack(db, pack_id)
    try:
        pack_data = load_pack(pack.yaml_document)
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc

    inputs = EngineInputs(
        previous_crops=body.previous_crops,
        soil_type=body.soil_type,
        goal=body.goal,
        flags=body.flags,
        moisture_class="normal",
        season=body.start_season or "A",
        seasons_requested=body.seasons,
        language=body.language,
    )
    result = run_engine(inputs, pack_data)

    return {
        "pack_version": pack.version,
        "seasons": [
            {
                "season_index": s.season_index,
                "season": s.season,
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
        ],
        "trace": [
            {"season_index": t.season_index, "candidates": t.candidates}
            for t in result.trace
        ],
    }


@router.get("/admin/audit-log")
async def get_audit_log(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_roles("admin")),
) -> list[dict]:
    result = await db.execute(select(AuditLog).order_by(AuditLog.at.desc()).limit(200))
    return [
        {
            "id": e.id,
            "at": e.at.isoformat(),
            "actor": e.actor,
            "action": e.action,
            "target": e.target,
            "detail": e.detail,
            "trace_id": e.trace_id,
        }
        for e in result.scalars().all()
    ]


async def _get_pack(db: AsyncSession, pack_id: str) -> RulePack:
    result = await db.execute(select(RulePack).where(RulePack.id == pack_id))
    pack = result.scalar_one_or_none()
    if pack is None:
        raise NotFoundError(f"Rule pack {pack_id} not found.")
    return pack


async def _audit(db: AsyncSession, actor: str, action: str, target: str, detail: str) -> None:
    db.add(AuditLog(id=str(uuid.uuid4()), actor=actor, action=action, target=target, detail=detail))


def _pack_dict(p: RulePack) -> dict:
    return {
        "id": p.id,
        "version": p.version,
        "status": p.status,
        "yaml_document": p.yaml_document,
        "created_by": p.created_by,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "approved_by": p.approved_by,
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "pack_hash": p.pack_hash,
        "golden_tests_passed": p.golden_tests_passed,
        "golden_tests": p.golden_tests,
        "base_version": p.base_version,
    }


def _run_golden_tests(yaml_document: str) -> tuple[bool, list[dict]]:
    from tests.golden.cases import GOLDEN_CASES

    try:
        pack = load_pack(yaml_document)
    except ValueError:
        return False, []

    results = []
    all_passed = True
    for case in GOLDEN_CASES:
        inputs = EngineInputs(**case["inputs"])
        result = run_engine(inputs, pack)
        actual_crop = result.seasons[0].crop if result.seasons else ""
        passed = actual_crop == case["expected_first_crop"]
        if not passed:
            all_passed = False
        results.append({
            "id": case["id"],
            "scenario": case["scenario"],
            "expected": case["expected_first_crop"],
            "actual": actual_crop,
            "pass": passed,
        })
    return all_passed, results
