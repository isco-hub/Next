"""Store climate_daily.date as DATE

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "climate_daily",
        "date",
        existing_type=sa.DateTime(timezone=False),
        type_=sa.Date(),
        existing_nullable=False,
        postgresql_using="date::date",
    )


def downgrade() -> None:
    op.alter_column(
        "climate_daily",
        "date",
        existing_type=sa.Date(),
        type_=sa.DateTime(timezone=False),
        existing_nullable=False,
        postgresql_using="date::timestamp",
    )

