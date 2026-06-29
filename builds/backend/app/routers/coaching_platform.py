"""
Coaching-Plattform: Bot-Mirror + Coach-/User-Bereich.

- Bot-Mirror (X-Bot-Token): spiegelt Anfragen/Sessions aus dem Discord-Bot.
- Coach-Routen (require_coach_user): Quer-Uebersicht, Queue, Coachee-Profile,
  Ziele, Meilensteine, Notizen, Termine.
- User-Routen (require_authenticated_user): eigene Coaching-Sicht.

Eigene DB (deadlock.db) wie der restliche Website-Stack; der Bot fuettert sie
ueber /sync. Reservierungs-/Claim-Logik bleibt im Bot, hier nur Spiegelung.
"""

import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.database import get_db
from app.routers.auth import require_authenticated_user, require_coach_user
from app.routers.coaching import require_bot_token

router = APIRouter()
logger = logging.getLogger(__name__)


def _uid() -> str:
    return secrets.token_urlsafe(12)


def _now_ts() -> int:
    return int(time.time())


def _iso() -> str:
    return datetime.utcnow().isoformat()


def _row(r) -> dict:
    return {k: r[k] for k in r.keys()} if r is not None else None


async def _table_columns(db, table_name: str) -> set[str]:
    cur = await db.execute(f"PRAGMA table_info({table_name})")
    return {row["name"] for row in await cur.fetchall()}


# ========== UPSERT-HELFER ==========

async def _upsert_coach(db, discord_user_id: int, username: Optional[str]) -> str:
    cur = await db.execute(
        "SELECT id FROM coaches WHERE discord_user_id=?", (discord_user_id,)
    )
    row = await cur.fetchone()
    if row:
        return row["id"]
    coach_id = _uid()
    await db.execute(
        """INSERT INTO coaches (id, discord_user_id, discord_username, display_name, status)
           VALUES (?, ?, ?, ?, 'active')""",
        (coach_id, discord_user_id, username, username),
    )
    return coach_id


async def _upsert_coachee(db, discord_user_id: int, username: Optional[str]) -> str:
    cur = await db.execute(
        "SELECT id FROM coachees WHERE discord_user_id=?", (discord_user_id,)
    )
    row = await cur.fetchone()
    if row:
        if username:
            await db.execute(
                "UPDATE coachees SET discord_username=?, updated_at=? WHERE id=?",
                (username, _iso(), row["id"]),
            )
        return row["id"]
    coachee_id = _uid()
    await db.execute(
        """INSERT INTO coachees (id, discord_user_id, discord_username, display_name)
           VALUES (?, ?, ?, ?)""",
        (coachee_id, discord_user_id, username, username),
    )
    return coachee_id


async def _acting_coach_id(db, user: dict) -> Optional[str]:
    """coaches.id des handelnden Coaches (oder None, z.B. fuer caddy-Admin)."""
    try:
        return await _upsert_coach(db, int(user["sub"]), user.get("displayName"))
    except (ValueError, TypeError):
        return None


# ========== BOT-MIRROR (X-Bot-Token) ==========

class SyncPayload(BaseModel):
    bot_request_id: int
    discord_user_id: int
    discord_username: Optional[str] = None
    rank: Optional[str] = None
    subrank: Optional[str] = None
    hero: Optional[str] = None
    games_played: Optional[str] = None
    hours_played: Optional[str] = None
    availability: Optional[str] = None
    current_problems: Optional[str] = None
    ai_summary: Optional[str] = None
    status: str = "analyzed"
    assigned_coach_discord_id: Optional[int] = None
    assigned_coach_username: Optional[str] = None
    reserved_until: Optional[int] = None
    # Session (sobald geclaimt/abgeschlossen)
    coach_discord_id: Optional[int] = None
    coach_username: Optional[str] = None
    session_status: Optional[str] = None  # active | completed | cancelled


