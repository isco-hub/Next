"""auth sessions and richer OTP requests

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-15 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "otp_requests",
        sa.Column("msisdn_encrypted", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "otp_requests",
        sa.Column("purpose", sa.String(16), nullable=False, server_default="signin"),
    )
    op.add_column("otp_requests", sa.Column("display_name", sa.String(128), nullable=True))
    op.add_column(
        "otp_requests",
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
    )
    op.add_column("otp_requests", sa.Column("district_id", sa.String(64), nullable=True))
    op.add_column(
        "otp_requests",
        sa.Column("subcounty_ids", JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column("otp_requests", sa.Column("request_ip_hash", sa.String(64), nullable=True))
    op.create_index(
        "ix_otp_requests_request_ip_hash", "otp_requests", ["request_ip_hash"]
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("refresh_token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index(
        "ix_auth_sessions_refresh_token_hash",
        "auth_sessions",
        ["refresh_token_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_refresh_token_hash", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("ix_otp_requests_request_ip_hash", table_name="otp_requests")
    op.drop_column("otp_requests", "request_ip_hash")
    op.drop_column("otp_requests", "subcounty_ids")
    op.drop_column("otp_requests", "district_id")
    op.drop_column("otp_requests", "language")
    op.drop_column("otp_requests", "display_name")
    op.drop_column("otp_requests", "purpose")
    op.drop_column("otp_requests", "msisdn_encrypted")

