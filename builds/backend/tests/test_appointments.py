"""
Tests für die neuen Coaching-Appointments-Endpunkte.

Setup-Muster:
- In-Memory-SQLite, Schema direkt angelegt (ohne init_db-Sample-Daten)
- Bot-Auth: TWITCH_INTERNAL_API_TOKEN Env + Header X-Internal-Token
- Coach-Auth: Dependency-Override auf require_coach_user / require_authenticated_user
  (die Funktionen nehmen Request, geben dict zurück → Override als callable)
"""

import asyncio
import json
import os
import pytest

os.environ["TWITCH_INTERNAL_API_TOKEN"] = "test-secret-xyz"
os.environ["DB_PATH"] = ":memory:"
os.environ["AUTH_SESSION_SECRET"] = "test-session-secret"

import aiosqlite
from httpx import AsyncClient, ASGITransport

from app.main import app
from app import database as db_module
from app.routers import coaching as coaching_module
from app.routers import coaching_platform as cp_module
from app.routers import auth as auth_module


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture()
def fresh_db(event_loop):
    """Frische In-Memory-DB für jeden Test; setzt db_module._db direkt."""

    async def setup():
        if db_module._db is not None:
            try:
                await db_module._db.close()
            except Exception:
                pass
        conn = await aiosqlite.connect(":memory:")
        conn.row_factory = aiosqlite.Row
        db_module._db = conn
        await _create_schema(conn)

    async def teardown():
        if db_module._db is not None:
            try:
                await db_module._db.close()
            except Exception:
                pass
            db_module._db = None

    event_loop.run_until_complete(setup())
    yield
    event_loop.run_until_complete(teardown())