@router.post("/platform/sync")
async def platform_sync(payload: SyncPayload, _bot: None = Depends(require_bot_token)):
    """Idempotenter Snapshot-Sync vom Bot bei jeder Statusaenderung."""
    db = await get_db()
    try:
        req_id = str(payload.bot_request_id)
        coachee_id = await _upsert_coachee(db, payload.discord_user_id, payload.discord_username)
        assigned_id = (
            str(payload.assigned_coach_discord_id)
            if payload.assigned_coach_discord_id
            else None
        )

        cur = await db.execute("SELECT id FROM coaching_requests WHERE id=?", (req_id,))
        exists = await cur.fetchone()
        if exists:
            await db.execute(
                """UPDATE coaching_requests SET discord_user_id=?, discord_username=?, rank=?,
                   subrank=?, hero=?, games_played=?, hours_played=?, availability=?,
                   current_problems=?, ai_summary=?, status=?, assigned_coach_id=?,
                   assigned_coach_username=?, reserved_until=?, updated_at=? WHERE id=?""",
                (
                    payload.discord_user_id, payload.discord_username, payload.rank or "",
                    payload.subrank or "", payload.hero, payload.games_played,
                    payload.hours_played, payload.availability, payload.current_problems,
                    payload.ai_summary, payload.status, assigned_id,
                    payload.assigned_coach_username, payload.reserved_until, _iso(), req_id,
                ),
            )
        else:
            await db.execute(
                """INSERT INTO coaching_requests (id, discord_user_id, discord_username, rank,
                   subrank, hero, games_played, hours_played, availability, current_problems,
                   ai_summary, status, assigned_coach_id, assigned_coach_username, reserved_until)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    req_id, payload.discord_user_id, payload.discord_username, payload.rank or "",
                    payload.subrank or "", payload.hero, payload.games_played,
                    payload.hours_played, payload.availability, payload.current_problems,
                    payload.ai_summary, payload.status, assigned_id,
                    payload.assigned_coach_username, payload.reserved_until,
                ),
            )

        # Session spiegeln, sobald ein Coach den Claim gemacht hat
        if payload.coach_discord_id and payload.session_status:
            coach_id = await _upsert_coach(db, payload.coach_discord_id, payload.coach_username)
            completed = _iso() if payload.session_status in ("completed", "cancelled") else None
            cur = await db.execute(
                "SELECT id FROM coaching_sessions WHERE request_id=?", (req_id,)
            )
            srow = await cur.fetchone()
            if srow:
                await db.execute(
                    """UPDATE coaching_sessions SET coach_id=?, coachee_id=?, discord_user_id=?,
                       discord_username=?, status=?, completed_at=COALESCE(?, completed_at)
                       WHERE id=?""",
                    (
                        coach_id, coachee_id, payload.discord_user_id, payload.discord_username,
                        payload.session_status, completed, srow["id"],
                    ),
                )
            else:
                await db.execute(
                    """INSERT INTO coaching_sessions (id, request_id, coach_id, coachee_id,
                       discord_user_id, discord_username, status, completed_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        _uid(), req_id, coach_id, coachee_id, payload.discord_user_id,
                        payload.discord_username, payload.session_status, completed,
                    ),
                )

        await db.commit()
        return {"ok": True, "coachee_id": coachee_id}
    finally:
        await db.close()


# ========== COACH: UEBERSICHT / QUEUE ==========

@router.get("/platform/overview")
async def platform_overview(request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT c.id, c.display_name, c.discord_username,
                      SUM(CASE WHEN s.status='active' THEN 1 ELSE 0 END) AS active,
                      SUM(CASE WHEN s.status='completed' THEN 1 ELSE 0 END) AS completed,
                      COUNT(s.id) AS total
               FROM coaches c LEFT JOIN coaching_sessions s ON s.coach_id=c.id
               WHERE c.status='active'
               GROUP BY c.id ORDER BY total DESC, c.display_name"""
        )
        coaches = [_row(r) for r in await cur.fetchall()]

        cur = await db.execute(
            """SELECT s.id, s.status, s.started_at, s.completed_at, s.discord_username,
                      co.id AS coachee_id, co.display_name AS coachee_display,
                      c.display_name AS coach_display
               FROM coaching_sessions s
               LEFT JOIN coaches c ON s.coach_id=c.id
               LEFT JOIN coachees co ON s.coachee_id=co.id
               ORDER BY s.started_at DESC LIMIT 40"""
        )
        recent = [_row(r) for r in await cur.fetchall()]
        return {"coaches": coaches, "recent_sessions": recent}
    finally:
        await db.close()


@router.get("/platform/queue")
async def platform_queue(request: Request):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT * FROM coaching_requests
               WHERE status='analyzed'
                 AND (assigned_coach_id IS NULL OR assigned_coach_id=?)
               ORDER BY created_at DESC LIMIT 50""",
            (str(user["sub"]),),
        )
        rows = [_row(r) for r in await cur.fetchall()]
        now = _now_ts()
        for r in rows:
            ru = r.get("reserved_until")
            r["reserved_for_me"] = bool(r.get("assigned_coach_id") == str(user["sub"]))
            r["is_open"] = r.get("assigned_coach_id") is None or (bool(ru) and int(ru) <= now)
        return {"requests": rows}
    finally:
        await db.close()


