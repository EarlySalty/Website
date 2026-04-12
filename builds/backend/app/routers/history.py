from fastapi import APIRouter
from typing import List

from app.database import get_db
from app.schemas import TierHistoryEntry

router = APIRouter()

@router.get("", response_model=List[TierHistoryEntry])
async def list_history():
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM meta_tier_history ORDER BY changed_at DESC LIMIT 50"
    )
    rows = await cursor.fetchall()
    await db.close()
    return [TierHistoryEntry(
        id=row["id"], hero_id=row["hero_id"], hero_name=row["hero_name"],
        old_tier=row["old_tier"], new_tier=row["new_tier"],
        changed_by=row["changed_by"], changed_at=row["changed_at"]
    ) for row in rows]