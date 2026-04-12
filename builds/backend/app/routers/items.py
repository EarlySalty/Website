from fastapi import APIRouter, HTTPException
from typing import List
import json

from app.database import get_db
from app.schemas import Item

router = APIRouter()

@router.get("", response_model=List[Item])
async def list_items():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_items ORDER BY name")
    rows = await cursor.fetchall()
    await db.close()
    return [Item(id=row["id"], name=row["name"], type=row["type"],
                 stats_json=row["stats_json"], image_url=row["image_url"])
            for row in rows]

@router.get("/{item_id}", response_model=Item)
async def get_item(item_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_items WHERE id = ?", (item_id,))
    row = await cursor.fetchone()
    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    return Item(id=row["id"], name=row["name"], type=row["type"],
                stats_json=row["stats_json"], image_url=row["image_url"])