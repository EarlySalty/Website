from fastapi import APIRouter, HTTPException, Request
from typing import List
import json
import secrets

from app.database import get_db
from app.schemas import Hero, HeroCreate

router = APIRouter()

def hero_from_row(row) -> Hero:
    abilities = json.loads(row["abilities_json"] or "[]")
    stats = json.loads(row["stats_json"] or "{}")
    return Hero(
        id=row["id"],
        name=row["name"],
        tier=row["tier"],
        role=row["role"],
        image_url=row["image_url"],
        abilities_json=row["abilities_json"],
        stats_json=row["stats_json"],
        abilities=abilities,
        stats=stats
    )

@router.get("", response_model=List[Hero])
async def list_heroes():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_heroes ORDER BY name")
    rows = await cursor.fetchall()
    await db.close()
    return [hero_from_row(row) for row in rows]

@router.get("/{hero_id}", response_model=Hero)
async def get_hero(hero_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_heroes WHERE id = ?", (hero_id,))
    row = await cursor.fetchone()
    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Hero not found")

    return hero_from_row(row)

@router.post("", response_model=Hero)
async def create_hero(hero: HeroCreate, request: Request):
    # TODO: Check admin auth
    db = await get_db()
    hero_id = secrets.token_urlsafe(16)

    await db.execute(
        """INSERT INTO meta_heroes (id, name, tier, role, image_url, abilities_json, stats_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (hero_id, hero.name, hero.tier, hero.role, hero.image_url,
         hero.abilities_json or "[]", hero.stats_json or "{}")
    )
    await db.commit()
    await db.close()

    return await get_hero(hero_id)

@router.put("/{hero_id}", response_model=Hero)
async def update_hero(hero_id: str, hero: HeroCreate, request: Request):
    # TODO: Check admin auth
    db = await get_db()

    await db.execute(
        """UPDATE meta_heroes SET name=?, tier=?, role=?, image_url=?,
           abilities_json=?, stats_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
        (hero.name, hero.tier, hero.role, hero.image_url,
         hero.abilities_json or "[]", hero.stats_json or "{}", hero_id)
    )
    await db.commit()
    await db.close()

    return await get_hero(hero_id)

@router.delete("/{hero_id}")
async def delete_hero(hero_id: str, request: Request):
    # TODO: Check admin auth
    db = await get_db()
    await db.execute("DELETE FROM meta_heroes WHERE id = ?", (hero_id,))
    await db.commit()
    await db.close()
    return {"message": "Hero deleted"}