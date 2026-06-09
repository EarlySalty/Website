import hashlib
import hmac
import secrets
import json
import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.database import get_db
from app.routers.auth import require_admin_user, require_authenticated_user

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== SCHEMAS ==========

class CoachProfileBase(BaseModel):
    display_name: str
    bio: Optional[str] = None
    specialties: list[str] = []
    availability: dict = {}


class CoachProfileCreate(CoachProfileBase):
    discord_user_id: int
    discord_username: str
    avatar_url: Optional[str] = None


class CoachProfile(BaseModel):
    id: str
    display_name: str
    discord_username: str
    avatar_url: Optional[str]
    bio: Optional[str]
    specialties: list[str]
    availability: dict
    status: str
    avg_rating: float
    total_reviews: int
    total_sessions: int
    twitch_url: Optional[str] = None


class CoachReview(BaseModel):
    id: str
    coach_id: str
    user_display_name: str
    rating: int
    feedback_text: Optional[str]
    improved_areas: Optional[str]
    created_at: str


class CoachingRequestCreate(BaseModel):
    id: Optional[str] = None  # Bot kann seine eigene UUID übergeben
    discord_user_id: int
    discord_username: str
    rank: str
    subrank: str
    hero: Optional[str] = None
    games_played: Optional[str] = None
    hours_played: Optional[str] = None
    availability: Optional[str] = None
    current_problems: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_insights_json: Optional[str] = None


class CoachingRequest(BaseModel):
    id: str
    discord_username: str
    rank: str
    subrank: str
    hero: Optional[str]
    games_played: Optional[str]
    hours_played: Optional[str]
    availability: Optional[str]
    current_problems: Optional[str]
    ai_summary: Optional[str]
    status: str
    created_at: str


class CoachApplicationCreate(BaseModel):
    discord_user_id: int
    discord_username: str
    display_name: str
    application_text: str
    experience_text: str
    rank: str
    specialties: list[str] = []
    availability: dict = {}


class SurveySubmit(BaseModel):
    session_id: str
    rating: int
    feedback_text: Optional[str] = None
    improved_areas: Optional[str] = None
    unresolved_items: Optional[str] = None
    would_recommend: Optional[bool] = None


# ========== HELPERS ==========

def _coach_from_row(row) -> CoachProfile:
    specialties = []
    availability = {}
    try:
        specialties = json.loads(row["specialties_json"]) if row["specialties_json"] else []
        availability = json.loads(row["availability_json"]) if row["availability_json"] else {}
    except:
        pass

    return CoachProfile(
        id=row["id"],
        display_name=row["display_name"] or row["discord_username"],
        discord_username=row["discord_username"],
        avatar_url=row["avatar_url"],
        bio=row["bio"],
        specialties=specialties,
        availability=availability,
        status=row["status"],
        avg_rating=row["avg_rating"] or 0,
        total_reviews=row["total_reviews"] or 0,
        total_sessions=row["total_sessions"] or 0,
        twitch_url=row["twitch_url"] if "twitch_url" in row.keys() else None,
    )


def _review_from_row(row) -> CoachReview:
    return CoachReview(
        id=row["id"],
        coach_id=row["coach_id"],
        user_display_name=row["user_display_name"] or "Anonymous",
        rating=row["rating"],
        feedback_text=row["feedback_text"],
        improved_areas=row["improved_areas"],
        created_at=row["created_at"],
    )


def _request_from_row(row) -> CoachingRequest:
    return CoachingRequest(
        id=row["id"],
        discord_username=row["discord_username"],
        rank=row["rank"],
        subrank=row["subrank"],
        hero=row["hero"],
        games_played=row["games_played"],
        hours_played=row["hours_played"],
        availability=row["availability"],
        current_problems=row["current_problems"],
        ai_summary=row["ai_summary"],
        status=row["status"],
        created_at=row["created_at"],
    )


def _build_anonymous_review_label(discord_user_id: Optional[int], coach_id: str) -> str:
    if discord_user_id is None:
        return "Anonym"

    digest = hashlib.sha256(f"{discord_user_id}{coach_id}".encode("utf-8")).hexdigest()[:6]
    return f"Coachee #{digest}"


# Service-zu-Service-Auth: gleicher interner Token wie im restlichen Stack
# (X-Internal-Token / TWITCH_INTERNAL_API_TOKEN, wie master_broker/public_stats).
# COACHING_BOT_TOKEN bleibt nur optionaler Fallback — kein neues Secret noetig.
_BOT_TOKEN_ENV_NAMES = (
    "TWITCH_INTERNAL_API_TOKEN",
    "MASTER_BROKER_TOKEN",
    "COACHING_BOT_TOKEN",
)


