"""schema v1 - initial tables

Revision ID: 0001
Revises:
Create Date: 2026-11-23 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "grid_cells",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("centroid", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("district_id", sa.String(64), nullable=False, index=True),
        sa.Column("subcounty_id", sa.String(64), nullable=False, index=True),
        sa.Column("district_name", sa.String(128), nullable=False),
        sa.Column("subcounty_name", sa.String(128), nullable=False),
        sa.Column("resolution_deg", sa.Float, nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
    )

    op.create_table(
        "climate_daily",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("grid_cell_id", sa.String(64), sa.ForeignKey("grid_cells.id"), nullable=False),
        sa.Column("date", sa.DateTime(timezone=False), nullable=False),
        sa.Column("parameter", sa.String(64), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("product_version", sa.String(32), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("quality_flag", sa.String(16), nullable=False, server_default="ok"),
        sa.UniqueConstraint("grid_cell_id", "date", "parameter", "source"),
    )
    op.create_index("ix_climate_daily_cell_date", "climate_daily", ["grid_cell_id", "date"])

    op.create_table(
        "climatology",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("grid_cell_id", sa.String(64), sa.ForeignKey("grid_cells.id"), nullable=False),
        sa.Column("dekad", sa.SmallInteger, nullable=False),
        sa.Column("parameter", sa.String(64), nullable=False),
        sa.Column("p10", sa.Float, nullable=False),
        sa.Column("p25", sa.Float, nullable=False),
        sa.Column("p50", sa.Float, nullable=False),
        sa.Column("p75", sa.Float, nullable=False),
        sa.Column("p90", sa.Float, nullable=False),
        sa.Column("record_years", sa.SmallInteger, nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.UniqueConstraint("grid_cell_id", "dekad", "parameter", "source"),
    )

    op.create_table(
        "outlooks",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("grid_cell_id", sa.String(64), sa.ForeignKey("grid_cells.id"), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("season", sa.String(1), nullable=False),
        sa.Column("moisture_class", sa.String(16), nullable=False),
        sa.Column("onset_status", sa.String(32), nullable=False),
        sa.Column("onset_date", sa.DateTime(timezone=False), nullable=True),
        sa.Column("dry_spell_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("dry_spells_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("confidence", sa.String(16), nullable=False),
        sa.Column("data_age_hours", sa.Float, nullable=False),
        sa.Column("data_available", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("data_sources", JSONB, nullable=False, server_default="[]"),
        sa.Column("rainfall_30d", JSONB, nullable=False, server_default="[]"),
        sa.Column("rainfall_actual_total", sa.Float, nullable=False, server_default="0"),
        sa.Column("rainfall_normal_total", sa.Float, nullable=False, server_default="0"),
        sa.Column("seasonal_outlook", JSONB, nullable=True),
        sa.Column("notice_code", sa.String(32), nullable=True),
        sa.Column("notice", sa.Text, nullable=True),
        sa.Column("attribution", sa.Text, nullable=False, server_default=""),
    )

    op.create_table(
        "rule_packs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("version", sa.String(32), nullable=False, unique=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("yaml_document", sa.Text, nullable=False),
        sa.Column("pack_hash", sa.String(64), nullable=False),
        sa.Column("created_by", sa.String(64), nullable=False),
        sa.Column("approved_by", sa.String(64), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("golden_tests_passed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("golden_tests", JSONB, nullable=False, server_default="[]"),
        sa.Column("base_version", sa.String(32), nullable=True),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("msisdn_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("msisdn_encrypted", sa.Text, nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="farmer"),
        sa.Column("display_name", sa.String(128), nullable=True),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("district_id", sa.String(64), nullable=True),
        sa.Column("subcounty_ids", JSONB, nullable=False, server_default="[]"),
        sa.Column("consent_version", sa.String(32), nullable=True),
        sa.Column("mfa_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_msisdn_hash", "users", ["msisdn_hash"])

    op.create_table(
        "consents",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("channels", JSONB, nullable=False, server_default="[]"),
        sa.Column("data_sharing", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "plots",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("soil_type", sa.String(16), nullable=False),
        sa.Column("size_acres", sa.Float, nullable=False),
        sa.Column("previous_crops", JSONB, nullable=False, server_default="[]"),
        sa.Column("district_id", sa.String(64), nullable=True),
        sa.Column("subcounty_id", sa.String(64), nullable=True),
        sa.Column("grid_cell_id", sa.String(64), sa.ForeignKey("grid_cells.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "recommendations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("outlook_id", sa.String(64), sa.ForeignKey("outlooks.id"), nullable=True),
        sa.Column("pack_version", sa.String(32), nullable=False),
        sa.Column("inputs", JSONB, nullable=False),
        sa.Column("seasons", JSONB, nullable=False),
        sa.Column("rule_ids_fired", JSONB, nullable=False, server_default="[]"),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("idempotency_key", sa.String(128), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "feedback",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("recommendation_id", sa.String(64), sa.ForeignKey("recommendations.id"), nullable=False),
        sa.Column("user_id", sa.String(64), nullable=True),
        sa.Column("season", sa.String(1), nullable=False),
        sa.Column("followed", sa.Boolean, nullable=False),
        sa.Column("crop_planted", sa.String(32), nullable=False),
        sa.Column("rating", sa.String(16), nullable=True),
        sa.Column("thumbs", sa.String(8), nullable=True),
        sa.Column("reason_code", sa.String(64), nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("rule_ids", JSONB, nullable=False, server_default="[]"),
        sa.Column("idempotency_key", sa.String(128), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("actor", sa.String(64), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target", sa.String(128), nullable=False),
        sa.Column("detail", sa.Text, nullable=False, server_default=""),
        sa.Column("trace_id", sa.String(64), nullable=False, server_default=""),
    )
    # Audit log is append-only: block UPDATE and DELETE via trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_log_immutable()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log rows are immutable';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER audit_log_no_update
        BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
    """)

    op.create_table(
        "otp_requests",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("msisdn_hash", sa.String(64), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_otp_requests_msisdn_hash", "otp_requests", ["msisdn_hash"])

    op.create_table(
        "messages",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("template_key", sa.String(64), nullable=True),
        sa.Column("segments", sa.Integer, nullable=False, server_default="1"),
        sa.Column("encoding", sa.String(8), nullable=False, server_default="GSM-7"),
        sa.Column("delivery_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "field_observations",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("officer_id", sa.String(64), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plot_id", sa.String(64), sa.ForeignKey("plots.id"), nullable=True),
        sa.Column("farmer_ref", sa.String(64), nullable=True),
        sa.Column("crop_planted", sa.String(32), nullable=False),
        sa.Column("pest_sighting", sa.Text, nullable=True),
        sa.Column("disease_sighting", sa.Text, nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("field_observations")
    op.drop_table("messages")
    op.drop_table("otp_requests")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS audit_log_immutable()")
    op.drop_table("audit_log")
    op.drop_table("feedback")
    op.drop_table("recommendations")
    op.drop_table("plots")
    op.drop_table("consents")
    op.drop_table("users")
    op.drop_table("rule_packs")
    op.drop_table("outlooks")
    op.drop_table("climatology")
    op.drop_table("climate_daily")
    op.drop_table("grid_cells")

