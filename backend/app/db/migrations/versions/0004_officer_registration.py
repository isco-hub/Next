"""extension officer self-registration and approval

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "approval_status",
            sa.String(16),
            nullable=False,
            server_default="approved",
        ),
    )
    op.add_column("users", sa.Column("constituency_id", sa.String(64), nullable=True))
    op.add_column(
        "otp_requests",
        sa.Column("role", sa.String(32), nullable=False, server_default="farmer"),
    )
    op.add_column(
        "otp_requests", sa.Column("constituency_id", sa.String(64), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("otp_requests", "constituency_id")
    op.drop_column("otp_requests", "role")
    op.drop_column("users", "constituency_id")
    op.drop_column("users", "approval_status")