def require_bot_token(request: Request) -> None:
    secret = ""
    for _name in _BOT_TOKEN_ENV_NAMES:
        secret = (os.environ.get(_name) or "").strip()
        if secret:
            break
    if not secret:
        logger.error(
            "Kein interner Token gesetzt (%s); weise Bot-Endpoint ab",
            "/".join(_BOT_TOKEN_ENV_NAMES),
        )
        raise HTTPException(503, "Internal API token is not configured")

    provided_token = (
        request.headers.get("X-Internal-Token")
        or request.headers.get("X-Bot-Token")
        or ""
    )
    if not hmac.compare_digest(provided_token, secret):
        raise HTTPException(401, "Invalid internal token")


# ========== PUBLIC ROUTES (Coach Profiles) ==========

@router.get("/coaches", response_model=list[CoachProfile])
async def list_coaches(specialty: Optional[str] = None, min_rating: Optional[float] = None):
    """Public: List active coaches, optionally filtered."""
    db = await get_db()
    try:
        query = "SELECT * FROM coaches WHERE status='active'"
        params = []
        if specialty:
            query += " AND specialties_json LIKE ?"
            params.append(f"%{specialty}%")
        if min_rating:
            query += " AND avg_rating >= ?"
            params.append(min_rating)
        query += " ORDER BY avg_rating DESC, total_sessions DESC"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [_coach_from_row(row) for row in rows]
    finally:
        await db.close()


@router.get("/coaches/{coach_id}", response_model=CoachProfile)
async def get_coach(coach_id: str):
    """Public: Get coach profile by internal UUID."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM coaches WHERE id=?", (coach_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Coach not found")
        return _coach_from_row(row)
    finally:
        await db.close()


@router.get("/coaches/{coach_id}/reviews", response_model=list[CoachReview])
async def get_coach_reviews(coach_id: str):
    """Public: Get reviews for a coach."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM coach_reviews WHERE coach_id=? ORDER BY created_at DESC",
            (coach_id,)
        )
        rows = await cursor.fetchall()
        return [_review_from_row(row) for row in rows]
    finally:
        await db.close()


# ========== COACH PROFILE MANAGEMENT ==========