# ========== COACH: COACHEES / ZIELE / MEILENSTEINE / NOTIZEN ==========

@router.get("/platform/coachees")
async def list_coachees(request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        cur = await db.execute(
            """SELECT co.id, co.discord_username, co.display_name, co.rank, co.current_focus,
                      (SELECT COUNT(*) FROM coaching_goals g
                        WHERE g.coachee_id=co.id AND g.status IN ('open','active')) AS open_goals,
                      (SELECT COUNT(*) FROM coaching_sessions s
                        WHERE s.coachee_id=co.id) AS sessions
               FROM coachees co ORDER BY co.updated_at DESC LIMIT 200"""
        )
        return {"coachees": [_row(r) for r in await cur.fetchall()]}
    finally:
        await db.close()


async def _goals_with_milestones(db, coachee_id: str) -> list:
    cur = await db.execute(
        "SELECT * FROM coaching_goals WHERE coachee_id=? ORDER BY sort_order, created_at",
        (coachee_id,),
    )
    goals = [_row(r) for r in await cur.fetchall()]
    for g in goals:
        mcur = await db.execute(
            "SELECT * FROM coaching_milestones WHERE goal_id=? ORDER BY sort_order, created_at",
            (g["id"],),
        )
        g["milestones"] = [_row(m) for m in await mcur.fetchall()]
    return goals


@router.get("/platform/coachees/{coachee_id}")
async def get_coachee(coachee_id: str, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        cur = await db.execute("SELECT * FROM coachees WHERE id=?", (coachee_id,))
        coachee = _row(await cur.fetchone())
        if not coachee:
            raise HTTPException(404, "Coachee nicht gefunden")
        goals = await _goals_with_milestones(db, coachee_id)
        ncur = await db.execute(
            "SELECT * FROM session_notes WHERE coachee_id=? ORDER BY created_at DESC",
            (coachee_id,),
        )
        notes = [_row(n) for n in await ncur.fetchall()]
        scur = await db.execute(
            """SELECT s.*, c.display_name AS coach_display FROM coaching_sessions s
               LEFT JOIN coaches c ON s.coach_id=c.id
               WHERE s.coachee_id=? ORDER BY s.started_at DESC""",
            (coachee_id,),
        )
        sessions = [_row(s) for s in await scur.fetchall()]

        # Alle Termine des Coachees (alle Stati), absteigend nach scheduled_at
        acur = await db.execute(
            """SELECT a.id, a.scheduled_at, a.duration_minutes, a.title, a.note, a.status,
                      a.created_at,
                      COALESCE(c.display_name, c.discord_username) AS coach_display
               FROM coaching_appointments a
               LEFT JOIN coaches c ON a.coach_id=c.id
               WHERE a.coachee_id=?
               ORDER BY a.scheduled_at DESC""",
            (coachee_id,),
        )
        appointments = [_row(r) for r in await acur.fetchall()]

        return {
            "profile": coachee,
            "goals": goals,
            "notes": notes,
            "sessions": sessions,
            "appointments": appointments,
        }
    finally:
        await db.close()


class CoacheeUpdate(BaseModel):
    display_name: Optional[str] = None
    rank: Optional[str] = None
    main_heroes_json: Optional[str] = None
    current_focus: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/platform/coachees/{coachee_id}")
async def update_coachee(coachee_id: str, body: CoacheeUpdate, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        fields = {k: v for k, v in body.dict().items() if v is not None}
        if not fields:
            return {"ok": True}
        sets = ", ".join(f"{k}=?" for k in fields) + ", updated_at=?"
        params = list(fields.values()) + [_iso(), coachee_id]
        await db.execute(f"UPDATE coachees SET {sets} WHERE id=?", params)
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/platform/coachees/{coachee_id}/goals")
async def create_goal(coachee_id: str, body: GoalCreate, request: Request):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        coach_id = await _acting_coach_id(db, user)
        goal_id = _uid()
        await db.execute(
            """INSERT INTO coaching_goals (id, coachee_id, coach_id, session_id, title,
               description, target_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')""",
            (goal_id, coachee_id, coach_id, body.session_id, body.title, body.description,
             body.target_date),
        )
        await db.commit()
        return {"id": goal_id}
    finally:
        await db.close()


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None
    target_date: Optional[str] = None


@router.patch("/platform/goals/{goal_id}")
async def update_goal(goal_id: str, body: GoalUpdate, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        fields = {k: v for k, v in body.dict().items() if v is not None}
        if not fields:
            return {"ok": True}
        completed = _iso() if fields.get("status") == "done" else None
        sets = ", ".join(f"{k}=?" for k in fields) + ", completed_at=?, updated_at=?"
        params = list(fields.values()) + [completed, _iso(), goal_id]
        await db.execute(f"UPDATE coaching_goals SET {sets} WHERE id=?", params)
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.delete("/platform/goals/{goal_id}")
async def delete_goal(goal_id: str, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        await db.execute("DELETE FROM coaching_milestones WHERE goal_id=?", (goal_id,))
        await db.execute("DELETE FROM coaching_goals WHERE id=?", (goal_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None


@router.post("/platform/goals/{goal_id}/milestones")
async def create_milestone(goal_id: str, body: MilestoneCreate, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        ms_id = _uid()
        await db.execute(
            """INSERT INTO coaching_milestones (id, goal_id, title, description)
               VALUES (?, ?, ?, ?)""",
            (ms_id, goal_id, body.title, body.description),
        )
        await db.commit()
        return {"id": ms_id}
    finally:
        await db.close()


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    achieved: Optional[bool] = None
    sort_order: Optional[int] = None


@router.patch("/platform/milestones/{milestone_id}")
async def update_milestone(milestone_id: str, body: MilestoneUpdate, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        sets, params = [], []
        if body.title is not None:
            sets.append("title=?"); params.append(body.title)
        if body.sort_order is not None:
            sets.append("sort_order=?"); params.append(body.sort_order)
        if body.achieved is not None:
            sets.append("achieved=?"); params.append(1 if body.achieved else 0)
            sets.append("achieved_at=?"); params.append(_iso() if body.achieved else None)
        if not sets:
            return {"ok": True}
        params.append(milestone_id)
        await db.execute(f"UPDATE coaching_milestones SET {', '.join(sets)} WHERE id=?", params)
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.delete("/platform/milestones/{milestone_id}")
async def delete_milestone(milestone_id: str, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        await db.execute("DELETE FROM coaching_milestones WHERE id=?", (milestone_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


class NoteCreate(BaseModel):
    content: str
    visibility: str = "coach_only"
    session_id: Optional[str] = None


@router.post("/platform/coachees/{coachee_id}/notes")
async def create_note(coachee_id: str, body: NoteCreate, request: Request):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        coach_id = await _acting_coach_id(db, user)
        note_id = _uid()
        visibility = body.visibility if body.visibility in ("coach_only", "shared_with_user") else "coach_only"
        await db.execute(
            """INSERT INTO session_notes (id, session_id, coachee_id, coach_id, content, visibility)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (note_id, body.session_id, coachee_id, coach_id, body.content, visibility),
        )
        await db.commit()
        return {"id": note_id}
    finally:
        await db.close()


class NoteUpdate(BaseModel):
    content: Optional[str] = None
    visibility: Optional[str] = None


@router.patch("/platform/notes/{note_id}")
async def update_note(note_id: str, body: NoteUpdate, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        fields = {k: v for k, v in body.dict().items() if v is not None}
        if "visibility" in fields and fields["visibility"] not in ("coach_only", "shared_with_user"):
            fields.pop("visibility")
        if not fields:
            return {"ok": True}
        sets = ", ".join(f"{k}=?" for k in fields) + ", updated_at=?"
        params = list(fields.values()) + [_iso(), note_id]
        await db.execute(f"UPDATE session_notes SET {sets} WHERE id=?", params)
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


@router.delete("/platform/notes/{note_id}")
async def delete_note(note_id: str, request: Request):
    await require_coach_user(request)
    db = await get_db()
    try:
        await db.execute("DELETE FROM session_notes WHERE id=?", (note_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ========== USER: EIGENE COACHING-SICHT ==========

@router.get("/platform/me")
async def my_coaching(request: Request):
    user = await require_authenticated_user(request)
    db = await get_db()
    try:
        try:
            discord_id = int(user["sub"])
        except (ValueError, TypeError):
            return {"profile": None, "goals": [], "notes": [], "sessions": []}

        # Bewusst KEIN SELECT *: die Spalte coachees.notes ist coach-intern und
        # hat (anders als session_notes) kein Sichtbarkeits-Gate -> nie an den Spieler geben.
        cur = await db.execute(
            """SELECT id, discord_user_id, discord_username, display_name, rank,
                      main_heroes_json, current_focus, created_at, updated_at
               FROM coachees WHERE discord_user_id=?""",
            (discord_id,),
        )
        coachee = _row(await cur.fetchone())
        if not coachee:
            return {"profile": None, "goals": [], "notes": [], "sessions": []}

        goals = await _goals_with_milestones(db, coachee["id"])
        ncur = await db.execute(
            """SELECT * FROM session_notes WHERE coachee_id=? AND visibility='shared_with_user'
               ORDER BY created_at DESC""",
            (coachee["id"],),
        )
        notes = [_row(n) for n in await ncur.fetchall()]
        scur = await db.execute(
            """SELECT s.status, s.started_at, s.completed_at, c.display_name AS coach_display
               FROM coaching_sessions s LEFT JOIN coaches c ON s.coach_id=c.id
               WHERE s.discord_user_id=? ORDER BY s.started_at DESC""",
            (discord_id,),
        )
        sessions = [_row(s) for s in await scur.fetchall()]

        # Upcoming + letzte 5 abgeschlossene/abgesagte Termine des Coachees
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
        acur = await db.execute(
            """SELECT a.id, a.scheduled_at, a.duration_minutes, a.title, a.status,
                      c.display_name AS coach_display
               FROM coaching_appointments a
               LEFT JOIN coaches c ON a.coach_id=c.id
               WHERE a.coachee_id=? AND (
                   (a.status='scheduled' AND a.scheduled_at >= ?)
                   OR a.status IN ('done','cancelled')
               )
               ORDER BY
                   CASE WHEN a.status='scheduled' THEN 0 ELSE 1 END,
                   a.scheduled_at ASC
               LIMIT 50""",
            (coachee["id"], cutoff),
        )
        all_appts = [_row(r) for r in await acur.fetchall()]
        # Scheduled: alle; done/cancelled: letzte 5
        scheduled_appts = [a for a in all_appts if a["status"] == "scheduled"]
        closed_appts = [a for a in all_appts if a["status"] in ("done", "cancelled")][-5:]
        appointments = scheduled_appts + closed_appts

        return {
            "profile": coachee,
            "goals": goals,
            "notes": notes,
            "sessions": sessions,
            "appointments": appointments,
        }
    finally:
        await db.close()


# ========== COACH-ROLLEN-SYNC (Bot → Website) ==========

class CoachSyncEntry(BaseModel):
    discord_user_id: int
    discord_username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class CoachSyncPayload(BaseModel):
    coaches: List[CoachSyncEntry]


@router.post("/platform/coaches/sync")
async def coaches_sync(payload: CoachSyncPayload, _bot: None = Depends(require_bot_token)):
    """Bot-Endpunkt: Synchronisiert die aktiven Coaches aus dem Discord-Roster."""
    # Leer-Listen-Schutz: nie alle Coaches deaktivieren bei Bot-Fehler
    if not payload.coaches:
        return {"ok": True, "skipped": True}

    db = await get_db()
    try:
        incoming_ids = {entry.discord_user_id for entry in payload.coaches}

        for entry in payload.coaches:
            cur = await db.execute(
                "SELECT id FROM coaches WHERE discord_user_id=?", (entry.discord_user_id,)
            )
            row = await cur.fetchone()
            if row:
                # Nur Bot-kontrollierte Felder aktualisieren; bio/specialties/availability/twitch_url
                # bleiben unangetastet — die pflegt der Coach selbst.
                await db.execute(
                    """UPDATE coaches
                          SET discord_username=COALESCE(?, discord_username),
                              display_name=COALESCE(?, display_name),
                              avatar_url=COALESCE(?, avatar_url),
                              status='active',
                              updated_at=?
                        WHERE discord_user_id=?""",
                    (entry.discord_username, entry.display_name, entry.avatar_url,
                     _iso(), entry.discord_user_id),
                )
            else:
                coach_id = _uid()
                await db.execute(
                    """INSERT INTO coaches
                           (id, discord_user_id, discord_username, display_name, avatar_url, status)
                       VALUES (?, ?, ?, ?, ?, 'active')""",
                    (coach_id, entry.discord_user_id, entry.discord_username,
                     entry.display_name, entry.avatar_url),
                )

        # Coaches, die nicht mehr im Roster sind → inaktiv setzen
        placeholders = ",".join("?" * len(incoming_ids))
        cur = await db.execute(
            f"""UPDATE coaches SET status='inactive', updated_at=?
                WHERE status='active' AND discord_user_id NOT IN ({placeholders})""",
            (_iso(), *incoming_ids),
        )
        deactivated = cur.rowcount

        await db.commit()
        active = len(incoming_ids)
        return {"ok": True, "active": active, "deactivated": deactivated}
    finally:
        await db.close()


# ========== TERMINE ==========

class AppointmentCreate(BaseModel):
    coachee_id: str
    scheduled_at: str
    duration_minutes: int = 60
    title: Optional[str] = None
    note: Optional[str] = None


class AppointmentUpdate(BaseModel):
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    title: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None


@router.post("/platform/appointments")
async def create_appointment(body: AppointmentCreate, request: Request):
    user = await require_coach_user(request)

    # ISO-Validierung
    try:
        datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, "scheduled_at muss ISO-8601 UTC sein")

    db = await get_db()
    try:
        # Coachee muss existieren
        cur = await db.execute("SELECT id FROM coachees WHERE id=?", (body.coachee_id,))
        if not await cur.fetchone():
            raise HTTPException(404, "Coachee nicht gefunden")

        coach_id = await _acting_coach_id(db, user)
        appt_id = _uid()
        await db.execute(
            """INSERT INTO coaching_appointments
                   (id, coach_id, coachee_id, scheduled_at, duration_minutes, title, note)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (appt_id, coach_id, body.coachee_id, body.scheduled_at,
             body.duration_minutes, body.title, body.note),
        )
        await db.commit()
        return {"id": appt_id}
    finally:
        await db.close()


@router.get("/platform/appointments")
async def list_appointments(scope: str = "mine", request: Request = None):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        # Termine ab 7 Tage vor jetzt, alle Stati, aufsteigend
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        if scope == "mine":
            coach_id = await _acting_coach_id(db, user)
            cur = await db.execute(
                """SELECT a.id, a.coach_id, a.coachee_id, a.scheduled_at, a.duration_minutes,
                          a.title, a.note, a.status, a.created_at,
                          COALESCE(co.display_name, co.discord_username) AS coachee_display,
                          COALESCE(c.display_name, c.discord_username) AS coach_display
                   FROM coaching_appointments a
                   LEFT JOIN coachees co ON a.coachee_id=co.id
                   LEFT JOIN coaches c ON a.coach_id=c.id
                   WHERE a.coach_id=? AND a.scheduled_at >= ?
                   ORDER BY a.scheduled_at ASC""",
                (coach_id, cutoff),
            )
        else:
            cur = await db.execute(
                """SELECT a.id, a.coach_id, a.coachee_id, a.scheduled_at, a.duration_minutes,
                          a.title, a.note, a.status, a.created_at,
                          COALESCE(co.display_name, co.discord_username) AS coachee_display,
                          COALESCE(c.display_name, c.discord_username) AS coach_display
                   FROM coaching_appointments a
                   LEFT JOIN coachees co ON a.coachee_id=co.id
                   LEFT JOIN coaches c ON a.coach_id=c.id
                   WHERE a.scheduled_at >= ?
                   ORDER BY a.scheduled_at ASC""",
                (cutoff,),
            )
        return {"appointments": [_row(r) for r in await cur.fetchall()]}
    finally:
        await db.close()


@router.patch("/platform/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, body: AppointmentUpdate, request: Request):
    user = await require_coach_user(request)

    if body.status is not None and body.status not in ("scheduled", "done", "cancelled"):
        raise HTTPException(400, "status muss scheduled | done | cancelled sein")

    if body.scheduled_at is not None:
        try:
            datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "scheduled_at muss ISO-8601 UTC sein")

    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT coach_id, status FROM coaching_appointments WHERE id=?", (appointment_id,)
        )
        appt = await cur.fetchone()
        if not appt:
            raise HTTPException(404, "Termin nicht gefunden")

        # Nur besitzender Coach oder Admin darf ändern
        acting_coach_id = await _acting_coach_id(db, user)
        is_admin = user.get("role") == "admin"
        if not is_admin and appt["coach_id"] != acting_coach_id:
            raise HTTPException(403, "Nur der zuständige Coach darf diesen Termin ändern")

        fields: dict = {k: v for k, v in body.dict().items() if v is not None}
        if not fields:
            return {"ok": True}

        sets = []
        params = []
        for k, v in fields.items():
            sets.append(f"{k}=?")
            params.append(v)

        # Reschedule → Benachrichtigungsstempel zurücksetzen (Bot schickt neue Einladung)
        if "scheduled_at" in fields:
            sets.append("notify_created_at=NULL")
            sets.append("notify_reminder_at=NULL")

        sets.append("updated_at=?")
        params.append(_iso())
        params.append(appointment_id)

        await db.execute(
            f"UPDATE coaching_appointments SET {', '.join(sets)} WHERE id=?", params
        )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ========== NOTIFICATION-QUEUE (Bot-Polling) ==========

@router.get("/platform/notifications/due")
async def notifications_due(_bot: None = Depends(require_bot_token)):
    """Bot-Polling: welche Termine/Requests müssen jetzt benachrichtigt werden?"""
    db = await get_db()
    try:
        now = datetime.now(timezone.utc).isoformat()
        in_2h = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()

        # Drei Typen via UNION, lesbar gehalten
        cur = await db.execute(
            """
            SELECT 'created' AS type,
                   a.id AS appointment_id,
                   co.discord_user_id,
                   COALESCE(co.display_name, co.discord_username) AS coachee_display,
                   COALESCE(c.display_name, c.discord_username) AS coach_display,
                   a.scheduled_at, a.duration_minutes, a.title, a.note
            FROM coaching_appointments a
            JOIN coachees co ON a.coachee_id=co.id
            JOIN coaches c ON a.coach_id=c.id
            WHERE a.status='scheduled' AND a.notify_created_at IS NULL

            UNION ALL

            SELECT 'reminder' AS type,
                   a.id, co.discord_user_id,
                   COALESCE(co.display_name, co.discord_username),
                   COALESCE(c.display_name, c.discord_username),
                   a.scheduled_at, a.duration_minutes, a.title, a.note
            FROM coaching_appointments a
            JOIN coachees co ON a.coachee_id=co.id
            JOIN coaches c ON a.coach_id=c.id
            WHERE a.status='scheduled'
              AND a.notify_reminder_at IS NULL
              AND a.notify_created_at IS NOT NULL
              AND a.scheduled_at BETWEEN ? AND ?

            UNION ALL

            SELECT 'cancelled' AS type,
                   a.id, co.discord_user_id,
                   COALESCE(co.display_name, co.discord_username),
                   COALESCE(c.display_name, c.discord_username),
                   a.scheduled_at, a.duration_minutes, a.title, a.note
            FROM coaching_appointments a
            JOIN coachees co ON a.coachee_id=co.id
            JOIN coaches c ON a.coach_id=c.id
            WHERE a.status='cancelled'
              AND a.notify_cancelled_at IS NULL
              AND a.notify_created_at IS NOT NULL
            """,
            (now, in_2h),
        )
        notifications = [_row(r) for r in await cur.fetchall()]

        request_columns = await _table_columns(db, "coaching_requests")
        preferred_coach_select = (
            "preferred_coach_id"
            if "preferred_coach_id" in request_columns
            else "NULL AS preferred_coach_id"
        )
        cur = await db.execute(
            f"""
            SELECT id AS request_id,
                   discord_user_id,
                   discord_username,
                   rank,
                   subrank,
                   hero,
                   games_played,
                   hours_played,
                   availability,
                   current_problems,
                   {preferred_coach_select}
            FROM coaching_requests
            WHERE notify_discord_at IS NULL
              AND status IN ('pending', 'analyzed', 'open', 'new')
            ORDER BY created_at ASC
            """
        )
        request_rows = await cur.fetchall()

        for row in request_rows:
            coachee_id = await _upsert_coachee(
                db,
                row["discord_user_id"],
                row["discord_username"],
            )
            notifications.append({
                "type": "request_created",
                "request_id": row["request_id"],
                "coachee_id": coachee_id,
                "discord_user_id": row["discord_user_id"],
                "discord_username": row["discord_username"],
                "rank": row["rank"] or "",
                "subrank": row["subrank"] or "",
                "hero": row["hero"],
                "games_played": row["games_played"],
                "hours_played": row["hours_played"],
                "availability": row["availability"],
                "current_problems": row["current_problems"],
                "preferred_coach_id": row["preferred_coach_id"],
            })

        if request_rows:
            await db.commit()

        return {"notifications": notifications}
    finally:
        await db.close()


class AckItem(BaseModel):
    appointment_id: str
    type: str  # created | reminder | cancelled


class AckPayload(BaseModel):
    items: List[AckItem] = Field(default_factory=list)
    request_ids: List[str] = Field(default_factory=list)


@router.post("/platform/notifications/ack")
async def notifications_ack(payload: AckPayload, _bot: None = Depends(require_bot_token)):
    """Bot: bestätigt, dass Benachrichtigungen verschickt wurden."""
    db = await get_db()
    try:
        ts = _iso()
        acked = 0
        for item in payload.items:
            col = {
                "created": "notify_created_at",
                "reminder": "notify_reminder_at",
                "cancelled": "notify_cancelled_at",
            }.get(item.type)
            if not col:
                continue
            await db.execute(
                f"UPDATE coaching_appointments SET {col}=? WHERE id=?",
                (ts, item.appointment_id),
            )
            acked += 1
        for request_id in payload.request_ids:
            cur = await db.execute(
                """UPDATE coaching_requests
                   SET notify_discord_at=?
                   WHERE id=? AND notify_discord_at IS NULL""",
                (ts, request_id),
            )
            acked += cur.rowcount
        await db.commit()
        return {"ok": True, "acked": acked}
    finally:
        await db.close()


# ========== COACH-EIGENPROFIL ==========

class CoachProfileUpdate(BaseModel):
    bio: Optional[str] = None
    specialties: Optional[List[str]] = None
    twitch_url: Optional[str] = None


@router.get("/platform/coaches/me")
async def get_my_coach_profile(request: Request):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        try:
            discord_id = int(user["sub"])
        except (ValueError, TypeError):
            raise HTTPException(404, "Coach-Profil nicht gefunden")

        cur = await db.execute(
            "SELECT * FROM coaches WHERE discord_user_id=?", (discord_id,)
        )
        row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Coach-Profil nicht gefunden")

        data = _row(row)
        # specialties_json als Liste ausgeben (wie list_coaches in coaching.py)
        try:
            data["specialties"] = json.loads(data["specialties_json"]) if data["specialties_json"] else []
        except Exception:
            data["specialties"] = []
        try:
            data["availability"] = json.loads(data["availability_json"]) if data["availability_json"] else {}
        except Exception:
            data["availability"] = {}

        return data
    finally:
        await db.close()


@router.patch("/platform/coaches/me")
async def update_my_coach_profile(body: CoachProfileUpdate, request: Request):
    user = await require_coach_user(request)
    db = await get_db()
    try:
        try:
            discord_id = int(user["sub"])
        except (ValueError, TypeError):
            raise HTTPException(404, "Coach-Profil nicht gefunden")

        cur = await db.execute(
            "SELECT id FROM coaches WHERE discord_user_id=?", (discord_id,)
        )
        if not await cur.fetchone():
            raise HTTPException(404, "Coach-Profil nicht gefunden")

        sets, params = [], []
        if body.bio is not None:
            sets.append("bio=?"); params.append(body.bio)
        if body.specialties is not None:
            sets.append("specialties_json=?"); params.append(json.dumps(body.specialties))
        if body.twitch_url is not None:
            sets.append("twitch_url=?"); params.append(body.twitch_url)

        if not sets:
            return {"ok": True}

        sets.append("updated_at=?"); params.append(_iso())
        params.append(discord_id)

        await db.execute(
            f"UPDATE coaches SET {', '.join(sets)} WHERE discord_user_id=?", params
        )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()
