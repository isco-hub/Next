"""
BE-105: Seed grid_cells for the pilot Lango sub-region.
Coordinates snapped to the nearest 0.5° POWER grid centroid.
Run: python -m app.db.seeds.grid_cells
"""
from __future__ import annotations

import asyncio
import uuid

PILOT_DISTRICTS = [
    ("lira", "Lira", 2.25, 32.9, ["Lira", "Adekokwok", "Agweng", "Barr", "Ogur", "Aromo"]),
    ("alebtong", "Alebtong", 2.25, 33.3, ["Alebtong", "Abako", "Aloi", "Amugu", "Omoro", "Adwir"]),
    ("apac", "Apac", 2.53, 32.46, ["Apac", "Aduku", "Ibuje", "Akokoro", "Chegere", "Arocha"]),
    ("oyam", "Oyam", 2.24, 32.38, ["Oyam", "Aber", "Acaba", "Iceme", "Minakulu", "Ngai"]),
    ("kole", "Kole", 2.18, 32.75, ["Kole", "Aboke", "Akalo", "Alito", "Ayer", "Bala"]),
    ("dokolo", "Dokolo", 1.92, 33.17, ["Dokolo", "Bata", "Kangai", "Kwera", "Okwang", "Adok"]),
    ("amolatar", "Amolatar", 1.64, 32.83, ["Amolatar", "Agikdak", "Aputi", "Etam", "Namasale", "Arwotcek"]),
    ("otuke", "Otuke", 2.5, 33.3, ["Otuke", "Adwari", "Ogwete", "Olur", "Orum", "Okwang"]),
    ("kwania", "Kwania", 2.02, 32.72, ["Kwania", "Chawente", "Inomo", "Nambieso", "Aduku", "Abongomola"]),
]

PILOT_CELLS = [
    {
        "district_id": district_id,
        "district_name": district_name,
        "subcounty_id": f"{district_id}.{name.lower().replace(' ', '-')}",
        "subcounty_name": name,
        "lat": lat,
        "lon": lon,
    }
    for district_id, district_name, lat, lon, names in PILOT_DISTRICTS
    for name in names
]

RESOLUTION_DEG = 0.5


async def seed() -> None:
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.settings import get_settings
    from app.db.models import GridCell

    settings = get_settings()
    engine = create_async_engine(str(settings.database_url))
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        for cell_data in PILOT_CELLS:
            cell_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, cell_data["subcounty_id"]))
            stmt = pg_insert(GridCell).values(
                id=cell_id,
                centroid=f"SRID=4326;POINT({cell_data['lon']} {cell_data['lat']})",
                district_id=cell_data["district_id"],
                district_name=cell_data["district_name"],
                subcounty_id=cell_data["subcounty_id"],
                subcounty_name=cell_data["subcounty_name"],
                resolution_deg=RESOLUTION_DEG,
                lat=cell_data["lat"],
                lon=cell_data["lon"],
            ).on_conflict_do_nothing(index_elements=["id"])
            await db.execute(stmt)
        await db.commit()
        print(f"Seeded {len(PILOT_CELLS)} grid cells.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())

