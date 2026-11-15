from __future__ import annotations

import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class GridCell(Base):
    __tablename__ = "grid_cells"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    centroid: Mapped[object] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    district_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    subcounty_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    district_name: Mapped[str] = mapped_column(String(128), nullable=False)
    subcounty_name: Mapped[str] = mapped_column(String(128), nullable=False)
    resolution_deg: Mapped[float] = mapped_column(Float, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)

    climate_records: Mapped[list[ClimateDaily]] = relationship(back_populates="grid_cell")
    outlooks: Mapped[list[OutlookSnapshot]] = relationship(back_populates="grid_cell")


class ClimateDaily(Base):
    __tablename__ = "climate_daily"
    __table_args__ = (
        UniqueConstraint("grid_cell_id", "date", "parameter", "source"),
        Index("ix_climate_daily_cell_date", "grid_cell_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grid_cell_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("grid_cells.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date(), nullable=False)
    parameter: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    product_version: Mapped[str] = mapped_column(String(32), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    quality_flag: Mapped[str] = mapped_column(String(16), nullable=False, default="ok")

    grid_cell: Mapped[GridCell] = relationship(back_populates="climate_records")


class Climatology(Base):
    __tablename__ = "climatology"
    __table_args__ = (UniqueConstraint("grid_cell_id", "dekad", "parameter", "source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grid_cell_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("grid_cells.id"), nullable=False
    )
    dekad: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1-36
    parameter: Mapped[str] = mapped_column(String(64), nullable=False)
    p10: Mapped[float] = mapped_column(Float, nullable=False)
    p25: Mapped[float] = mapped_column(Float, nullable=False)
    p50: Mapped[float] = mapped_column(Float, nullable=False)
    p75: Mapped[float] = mapped_column(Float, nullable=False)
    p90: Mapped[float] = mapped_column(Float, nullable=False)
    record_years: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)


class OutlookSnapshot(Base):
    __tablename__ = "outlooks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    grid_cell_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("grid_cells.id"), nullable=False
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    season: Mapped[str] = mapped_column(String(1), nullable=False)
    moisture_class: Mapped[str] = mapped_column(String(16), nullable=False)
    onset_status: Mapped[str] = mapped_column(String(32), nullable=False)
    onset_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    dry_spell_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dry_spells_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    data_age_hours: Mapped[float] = mapped_column(Float, nullable=False)
    data_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    data_sources: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    rainfall_30d: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    rainfall_actual_total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    rainfall_normal_total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    seasonal_outlook: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notice_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    attribution: Mapped[str] = mapped_column(Text, nullable=False, default="")

    grid_cell: Mapped[GridCell] = relationship(back_populates="outlooks")
    recommendations: Mapped[list[Recommendation]] = relationship(back_populates="outlook")


class RulePack(Base):
    __tablename__ = "rule_packs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    version: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    yaml_document: Mapped[str] = mapped_column(Text, nullable=False)
    pack_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    golden_tests_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    golden_tests: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    base_version: Mapped[str | None] = mapped_column(String(32), nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    msisdn_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    msisdn_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="farmer")
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    district_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subcounty_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    consent_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mfa_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    plots: Mapped[list[Plot]] = relationship(back_populates="user")
    consents: Mapped[list[ConsentRecord]] = relationship(back_populates="user")
    recommendations: Mapped[list[Recommendation]] = relationship(back_populates="user")


class ConsentRecord(Base):
    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=True
    )
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    channels: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    data_sharing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User | None] = relationship(back_populates="consents")


class Plot(Base):
    __tablename__ = "plots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    soil_type: Mapped[str] = mapped_column(String(16), nullable=False)
    size_acres: Mapped[float] = mapped_column(Float, nullable=False)
    previous_crops: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    district_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subcounty_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    grid_cell_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("grid_cells.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="plots")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=True
    )
    outlook_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("outlooks.id"), nullable=True
    )
    pack_version: Mapped[str] = mapped_column(String(32), nullable=False)
    inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    seasons: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)
    rule_ids_fired: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User | None] = relationship(back_populates="recommendations")
    outlook: Mapped[OutlookSnapshot | None] = relationship(back_populates="recommendations")
    feedbacks: Mapped[list[Feedback]] = relationship(back_populates="recommendation")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    recommendation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("recommendations.id"), nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    season: Mapped[str] = mapped_column(String(1), nullable=False)
    followed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    crop_planted: Mapped[str] = mapped_column(String(32), nullable=False)
    rating: Mapped[str | None] = mapped_column(String(16), nullable=True)
    thumbs: Mapped[str | None] = mapped_column(String(8), nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    recommendation: Mapped[Recommendation] = relationship(back_populates="feedbacks")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class OtpRequest(Base):
    __tablename__ = "otp_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    msisdn_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    msisdn_encrypted: Mapped[str] = mapped_column(Text, nullable=False, default="")
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purpose: Mapped[str] = mapped_column(String(16), nullable=False, default="signin")
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    district_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subcounty_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    request_ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=False, index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # inbound/outbound
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    template_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    segments: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    encoding: Mapped[str] = mapped_column(String(8), nullable=False, default="GSM-7")
    delivery_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FieldObservation(Base):
    __tablename__ = "field_observations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    officer_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), nullable=False)
    plot_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("plots.id"), nullable=True
    )
    farmer_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    crop_planted: Mapped[str] = mapped_column(String(32), nullable=False)
    pest_sighting: Mapped[str | None] = mapped_column(Text, nullable=True)
    disease_sighting: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