@router.post("/coaches/profile", response_model=CoachProfile)
async def create_or_update_coach_profile(profile: CoachProfileCreate, request: Request):
    """Create or update coach profile. Requires Discord auth."""
    user_data = await require_authenticated_user(request)

    if str(user_data["sub"]) != str(profile.discord_user_id):
        raise HTTPException(403, "Cannot create profile for another user")

    db = await get_db()
    try:
        # Check if profile exists
        cursor = await db.execute(
            "SELECT id FROM coaches WHERE discord_user_id=?",
            (profile.discord_user_id,)
        )
        existing = await cursor.fetchone()

        if existing:
            coach_id = existing["id"]
            await db.execute("""
                UPDATE coaches SET
                    display_name=?, bio=?, specialties_json=?, availability_json=?,
                    avatar_url=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (
                profile.display_name, profile.bio,
                json.dumps(profile.specialties), json.dumps(profile.availability),
                profile.avatar_url, coach_id
            ))
        else:
            coach_id = secrets.token_urlsafe(16)
            await db.execute("""
                INSERT INTO coaches (id, discord_user_id, discord_username, display_name,
                    avatar_url, bio, specialties_json, availability_json, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """, (
                coach_id, profile.discord_user_id, profile.discord_username,
                profile.display_name, profile.avatar_url, profile.bio,
                json.dumps(profile.specialties), json.dumps(profile.availability)
            ))

        await db.commit()

        # Return updated profile
        cursor = await db.execute("SELECT * FROM coaches WHERE id=?", (coach_id,))
        row = await cursor.fetchone()
        return _coach_from_row(row)
    finally:
        await db.close()


# ========== COACH APPLICATIONS ==========

@router.post("/coaches/apply")
async def apply_to_be_coach(application: CoachApplicationCreate, request: Request):
    """Submit coach application. Requires Discord auth."""
    user_data = await require_authenticated_user(request)

    if str(user_data["sub"]) != str(application.discord_user_id):
        raise HTTPException(403, "Cannot submit application for another user")

    db = await get_db()
    try:
        # Check if already applied
        cursor = await db.execute(
            "SELECT id, status FROM coach_applications WHERE discord_user_id=?",
            (application.discord_user_id,)
        )
        existing = await cursor.fetchone()

        if existing:
            if existing["status"] in ("approved", "pending"):
                return {"id": existing["id"], "status": existing["status"], "message": "Application already submitted"}
            # Rejected - allow reapply
            app_id = existing["id"]
            await db.execute("""
                UPDATE coach_applications SET
                    application_text=?, experience_text=?, rank=?,
                    specialties_json=?, availability_json=?, status='pending',
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (
                application.application_text, application.experience_text, application.rank,
                json.dumps(application.specialties), json.dumps(application.availability), app_id
            ))
        else:
            app_id = secrets.token_urlsafe(16)
            await db.execute("""
                INSERT INTO coach_applications (id, discord_user_id, discord_username, display_name,
                    application_text, experience_text, rank, specialties_json, availability_json, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            """, (
                app_id, application.discord_user_id, application.discord_username,
                application.display_name, application.application_text,
                application.experience_text, application.rank,
                json.dumps(application.specialties), json.dumps(application.availability)
            ))

        await db.commit()
        return {"id": app_id, "status": "pending", "message": "Application submitted"}
    finally:
        await db.close()


# ========== COACHING REQUESTS (Bot → API) ==========

@router.post("/requests", response_model=CoachingRequest)
async def create_coaching_request(
    req: CoachingRequestCreate,
    _bot_auth: None = Depends(require_bot_token),
):
    """Bot endpoint: Create new coaching request after AI analysis."""
    db = await get_db()
    try:
        request_id = req.id or secrets.token_urlsafe(16)

        await db.execute("""
            INSERT INTO coaching_requests (id, discord_user_id, discord_username, rank, subrank,
                hero, games_played, hours_played, availability, current_problems,
                ai_summary, ai_insights_json, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (
            request_id, req.discord_user_id, req.discord_username, req.rank, req.subrank,
            req.hero, req.games_played, req.hours_played, req.availability,
            req.current_problems, req.ai_summary, req.ai_insights_json
        ))
        await db.commit()

        return CoachingRequest(
            id=request_id,
            discord_username=req.discord_username,
            rank=req.rank,
            subrank=req.subrank,
            hero=req.hero,
            games_played=req.games_played,
            hours_played=req.hours_played,
            availability=req.availability,
            current_problems=req.current_problems,
            ai_summary=req.ai_summary,
            status="pending",
            created_at=datetime.utcnow().isoformat(),
        )
    finally:
        await db.close()


@router.get("/requests", response_model=list[CoachingRequest])
async def list_coaching_requests(status: Optional[str] = None):
    """List coaching requests. For internal/bot use."""
    db = await get_db()
    try:
        query = "SELECT * FROM coaching_requests"
        params = []
        if status:
            query += " WHERE status=?"
            params.append(status)
        query += " ORDER BY created_at DESC"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [_request_from_row(row) for row in rows]
    finally:
        await db.close()


@router.patch("/requests/{request_id}/match")
async def match_coach_to_request(
    request_id: str,
    coach_id: str,
    discord_channel_id: Optional[int] = None,
    _bot_auth: None = Depends(require_bot_token),
):
    """Match a coach to a coaching request."""
    db = await get_db()
    try:
        # Get request info
        cursor = await db.execute(
            "SELECT * FROM coaching_requests WHERE id=?", (request_id,)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Request not found")

        # Create session
        session_id = secrets.token_urlsafe(16)
        await db.execute("""
            INSERT INTO coaching_sessions (id, request_id, coach_id, discord_user_id,
                discord_username, discord_channel_id, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        """, (
            session_id, request_id, coach_id, row["discord_user_id"],
            row["discord_username"], discord_channel_id
        ))

        # Update request status
        await db.execute(
            "UPDATE coaching_requests SET status='matched', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (request_id,)
        )

        await db.commit()
        return {"status": "matched", "session_id": session_id}
    finally:
        await db.close()


# ========== SURVEYS ==========

@router.post("/surveys")
async def submit_survey(
    survey: SurveySubmit,
    _bot_auth: None = Depends(require_bot_token),
):
    """Store post-coaching survey and update coach rating."""
    db = await get_db()
    try:
        # Get session info
        cursor = await db.execute(
            "SELECT * FROM coaching_sessions WHERE id=?", (survey.session_id,)
        )
        session = await cursor.fetchone()
        if not session:
            raise HTTPException(404, "Session not found")

        coach_id = session["coach_id"]

        # Store survey
        survey_id = secrets.token_urlsafe(16)
        await db.execute("""
            INSERT INTO coaching_surveys (id, session_id, rating, feedback_text,
                improved_areas, unresolved_items, would_recommend)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            survey_id, survey.session_id, survey.rating, survey.feedback_text,
            survey.improved_areas, survey.unresolved_items,
            1 if survey.would_recommend else 0 if survey.would_recommend is not None else None
        ))

        # Update session
        await db.execute(
            "UPDATE coaching_sessions SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?",
            (survey.session_id,)
        )

        # Update coach stats
        cursor = await db.execute("""
            SELECT AVG(rating) as avg, COUNT(*) as cnt FROM coaching_surveys WHERE session_id IN
            (SELECT id FROM coaching_sessions WHERE coach_id=?)
        """, (coach_id,))
        stats = await cursor.fetchone()

        # Insert review for public display
        review_id = secrets.token_urlsafe(16)
        await db.execute("""
            INSERT INTO coach_reviews (id, coach_id, session_id, user_display_name, rating, feedback_text, improved_areas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            review_id, coach_id, survey.session_id,
            _build_anonymous_review_label(session["discord_user_id"], coach_id),
            survey.rating, survey.feedback_text, survey.improved_areas
        ))

        # Update coach avg_rating and total_reviews
        if stats["avg"]:
            await db.execute("""
                UPDATE coaches SET
                    avg_rating=?, total_reviews=?, total_sessions=total_sessions+1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE id=?
            """, (stats["avg"], stats["cnt"], coach_id))

        await db.commit()
        return {"status": "stored", "survey_id": survey_id}
    finally:
        await db.close()


# ========== COACH DASHBOARD (Private) ==========

@router.get("/dashboard")
async def get_coach_dashboard(request: Request):
    """Get coach's private dashboard data. Requires auth."""
    user_data = await require_authenticated_user(request)

    db = await get_db()
    try:
        # Get coach profile
        cursor = await db.execute(
            "SELECT * FROM coaches WHERE discord_user_id=?",
            (int(user_data["sub"]),)
        )
        coach = await cursor.fetchone()

        if not coach:
            return {"profile": None, "sessions": [], "reviews": [], "applications": []}

        coach_id = coach["id"]

        # Get recent sessions
        cursor = await db.execute("""
            SELECT * FROM coaching_sessions WHERE coach_id=? ORDER BY created_at DESC LIMIT 10
        """, (coach_id,))
        sessions = await cursor.fetchall()

        # Get recent reviews
        cursor = await db.execute("""
            SELECT * FROM coach_reviews WHERE coach_id=? ORDER BY created_at DESC LIMIT 5
        """, (coach_id,))
        reviews = await cursor.fetchall()

        return {
            "profile": _coach_from_row(coach),
            "sessions": [dict(s) for s in sessions],
            "reviews": [_review_from_row(r) for r in reviews],
        }
    finally:
        await db.close()


# ========== BOT: SESSION END ==========

@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    _bot_auth: None = Depends(require_bot_token),
):
    """Bot endpoint: Mark session as completed."""
    db = await get_db()
    try:
        await db.execute(
            "UPDATE coaching_sessions SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?",
            (session_id,)
        )
        await db.commit()
        return {"status": "completed"}
    finally:
        await db.close()


# ========== ADMIN: APPROVE/REJECT APPLICATIONS ==========

@router.patch("/admin/applications/{application_id}")
async def review_application(
    application_id: str,
    status: str,
    request: Request,
):
    """Admin: Approve or reject coach application."""
    user_data = await require_admin_user(request)

    if status not in ("approved", "rejected"):
        raise HTTPException(400, "Status must be approved or rejected")

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM coach_applications WHERE id=?", (application_id,)
        )
        app = await cursor.fetchone()
        if not app:
            raise HTTPException(404, "Application not found")

        if status == "approved":
            # Create coach profile
            coach_id = secrets.token_urlsafe(16)
            await db.execute("""
                INSERT INTO coaches (id, discord_user_id, discord_username, display_name,
                    specialties_json, availability_json, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            """, (
                coach_id, app["discord_user_id"], app["discord_username"],
                app["display_name"], app["specialties_json"], app["availability_json"]
            ))

        await db.execute("""
            UPDATE coach_applications SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP
            WHERE id=?
        """, (status, user_data["sub"], application_id))

        await db.commit()
        return {"status": status}
    finally:
        await db.close()