async def _create_schema(db):
    """Minimales Schema für Appointment-Tests."""
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS coaches (
            id TEXT PRIMARY KEY,
            discord_user_id INTEGER UNIQUE NOT NULL,
            discord_username TEXT,
            display_name TEXT,
            avatar_url TEXT,
            bio TEXT,
            specialties_json TEXT DEFAULT '[]',
            availability_json TEXT DEFAULT '{}',
            twitch_url TEXT,
            status TEXT DEFAULT 'active',
            avg_rating REAL DEFAULT 0,
            total_reviews INTEGER DEFAULT 0,
            total_sessions INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meta_users (
            id TEXT PRIMARY KEY,
            username TEXT,
            display_name TEXT,
            avatar_url TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coachees (
            id TEXT PRIMARY KEY,
            discord_user_id INTEGER UNIQUE NOT NULL,
            discord_username TEXT,
            display_name TEXT,
            rank TEXT,
            main_heroes_json TEXT DEFAULT '[]',
            current_focus TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coaching_appointments (
            id TEXT PRIMARY KEY,
            coach_id TEXT REFERENCES coaches(id),
            coachee_id TEXT REFERENCES coachees(id),
            scheduled_at TEXT NOT NULL,
            duration_minutes INTEGER DEFAULT 60,
            title TEXT,
            note TEXT,
            status TEXT DEFAULT 'scheduled',
            notify_created_at TEXT,
            notify_reminder_at TEXT,
            notify_cancelled_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coaching_sessions (
            id TEXT PRIMARY KEY,
            request_id TEXT,
            coach_id TEXT,
            coachee_id TEXT,
            discord_user_id INTEGER,
            discord_username TEXT,
            status TEXT DEFAULT 'active',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coaching_requests (
            id TEXT PRIMARY KEY,
            discord_user_id INTEGER NOT NULL,
            discord_username TEXT,
            rank TEXT NOT NULL DEFAULT '',
            subrank TEXT NOT NULL DEFAULT '',
            hero TEXT,
            games_played TEXT,
            hours_played TEXT,
            availability TEXT,
            current_problems TEXT,
            preferred_coach_id TEXT,
            ai_summary TEXT,
            ai_insights_json TEXT,
            status TEXT DEFAULT 'pending',
            notify_discord_at TIMESTAMP,
            assigned_coach_id TEXT,
            assigned_coach_username TEXT,
            reserved_until INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS session_notes (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            coachee_id TEXT,
            coach_id TEXT,
            content TEXT,
            visibility TEXT DEFAULT 'coach_only',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coaching_goals (
            id TEXT PRIMARY KEY,
            coachee_id TEXT,
            coach_id TEXT,
            session_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'open',
            sort_order INTEGER DEFAULT 0,
            target_date TEXT,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS coaching_milestones (
            id TEXT PRIMARY KEY,
            goal_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            achieved INTEGER DEFAULT 0,
            achieved_at TIMESTAMP,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    await db.commit()


# ---------------------------------------------------------------------------
# Auth-Mocks
# ---------------------------------------------------------------------------

BOT_HEADERS = {"X-Internal-Token": "test-secret-xyz"}


def _override_coach_user(discord_id: int = 1001, role: str = "coach"):
    """Dependency-Override für require_coach_user."""
    async def _inner(request):
        return {"sub": str(discord_id), "role": role, "displayName": f"Coach_{discord_id}"}
    return _inner


def _override_authenticated_user(discord_id: int = 2001):
    async def _inner(request):
        return {"sub": str(discord_id), "role": "user", "displayName": f"User_{discord_id}"}
    return _inner


import contextlib


@contextlib.asynccontextmanager
async def _mock_coach(discord_id: int = 1001, role: str = "coach"):
    """
    Monkeypatch require_coach_user direkt im coaching_platform-Modul.
    Notwendig weil die Routen require_coach_user direkt aufrufen (nicht als Depends).
    """
    orig = cp_module.require_coach_user

    async def _fake(request):
        return {"sub": str(discord_id), "role": role, "displayName": f"Coach_{discord_id}"}

    cp_module.require_coach_user = _fake
    try:
        yield
    finally:
        cp_module.require_coach_user = orig


@contextlib.asynccontextmanager
async def _mock_auth_user(discord_id: int = 2001):
    orig = cp_module.require_authenticated_user

    async def _fake(request):
        return {"sub": str(discord_id), "role": "user", "displayName": f"User_{discord_id}"}

    cp_module.require_authenticated_user = _fake
    try:
        yield
    finally:
        cp_module.require_authenticated_user = orig


# ---------------------------------------------------------------------------
# DB-Helfer
# ---------------------------------------------------------------------------

async def _insert_coach(discord_id: int = 1001, display_name: str = "Coach A") -> str:
    db = db_module._db
    coach_id = f"c-{discord_id}"
    await db.execute(
        """INSERT OR IGNORE INTO coaches
               (id, discord_user_id, discord_username, display_name, status)
           VALUES (?, ?, ?, ?, 'active')""",
        (coach_id, discord_id, display_name.lower().replace(" ", "_"), display_name),
    )
    await db.commit()
    return coach_id


async def _insert_coachee(discord_id: int = 2001, display_name: str = "Spieler A") -> str:
    db = db_module._db
    coachee_id = f"ce-{discord_id}"
    await db.execute(
        """INSERT OR IGNORE INTO coachees
               (id, discord_user_id, discord_username, display_name)
           VALUES (?, ?, ?, ?)""",
        (coachee_id, discord_id, display_name.lower().replace(" ", "_"), display_name),
    )
    await db.commit()
    return coachee_id


# ===========================================================================
# Tests: Coaching-Anfragen
# ===========================================================================

@pytest.mark.asyncio
async def test_create_request_website_session_ignoriert_payload_identitaet(fresh_db):
    """Website-User darf discord_user_id/discord_username nicht per Payload spoofen."""
    session_token = auth_module.create_jwt(
        "2001",
        "session_user",
        "user",
        display_name="Session User",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set(auth_module.SESSION_COOKIE_NAME, session_token)
        r = await client.post("/api/coaching/requests", json={
            "display_name": "Payload Name",
            "discord_user_id": 9999,
            "discord_username": "spoofed_user",
            "rank": "Archon 3",
            "hero": "Haze",
            "availability": "2026-07-01T14:00",
            "games_played": "300 Games / 150 Stunden",
            "hours_played": "300 Games / 150 Stunden",
            "current_problems": "Laning und Teamfights",
            "preferred_coach_id": "coach-wunsch",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["discord_username"] == "session_user"
        assert data["subrank"] == ""

    db = db_module._db
    cur = await db.execute(
        """SELECT discord_user_id, discord_username, rank, subrank, current_problems
           FROM coaching_requests WHERE id=?""",
        (data["id"],),
    )
    row = await cur.fetchone()
    assert row["discord_user_id"] == 2001
    assert row["discord_username"] == "session_user"
    assert row["rank"] == "Archon 3"
    assert row["subrank"] == ""
    assert row["current_problems"] == "Laning und Teamfights"


@pytest.mark.asyncio
async def test_notifications_due_request_created_ack_idempotent(fresh_db):
    """Neue Coaching-Requests erscheinen einmal als request_created und verschwinden nach Ack."""
    request_id = "req-notify-1"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/coaching/requests",
            headers=BOT_HEADERS,
            json={
                "id": request_id,
                "discord_user_id": 424242,
                "discord_username": "queue_user",
                "rank": "Archon",
                "subrank": "3",
                "hero": "Haze",
                "games_played": "123",
                "hours_played": "456",
                "availability": "werktags abends",
                "current_problems": "Laning und Teamfights",
                "preferred_coach_id": "coach-pref-1",
            },
        )
        assert r.status_code == 200, r.text

        orig_uid = cp_module._uid
        cp_module._uid = lambda: "coachee-notify-1"
        try:
            due = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
            assert due.status_code == 200, due.text
        finally:
            cp_module._uid = orig_uid
        notifs = due.json()["notifications"]
        request_notifs = [n for n in notifs if n["type"] == "request_created"]
        assert len(request_notifs) == 1

        db = db_module._db
        cur = await db.execute("SELECT id FROM coachees WHERE discord_user_id=424242")
        coachee = await cur.fetchone()
        assert coachee is not None
        assert coachee["id"] == "coachee-notify-1"

        item = request_notifs[0]
        assert item == {
            "type": "request_created",
            "request_id": request_id,
            "coachee_id": "coachee-notify-1",
            "discord_user_id": 424242,
            "discord_username": "queue_user",
            "rank": "Archon",
            "subrank": "3",
            "hero": "Haze",
            "games_played": "123",
            "hours_played": "456",
            "availability": "werktags abends",
            "current_problems": "Laning und Teamfights",
            "preferred_coach_id": "coach-pref-1",
        }

        ack = await client.post(
            "/api/coaching/platform/notifications/ack",
            headers=BOT_HEADERS,
            json={"request_ids": [request_id]},
        )
        assert ack.status_code == 200, ack.text
        assert ack.json()["acked"] == 1

        due_after_ack = await client.get(
            "/api/coaching/platform/notifications/due",
            headers=BOT_HEADERS,
        )
        assert due_after_ack.status_code == 200, due_after_ack.text
        assert [
            n for n in due_after_ack.json()["notifications"]
            if n.get("request_id") == request_id
        ] == []

        ack_again = await client.post(
            "/api/coaching/platform/notifications/ack",
            headers=BOT_HEADERS,
            json={"request_ids": [request_id]},
        )
        assert ack_again.status_code == 200, ack_again.text
        assert ack_again.json()["acked"] == 0

        due_again = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
        assert [
            n for n in due_again.json()["notifications"]
            if n.get("request_id") == request_id
        ] == []


# ===========================================================================
# Tests: Bot-Mirror Coaching-Requests
# ===========================================================================

@pytest.mark.asyncio
async def test_platform_sync_website_request_id_aktualisiert_original_ohne_duplikat(fresh_db):
    """Website-staemmige Requests werden per Original-ID aktualisiert, nicht per Bot-ID dupliziert."""
    website_request_id = "website-token-original"
    bot_request_id = 98765
    db = db_module._db
    await db.execute(
        """INSERT INTO coaching_requests
               (id, discord_user_id, discord_username, rank, subrank, status)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            website_request_id,
            424242,
            "website_user",
            "Archon",
            "3",
            "pending",
        ),
    )
    await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/coaching/platform/sync",
            headers=BOT_HEADERS,
            json={
                "bot_request_id": bot_request_id,
                "website_request_id": website_request_id,
                "discord_user_id": 424242,
                "discord_username": "website_user",
                "rank": "Archon",
                "subrank": "3",
                "status": "claimed",
                "assigned_coach_discord_id": 1001,
                "assigned_coach_username": "coach_alpha",
                "reserved_until": 1790000000,
                "coach_discord_id": 1001,
                "coach_username": "coach_alpha",
                "session_status": "active",
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    cur = await db.execute("SELECT COUNT(*) AS count FROM coaching_requests")
    count_row = await cur.fetchone()
    assert count_row["count"] == 1

    cur = await db.execute(
        """SELECT id, assigned_coach_id, assigned_coach_username, status, reserved_until
           FROM coaching_requests WHERE id=?""",
        (website_request_id,),
    )
    row = await cur.fetchone()
    assert row["id"] == website_request_id
    assert row["assigned_coach_id"] == "1001"
    assert row["assigned_coach_username"] == "coach_alpha"
    assert row["status"] == "claimed"
    assert row["reserved_until"] == 1790000000

    cur = await db.execute(
        "SELECT id FROM coaching_requests WHERE id=?",
        (str(bot_request_id),),
    )
    assert await cur.fetchone() is None

    cur = await db.execute("SELECT request_id, status FROM coaching_sessions")
    session = await cur.fetchone()
    assert session["request_id"] == website_request_id
    assert session["status"] == "active"


@pytest.mark.asyncio
async def test_platform_sync_ohne_website_request_id_bleibt_bot_id_upsert(fresh_db):
    """Bot-staemmige Requests werden weiter per bot_request_id eingefuegt und aktualisiert."""
    bot_request_id = 2468

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/coaching/platform/sync",
            headers=BOT_HEADERS,
            json={
                "bot_request_id": bot_request_id,
                "discord_user_id": 515151,
                "discord_username": "bot_user",
                "rank": "Initiate",
                "subrank": "1",
                "status": "analyzed",
            },
        )
        assert r.status_code == 200, r.text

        r2 = await client.post(
            "/api/coaching/platform/sync",
            headers=BOT_HEADERS,
            json={
                "bot_request_id": bot_request_id,
                "discord_user_id": 515151,
                "discord_username": "bot_user_updated",
                "rank": "Archon",
                "subrank": "4",
                "status": "reserved",
                "assigned_coach_discord_id": 1002,
                "assigned_coach_username": "coach_beta",
                "reserved_until": 1790000100,
            },
        )
        assert r2.status_code == 200, r2.text

    db = db_module._db
    cur = await db.execute("SELECT COUNT(*) AS count FROM coaching_requests")
    count_row = await cur.fetchone()
    assert count_row["count"] == 1

    cur = await db.execute(
        """SELECT id, discord_username, rank, subrank, status, assigned_coach_id,
                  assigned_coach_username, reserved_until
           FROM coaching_requests WHERE id=?""",
        (str(bot_request_id),),
    )
    row = await cur.fetchone()
    assert row["id"] == str(bot_request_id)
    assert row["discord_username"] == "bot_user_updated"
    assert row["rank"] == "Archon"
    assert row["subrank"] == "4"
    assert row["status"] == "reserved"
    assert row["assigned_coach_id"] == "1002"
    assert row["assigned_coach_username"] == "coach_beta"
    assert row["reserved_until"] == 1790000100


# ===========================================================================
# Tests: Coach-Rollen-Sync
# ===========================================================================

@pytest.mark.asyncio
async def test_sync_upsert_und_deaktivierung(fresh_db):
    """Sync fügt Coaches ein und deaktiviert fehlende."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Erst-Sync: zwei Coaches
        r = await client.post(
            "/api/coaching/platform/coaches/sync",
            headers=BOT_HEADERS,
            json={"coaches": [
                {"discord_user_id": 100, "discord_username": "alpha", "display_name": "Alpha"},
                {"discord_user_id": 101, "discord_username": "beta", "display_name": "Beta"},
            ]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["active"] == 2
        assert data["deactivated"] == 0

        # Zweiter Sync: nur noch alpha → beta wird deaktiviert
        r2 = await client.post(
            "/api/coaching/platform/coaches/sync",
            headers=BOT_HEADERS,
            json={"coaches": [
                {"discord_user_id": 100, "discord_username": "alpha-neu"},
            ]},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["deactivated"] == 1

    db = db_module._db
    cur = await db.execute("SELECT discord_username, status FROM coaches WHERE discord_user_id=100")
    row = await cur.fetchone()
    assert row["discord_username"] == "alpha-neu"
    assert row["status"] == "active"

    cur2 = await db.execute("SELECT status FROM coaches WHERE discord_user_id=101")
    row2 = await cur2.fetchone()
    assert row2["status"] == "inactive"


@pytest.mark.asyncio
async def test_sync_leere_liste_wird_ignoriert(fresh_db):
    """Leere Coach-Liste darf niemals alle Coaches deaktivieren."""
    await _insert_coach(1001)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/coaching/platform/coaches/sync",
            headers=BOT_HEADERS,
            json={"coaches": []},
        )
        assert r.status_code == 200, r.text
        assert r.json()["skipped"] is True

    db = db_module._db
    cur = await db.execute("SELECT status FROM coaches WHERE discord_user_id=1001")
    row = await cur.fetchone()
    assert row["status"] == "active"


@pytest.mark.asyncio
async def test_sync_ueberschreibt_nicht_bio_und_twitch_url(fresh_db):
    """bio und twitch_url bleiben nach Sync unverändert (Coach pflegt sie selbst)."""
    coach_id = await _insert_coach(1001)
    db = db_module._db
    await db.execute(
        "UPDATE coaches SET bio='Meine Bio', twitch_url='https://twitch.tv/test' WHERE id=?",
        (coach_id,),
    )
    await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/coaching/platform/coaches/sync",
            headers=BOT_HEADERS,
            json={"coaches": [{"discord_user_id": 1001, "discord_username": "updated"}]},
        )

    cur = await db.execute("SELECT bio, twitch_url FROM coaches WHERE discord_user_id=1001")
    row = await cur.fetchone()
    assert row["bio"] == "Meine Bio"
    assert row["twitch_url"] == "https://twitch.tv/test"


# ===========================================================================
# Tests: Termine anlegen + Berechtigungen
# ===========================================================================

@pytest.mark.asyncio
async def test_termin_anlegen(fresh_db):
    """Coach kann Termin für existierenden Coachee anlegen."""
    await _insert_coach(1001)
    coachee_id = await _insert_coachee(2001)

    async with _mock_coach(1001):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post("/api/coaching/platform/appointments", json={
                "coachee_id": coachee_id,
                "scheduled_at": "2026-07-01T14:00:00+00:00",
                "duration_minutes": 45,
                "title": "Erstes Review",
            })
            assert r.status_code == 200, r.text
            assert "id" in r.json()


@pytest.mark.asyncio
async def test_termin_anlegen_unbekannter_coachee(fresh_db):
    """Coachee-ID existiert nicht → 404."""
    await _insert_coach(1001)

    async with _mock_coach(1001):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post("/api/coaching/platform/appointments", json={
                "coachee_id": "existiert-nicht",
                "scheduled_at": "2026-07-01T14:00:00+00:00",
            })
            assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_termin_patch_fremder_coach_verboten(fresh_db):
    """Anderer Coach darf Termin nicht patchen → 403."""
    coach_a_id = await _insert_coach(1001, "Coach A")
    await _insert_coach(1002, "Coach B")
    coachee_id = await _insert_coachee(2001)

    db = db_module._db
    appt_id = "appt-test-1"
    await db.execute(
        """INSERT INTO coaching_appointments (id, coach_id, coachee_id, scheduled_at)
           VALUES (?, ?, ?, '2026-07-01T14:00:00')""",
        (appt_id, coach_a_id, coachee_id),
    )
    await db.commit()

    async with _mock_coach(1002):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.patch(f"/api/coaching/platform/appointments/{appt_id}",
                                   json={"title": "Überschreiben"})
            assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_termin_patch_eigener_coach_erlaubt(fresh_db):
    """Besitzender Coach darf patchen."""
    coach_id = await _insert_coach(1001)
    coachee_id = await _insert_coachee(2001)

    db = db_module._db
    appt_id = "appt-test-2"
    await db.execute(
        """INSERT INTO coaching_appointments (id, coach_id, coachee_id, scheduled_at)
           VALUES (?, ?, ?, '2026-07-01T15:00:00')""",
        (appt_id, coach_id, coachee_id),
    )
    await db.commit()

    async with _mock_coach(1001):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.patch(f"/api/coaching/platform/appointments/{appt_id}",
                                   json={"title": "Überarbeiteter Titel"})
            assert r.status_code == 200, r.text

    cur = await db.execute("SELECT title FROM coaching_appointments WHERE id=?", (appt_id,))
    row = await cur.fetchone()
    assert row["title"] == "Überarbeiteter Titel"


@pytest.mark.asyncio
async def test_reschedule_resettet_notify_stempel(fresh_db):
    """Wenn scheduled_at geändert wird → notify_created_at und notify_reminder_at auf NULL."""
    coach_id = await _insert_coach(1001)
    coachee_id = await _insert_coachee(2001)

    db = db_module._db
    appt_id = "appt-test-3"
    await db.execute(
        """INSERT INTO coaching_appointments
               (id, coach_id, coachee_id, scheduled_at, notify_created_at, notify_reminder_at)
           VALUES (?, ?, ?, '2026-06-10T10:00:00', '2026-06-09T08:00:00', '2026-06-10T08:00:00')""",
        (appt_id, coach_id, coachee_id),
    )
    await db.commit()

    async with _mock_coach(1001):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.patch(f"/api/coaching/platform/appointments/{appt_id}",
                                   json={"scheduled_at": "2026-07-15T14:00:00+00:00"})
            assert r.status_code == 200, r.text

    cur = await db.execute(
        "SELECT notify_created_at, notify_reminder_at FROM coaching_appointments WHERE id=?",
        (appt_id,),
    )
    row = await cur.fetchone()
    assert row["notify_created_at"] is None
    assert row["notify_reminder_at"] is None


# ===========================================================================
# Tests: Notification-Queue Flow
# ===========================================================================

@pytest.mark.asyncio
async def test_notifications_due_created_ack_reminder_flow(fresh_db):
    """
    Flow:
    1. Neuer Termin → type=created auftauchen
    2. Ack created → verschwindet aus created, Reminder-Fenster öffnet sich
    3. Termin in <2h → type=reminder auftauchen
    4. Ack reminder → verschwindet
    5. Status cancelled → type=cancelled auftauchen
    """
    from datetime import datetime, timedelta, timezone

    coach_id = await _insert_coach(1001)
    coachee_id = await _insert_coachee(2001)
    db = db_module._db

    # Termin in 1 Stunde (im Reminder-Fenster von 2h)
    in_1h = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    appt_id = "appt-flow-1"
    await db.execute(
        """INSERT INTO coaching_appointments (id, coach_id, coachee_id, scheduled_at, status)
           VALUES (?, ?, ?, ?, 'scheduled')""",
        (appt_id, coach_id, coachee_id, in_1h),
    )
    await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. created-Notification vorhanden, reminder noch nicht (notify_created_at IS NULL)
        r = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
        assert r.status_code == 200, r.text
        notifs = r.json()["notifications"]
        created = [n for n in notifs if n["type"] == "created" and n["appointment_id"] == appt_id]
        reminder = [n for n in notifs if n["type"] == "reminder" and n["appointment_id"] == appt_id]
        assert len(created) == 1
        assert len(reminder) == 0, "Reminder darf nicht vor Ack des created erscheinen"

        # 2. Ack created
        r_ack = await client.post(
            "/api/coaching/platform/notifications/ack",
            headers=BOT_HEADERS,
            json={"items": [{"appointment_id": appt_id, "type": "created"}]},
        )
        assert r_ack.status_code == 200, r_ack.text
        assert r_ack.json()["acked"] == 1

        # 3. Jetzt sollte reminder auftauchen (notify_created_at gesetzt, Termin in <2h)
        r2 = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
        notifs2 = r2.json()["notifications"]
        reminder2 = [n for n in notifs2 if n["type"] == "reminder" and n["appointment_id"] == appt_id]
        created2 = [n for n in notifs2 if n["type"] == "created" and n["appointment_id"] == appt_id]
        assert len(reminder2) == 1, "Reminder muss nach created-Ack erscheinen"
        assert len(created2) == 0, "created darf nach Ack nicht mehr erscheinen"

        # 4. Ack reminder
        await client.post(
            "/api/coaching/platform/notifications/ack",
            headers=BOT_HEADERS,
            json={"items": [{"appointment_id": appt_id, "type": "reminder"}]},
        )

        # 5. Termin absagen → cancelled-Notification
        await db.execute(
            "UPDATE coaching_appointments SET status='cancelled' WHERE id=?", (appt_id,)
        )
        await db.commit()

        r3 = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
        notifs3 = r3.json()["notifications"]
        cancelled = [n for n in notifs3 if n["type"] == "cancelled" and n["appointment_id"] == appt_id]
        assert len(cancelled) == 1

        # Ack cancelled → verschwindet
        await client.post(
            "/api/coaching/platform/notifications/ack",
            headers=BOT_HEADERS,
            json={"items": [{"appointment_id": appt_id, "type": "cancelled"}]},
        )
        r4 = await client.get("/api/coaching/platform/notifications/due", headers=BOT_HEADERS)
        notifs4 = r4.json()["notifications"]
        cancelled4 = [n for n in notifs4 if n["appointment_id"] == appt_id]
        assert len(cancelled4) == 0, "Nach vollständigem Ack keine Notifications mehr"
