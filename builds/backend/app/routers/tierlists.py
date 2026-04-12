from fastapi import APIRouter, HTTPException, Request
from typing import List
import json
import secrets

from app.database import get_db
from app.schemas import TierList, TierListCreate

router = APIRouter()

def tierlist_from_row(row) -> TierList:
    return TierList(
        id=row["id"],
        name=row["name"],
        owner_id=row["owner_id"],
        owner_name="Admin",
        is_public=bool(row["is_public"]),
        secret_code=row["secret_code"],
        tiers_json=row["tiers_json"],
        forked_from=row["forked_from"],
        created_at=row["created_at"]
    )

@router.get("", response_model=List[TierList])
async def list_tierlists():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_tier_lists WHERE is_public = 1 ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    await db.close()
    return [tierlist_from_row(row) for row in rows]

@router.get("/my", response_model=List[TierList])
async def my_tierlists(request: Request):
    # TODO: Get user from auth
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM meta_tier_lists WHERE owner_id = ? ORDER BY created_at DESC",
        ("admin",)
    )
    rows = await cursor.fetchall()
    await db.close()
    return [tierlist_from_row(row) for row in rows]

@router.get("/{list_id}", response_model=TierList)
async def get_tierlist(list_id: str, secret: str = None):
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM meta_tier_lists WHERE id = ? AND (is_public = 1 OR secret_code = ?)",
        (list_id, secret or "")
    )
    row = await cursor.fetchone()
    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Tier list not found")

    return tierlist_from_row(row)

@router.post("", response_model=TierList)
async def create_tierlist(tierlist: TierListCreate, request: Request):
    db = await get_db()
    list_id = secrets.token_urlsafe(16)
    secret_code = secrets.token_urlsafe(8) if not tierlist.is_public else None

    await db.execute(
        """INSERT INTO meta_tier_lists (id, name, owner_id, is_public, secret_code, tiers_json)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (list_id, tierlist.name, "admin", 1 if tierlist.is_public else 0,
         secret_code, tierlist.tiers_json or "{}")
    )
    await db.commit()
    await db.close()

    return await get_tierlist(list_id)

@router.put("/{list_id}", response_model=TierList)
async def update_tierlist(list_id: str, tierlist: TierListCreate, request: Request):
    db = await get_db()

    await db.execute(
        """UPDATE meta_tier_lists SET name=?, is_public=?, tiers_json=? WHERE id=?""",
        (tierlist.name, 1 if tierlist.is_public else 0, tierlist.tiers_json or "{}", list_id)
    )
    await db.commit()
    await db.close()

    return await get_tierlist(list_id)

@router.delete("/{list_id}")
async def delete_tierlist(list_id: str, request: Request):
    db = await get_db()
    await db.execute("DELETE FROM meta_tier_lists WHERE id = ?", (list_id,))
    await db.commit()
    await db.close()
    return {"message": "Tier list deleted"}

@router.post("/{list_id}/fork")
async def fork_tierlist(list_id: str, request: Request):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_tier_lists WHERE id = ?", (list_id,))
    row = await cursor.fetchone()

    if not row:
        await db.close()
        raise HTTPException(status_code=404, detail="Tier list not found")

    new_id = secrets.token_urlsafe(16)
    await db.execute(
        """INSERT INTO meta_tier_lists (id, name, owner_id, is_public, tiers_json, forked_from)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (new_id, f"Fork of {row['name']}", "admin", 0, row["tiers_json"], list_id)
    )
    await db.commit()
    await db.close()

    return await get_tierlist(new_id)