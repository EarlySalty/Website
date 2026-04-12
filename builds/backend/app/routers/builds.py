from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import json
import secrets

from app.database import get_db
from app.schemas import Build, BuildCreate, BuildVote, BuildReport

router = APIRouter()

def build_from_row(row) -> Build:
    return Build(
        id=row["id"],
        hero_id=row["hero_id"],
        name=row["name"],
        author_id=row["author_id"],
        author_name=row["author_name"],
        description=row["description"],
        ability_order_json=row["ability_order_json"],
        items_json=row["items_json"],
        upvotes=row["upvotes"],
        downvotes=row["downvotes"],
        status=row["status"],
        created_at=row["created_at"]
    )

@router.get("", response_model=List[Build])
async def list_builds(heroId: Optional[str] = None, status: Optional[str] = None):
    db = await get_db()

    query = "SELECT * FROM meta_builds WHERE 1=1"
    params = []
    if heroId:
        query += " AND hero_id = ?"
        params.append(heroId)
    if status:
        query += " AND status = ?"
        params.append(status)

    query += " ORDER BY upvotes DESC, created_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    await db.close()

    return [build_from_row(row) for row in rows]

@router.get("/{build_id}", response_model=Build)
async def get_build(build_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_builds WHERE id = ?", (build_id,))
    row = await cursor.fetchone()
    await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Build not found")

    return build_from_row(row)

@router.post("", response_model=Build)
async def create_build(build: BuildCreate, request: Request):
    # TODO: Get user from auth
    db = await get_db()
    build_id = secrets.token_urlsafe(16)

    author_id = "anonymous"
    author_name = "Anonymous"

    await db.execute(
        """INSERT INTO meta_builds (id, hero_id, name, author_id, author_name, description, ability_order_json, items_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (build_id, build.hero_id, build.name, author_id, author_name,
         build.description, build.ability_order_json or "[]", build.items_json or "[]")
    )
    await db.commit()
    await db.close()

    return await get_build(build_id)

@router.put("/{build_id}", response_model=Build)
async def update_build(build_id: str, build: BuildCreate, request: Request):
    db = await get_db()

    await db.execute(
        """UPDATE meta_builds SET hero_id=?, name=?, description=?,
           ability_order_json=?, items_json=? WHERE id=?""",
        (build.hero_id, build.name, build.description,
         build.ability_order_json or "[]", build.items_json or "[]", build_id)
    )
    await db.commit()
    await db.close()

    return await get_build(build_id)

@router.delete("/{build_id}")
async def delete_build(build_id: str, request: Request):
    db = await get_db()
    await db.execute("DELETE FROM meta_builds WHERE id = ?", (build_id,))
    await db.commit()
    await db.close()
    return {"message": "Build deleted"}

@router.post("/{build_id}/vote")
async def vote_build(build_id: str, vote: BuildVote, request: Request):
    # TODO: Get user from auth
    db = await get_db()

    if vote.vote == "up":
        await db.execute("UPDATE meta_builds SET upvotes = upvotes + 1 WHERE id = ?", (build_id,))
    else:
        await db.execute("UPDATE meta_builds SET downvotes = downvotes + 1 WHERE id = ?", (build_id,))

    await db.commit()
    await db.close()

    return await get_build(build_id)

@router.post("/{build_id}/report")
async def report_build(build_id: str, report: BuildReport, request: Request):
    # TODO: Get user from auth
    db = await get_db()
    report_id = secrets.token_urlsafe(16)

    await db.execute(
        """INSERT INTO meta_reports (id, build_id, reason, status) VALUES (?, ?, ?, 'open')""",
        (report_id, build_id, report.reason)
    )
    await db.execute("UPDATE meta_builds SET status = 'reported' WHERE id = ?", (build_id,))
    await db.commit()
    await db.close()

    return {"message": "Report submitted"}