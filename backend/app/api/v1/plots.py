from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import CurrentUser, get_current_user
from app.core.errors import ForbiddenError, NotFoundError
from app.db.models import Plot
from app.db.session import get_db

router = APIRouter()


class PlotBody(BaseModel):
    name: str
    lat: float
    lon: float
    soil_type: str
    size_acres: float
    previous_crops: list[str]
    district_id: str | None = None
    subcounty_id: str | None = None


@router.get("/plots")
async def list_plots(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    result = await db.execute(select(Plot).where(Plot.user_id == user.user_id))
    return [_plot_dict(p) for p in result.scalars().all()]


@router.post("/plots", status_code=201)
async def create_plot(
    body: PlotBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    plot = Plot(
        id=str(uuid.uuid4()),
        user_id=user.user_id,
        **body.model_dump(),
    )
    db.add(plot)
    await db.flush()
    return _plot_dict(plot)


@router.patch("/plots/{plot_id}")
async def update_plot(
    plot_id: str,
    body: PlotBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    result = await db.execute(select(Plot).where(Plot.id == plot_id))
    plot = result.scalar_one_or_none()
    if plot is None:
        raise NotFoundError(f"Plot {plot_id} not found.")
    if plot.user_id != user.user_id:
        raise ForbiddenError("Not your plot.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(plot, k, v)
    await db.flush()
    return _plot_dict(plot)


@router.delete("/plots/{plot_id}", status_code=204)
async def delete_plot(
    plot_id: str,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Plot).where(Plot.id == plot_id))
    plot = result.scalar_one_or_none()
    if plot is None:
        raise NotFoundError(f"Plot {plot_id} not found.")
    if plot.user_id != user.user_id:
        raise ForbiddenError("Not your plot.")
    await db.delete(plot)


def _plot_dict(p: Plot) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "lat": p.lat,
        "lon": p.lon,
        "soil_type": p.soil_type,
        "size_acres": p.size_acres,
        "previous_crops": p.previous_crops,
        "district_id": p.district_id,
        "subcounty_id": p.subcounty_id,
        "grid_cell_id": p.grid_cell_id or "",
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }

