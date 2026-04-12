from fastapi import APIRouter, HTTPException, Request
from typing import List
import secrets

from app.database import get_db
from app.schemas import Report, Announcement, User

router = APIRouter()

@router.get("/reports", response_model=List[Report])
async def list_reports():
    db = await get_db()
    cursor = await db.execute("""
        SELECT r.*, b.name as build_name
        FROM meta_reports r
        LEFT JOIN meta_builds b ON r.build_id = b.id
        ORDER BY r.created_at DESC
    """)
    rows = await cursor.fetchall()
    await db.close()
    return [Report(
        id=row["id"], build_id=row["build_id"], build_name=row.get("build_name"),
        reporter_id=row["reporter_id"], reporter_name=row["reporter_name"] or "Unknown",
        reason=row["reason"], status=row["status"], created_at=row["created_at"]
    ) for row in rows]

@router.put("/reports/{report_id}")
async def update_report(report_id: str, status: str):
    db = await get_db()
    await db.execute("UPDATE meta_reports SET status = ? WHERE id = ?", (status, report_id))
    await db.commit()
    await db.close()
    return {"message": "Report updated"}

@router.get("/votes")
async def list_votes():
    db = await get_db()
    cursor = await db.execute("""
        SELECT build_id, SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE 0 END) as upvotes,
               SUM(CASE WHEN vote_type = 'down' THEN 1 ELSE 0 END) as downvotes
        FROM meta_votes GROUP BY build_id
    """)
    rows = await cursor.fetchall()
    await db.close()
    return [{"buildId": row["build_id"], "upvotes": row["upvotes"], "downvotes": row["downvotes"]}
            for row in rows]

@router.delete("/votes/{vote_id}")
async def delete_vote(vote_id: str):
    db = await get_db()
    await db.execute("DELETE FROM meta_votes WHERE id = ?", (vote_id,))
    await db.commit()
    await db.close()
    return {"message": "Vote deleted"}

@router.post("/announcement")
async def set_announcement(body: dict):
    db = await get_db()
    ann_id = secrets.token_urlsafe(16)
    message = body.get("message", "")

    # Deactivate all existing announcements
    await db.execute("UPDATE meta_announcements SET is_active = 0")

    await db.execute(
        "INSERT INTO meta_announcements (id, message, is_active) VALUES (?, ?, 1)",
        (ann_id, message)
    )
    await db.commit()
    await db.close()

    return Announcement(id=ann_id, message=message, is_active=True, created_at="")

@router.delete("/announcement/{ann_id}")
async def delete_announcement(ann_id: str):
    db = await get_db()
    await db.execute("DELETE FROM meta_announcements WHERE id = ?", (ann_id,))
    await db.commit()
    await db.close()
    return {"message": "Announcement deleted"}

@router.get("/users", response_model=List[User])
async def list_users():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_users ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    await db.close()
    return [User(id=row["id"], username=row["username"], display_name=row["display_name"],
                 avatar_url=row["avatar_url"], role=row["role"])
            for row in rows]

@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, body: dict):
    db = await get_db()
    role = body.get("role", "user")
    await db.execute("UPDATE meta_users SET role = ? WHERE id = ?", (role, user_id))
    await db.commit()
    await db.close()
    return {"message": "User role updated"}