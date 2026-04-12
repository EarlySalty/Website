from fastapi import APIRouter, HTTPException, Request
from typing import List
import secrets

from app.database import get_db
from app.schemas import PatchNote, PatchNoteCreate

router = APIRouter()

@router.get("", response_model=List[PatchNote])
async def list_patchnotes():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM meta_patch_notes ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    await db.close()
    return [PatchNote(id=row["id"], title=row["title"], content=row["content"],
                      version=row["version"], created_at=row["created_at"])
            for row in rows]

@router.post("", response_model=PatchNote)
async def create_patchnote(note: PatchNoteCreate, request: Request):
    # TODO: Check admin auth
    db = await get_db()
    note_id = secrets.token_urlsafe(16)

    await db.execute(
        "INSERT INTO meta_patch_notes (id, title, content, version) VALUES (?, ?, ?, ?)",
        (note_id, note.title, note.content, note.version)
    )
    await db.commit()
    await db.close()

    return PatchNote(id=note_id, title=note.title, content=note.content,
                     version=note.version, created_at="")

@router.delete("/{note_id}")
async def delete_patchnote(note_id: str, request: Request):
    # TODO: Check admin auth
    db = await get_db()
    await db.execute("DELETE FROM meta_patch_notes WHERE id = ?", (note_id,))
    await db.commit()
    await db.close()
    return {"message": "Patch note deleted"}