import aiosqlite
import os
from typing import Any

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "deadlock.db")
DB_PATH = os.getenv("DB_PATH") or DEFAULT_DB_PATH

_db: aiosqlite.Connection | None = None


class _DBProxy:
    """Proxies aiosqlite.Connection; close() is a no-op to keep the persistent connection alive."""
    def __init__(self, db: aiosqlite.Connection) -> None:
        self._db = db

    def __getattr__(self, name: str) -> Any:
        return getattr(self._db, name)

    async def close(self) -> None:
        pass


async def get_db() -> _DBProxy:
    return _DBProxy(_db)


async def close_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None


async def init_db():
    global _db
    async with aiosqlite.connect(DB_PATH) as db:
        # Meta Heroes
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_heroes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tier TEXT DEFAULT 'C',
                role TEXT,
                image_url TEXT,
                abilities_json TEXT,
                stats_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Users (Discord-based)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_users (
                id TEXT PRIMARY KEY,
                username TEXT,
                display_name TEXT,
                avatar_url TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Builds
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_builds (
                id TEXT PRIMARY KEY,
                hero_id TEXT REFERENCES meta_heroes(id),
                name TEXT NOT NULL,
                author_id TEXT,
                author_name TEXT,
                description TEXT,
                ability_order_json TEXT,
                items_json TEXT,
                upvotes INTEGER DEFAULT 0,
                downvotes INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Items
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                stats_json TEXT,
                image_url TEXT
            )
        """)

        # Meta TierLists
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_tier_lists (
                id TEXT PRIMARY KEY,
                name TEXT,
                owner_id TEXT,
                is_public INTEGER DEFAULT 0,
                secret_code TEXT,
                tiers_json TEXT,
                forked_from TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Votes
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_votes (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                build_id TEXT,
                vote_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, build_id)
            )
        """)

        # Meta Reports
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_reports (
                id TEXT PRIMARY KEY,
                build_id TEXT,
                reporter_id TEXT,
                reporter_name TEXT,
                reason TEXT,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta PatchNotes
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_patch_notes (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                version TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Announcements
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_announcements (
                id TEXT PRIMARY KEY,
                message TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meta Tier History
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meta_tier_history (
                id TEXT PRIMARY KEY,
                hero_id TEXT,
                hero_name TEXT,
                old_tier TEXT,
                new_tier TEXT,
                changed_by TEXT,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ========== COACHING SYSTEM ==========

        # Coaches (internal UUID, NO discord_user_id exposure to frontend)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coaches (
                id TEXT PRIMARY KEY,
                discord_user_id INTEGER UNIQUE NOT NULL,
                discord_username TEXT,
                display_name TEXT,
                avatar_url TEXT,
                bio TEXT,
                specialties_json TEXT DEFAULT '[]',
                availability_json TEXT DEFAULT '{}',
                status TEXT DEFAULT 'active',
                avg_rating REAL DEFAULT 0,
                total_reviews INTEGER DEFAULT 0,
                total_sessions INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Coach Reviews
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coach_reviews (
                id TEXT PRIMARY KEY,
                coach_id TEXT REFERENCES coaches(id),
                session_id TEXT,
                user_display_name TEXT,
                rating INTEGER CHECK(rating >= 0 AND rating <= 10),
                feedback_text TEXT,
                improved_areas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Coaching Requests
        await db.execute("""
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
                ai_summary TEXT,
                ai_insights_json TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Coaching Sessions
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coaching_sessions (
                id TEXT PRIMARY KEY,
                request_id TEXT REFERENCES coaching_requests(id),
                coach_id TEXT REFERENCES coaches(id),
                discord_user_id INTEGER NOT NULL,
                discord_username TEXT,
                discord_channel_id INTEGER,
                status TEXT DEFAULT 'active',
                scheduled_at TIMESTAMP,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Coaching Surveys
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coaching_surveys (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES coaching_sessions(id) UNIQUE,
                rating INTEGER CHECK(rating >= 0 AND rating <= 10),
                feedback_text TEXT,
                improved_areas TEXT,
                unresolved_items TEXT,
                would_recommend INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Coach Applications
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coach_applications (
                id TEXT PRIMARY KEY,
                discord_user_id INTEGER UNIQUE NOT NULL,
                discord_username TEXT,
                display_name TEXT,
                application_text TEXT,
                experience_text TEXT,
                rank TEXT,
                specialties_json TEXT DEFAULT '[]',
                availability_json TEXT DEFAULT '{}',
                status TEXT DEFAULT 'pending',
                reviewed_by TEXT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ========== COACHING PLATTFORM (Coachee-Profile, Ziele, Meilensteine, Notizen) ==========

        # Coachees = gecoachte Spieler (eigenes Profil, getrennt von coaches)
        await db.execute("""
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
            )
        """)

        # Ziele pro Coachee (vom Coach gepflegt)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coaching_goals (
                id TEXT PRIMARY KEY,
                coachee_id TEXT REFERENCES coachees(id),
                coach_id TEXT REFERENCES coaches(id),
                session_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'open',
                sort_order INTEGER DEFAULT 0,
                target_date TEXT,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Meilensteine pro Ziel
        await db.execute("""
            CREATE TABLE IF NOT EXISTS coaching_milestones (
                id TEXT PRIMARY KEY,
                goal_id TEXT REFERENCES coaching_goals(id),
                title TEXT NOT NULL,
                description TEXT,
                achieved INTEGER DEFAULT 0,
                achieved_at TIMESTAMP,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Session-Notizen ("Session auf Papier"); visibility steuert User-Sichtbarkeit
        await db.execute("""
            CREATE TABLE IF NOT EXISTS session_notes (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                coachee_id TEXT REFERENCES coachees(id),
                coach_id TEXT REFERENCES coaches(id),
                content TEXT,
                visibility TEXT DEFAULT 'coach_only',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Terminkalender für Coach ↔ Coachee
        await db.execute("""
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
            )
        """)

        # Idempotente ALTER-Nachrüstungen
        for _alter in (
            "ALTER TABLE coaching_requests ADD COLUMN assigned_coach_id TEXT",
            "ALTER TABLE coaching_requests ADD COLUMN assigned_coach_username TEXT",
            "ALTER TABLE coaching_requests ADD COLUMN reserved_until INTEGER",
            "ALTER TABLE coaching_sessions ADD COLUMN coachee_id TEXT",
            "ALTER TABLE coaching_requests ADD COLUMN bot_request_id INTEGER",
            "ALTER TABLE coaching_sessions ADD COLUMN bot_session_id TEXT",
            "ALTER TABLE coaches ADD COLUMN twitch_url TEXT",
        ):
            try:
                await db.execute(_alter)
            except Exception:
                pass  # Spalte existiert bereits

        await db.commit()

        # Insert sample data if empty
        cursor = await db.execute("SELECT COUNT(*) FROM meta_heroes")
        count = (await cursor.fetchone())[0]
        if count == 0:
            await insert_sample_data(db)

    _db = await aiosqlite.connect(DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA synchronous=NORMAL")

async def insert_sample_data(db):
    # Real heroes from deadlockmeta.com with correct tiers and local image paths
    sample_heroes = [
        ("h1", "Abrams", "A", "Tank", "/heroes-img/Abrams.png", '[]', '{"health":300,"armor":20,"speed":280,"damage":45}'),
        ("h2", "Bebop", "C", "Tank", "/heroes-img/Bebop.png", '[]', '{"health":280,"armor":25,"speed":260,"damage":50}'),
        ("h3", "Dynamo", "B", "Mage", "/heroes-img/Dynamo.png", '[]', '{"health":220,"armor":8,"speed":290,"damage":70}'),
        ("h4", "Grey Talon", "B", "Marksman", "/heroes-img/GreyTalon.png", '[]', '{"health":180,"armor":5,"speed":320,"damage":68}'),
        ("h5", "Haze", "A", "Assassin", "/heroes-img/Haze.png", '[]', '{"health":190,"armor":6,"speed":340,"damage":65}'),
        ("h6", "Holliday", "B", "Support", "/heroes-img/Holliday.png", '[]', '{"health":200,"armor":10,"speed":300,"damage":45}'),
        ("h7", "Infernus", "B", "Mage", "/heroes-img/Infernus.png", '[]', '{"health":210,"armor":8,"speed":295,"damage":68}'),
        ("h8", "Seven", "B", "Marksman", "/heroes-img/Seven.png", '[]', '{"health":195,"armor":6,"speed":310,"damage":62}'),
        ("h9", "Victor", "B", "Marksman", "/heroes-img/Victor.png", '[]', '{"health":185,"armor":5,"speed":315,"damage":60}'),
        ("h10", "Vyper", "B", "Assassin", "/heroes-img/Vyper.png", '[]', '{"health":175,"armor":4,"speed":330,"damage":58}'),
        ("h11", "Calico", "S", "Marksman", "/heroes-img/Calico.png", '[]', '{"health":190,"armor":7,"speed":305,"damage":64}'),
        ("h12", "Drifter", "S", "Warrior", "/heroes-img/Drifter.png", '[]', '{"health":230,"armor":12,"speed":295,"damage":55}'),
        ("h13", "Graves", "S", "Marksman", "/heroes-img/Graves.png", '[]', '{"health":200,"armor":8,"speed":300,"damage":60}'),
        ("h14", "Ivy", "S", "Mage", "/heroes-img/Ivy.png", '[]', '{"health":185,"armor":5,"speed":305,"damage":72}'),
        ("h15", "Kelvin", "S", "Tank", "/heroes-img/Kelvin.png", '[]', '{"health":300,"armor":22,"speed":270,"damage":45}'),
        ("h16", "Lady Geist", "S", "Mage", "/heroes-img/LadyGeist.png", '[]', '{"health":175,"armor":4,"speed":315,"damage":75}'),
        ("h17", "Mo & Krill", "S", "Tank", "/heroes-img/MoKrill.png", '[]', '{"health":290,"armor":24,"speed":265,"damage":48}'),
        ("h18", "Sinclair", "S", "Marksman", "/heroes-img/Sinclair.png", '[]', '{"health":195,"armor":7,"speed":308,"damage":62}'),
        ("h19", "Venator", "S", "Marksman", "/heroes-img/Venator.png", '[]', '{"health":200,"armor":8,"speed":302,"damage":61}'),
        ("h20", "Wraith", "S", "Assassin", "/heroes-img/Wraith.png", '[]', '{"health":180,"armor":5,"speed":335,"damage":70}'),
        ("h21", "Apollo", "S+", "Marksman", "/heroes-img/Apollo.png", '[]', '{"health":205,"armor":9,"speed":300,"damage":63}'),
        ("h22", "Billy", "S+", "Warrior", "/heroes-img/Billy.png", '[]', '{"health":250,"armor":15,"speed":285,"damage":58}'),
        ("h23", "Mirage", "S+", "Assassin", "/heroes-img/Mirage.png", '[]', '{"health":185,"armor":5,"speed":340,"damage":68}'),
        ("h24", "Silver", "S+", "Marksman", "/heroes-img/Silver.png", '[]', '{"health":195,"armor":7,"speed":310,"damage":65}'),
        ("h25", "Celeste", "S+", "Mage", "/heroes-img/Celeste.png", '[]', '{"health":180,"armor":4,"speed":305,"damage":74}'),
        ("h26", "Doorman", "A", "Tank", "/heroes-img/Doorman.png", '[]', '{"health":310,"armor":26,"speed":255,"damage":42}'),
        ("h27", "Lash", "A", "Warrior", "/heroes-img/Lash.png", '[]', '{"health":240,"armor":14,"speed":288,"damage":52}'),
        ("h28", "McGinnis", "A", "Support", "/heroes-img/McGinnis.png", '[]', '{"health":210,"armor":10,"speed":295,"damage":48}'),
        ("h29", "Mina", "A", "Support", "/heroes-img/Mina.png", '[]', '{"health":195,"armor":8,"speed":300,"damage":50}'),
        ("h30", "Paige", "A", "Marksman", "/heroes-img/Paige.png", '[]', '{"health":190,"armor":6,"speed":315,"damage":60}'),
        ("h31", "Paradox", "A", "Warrior", "/heroes-img/Paradox.png", '[]', '{"health":225,"armor":12,"speed":292,"damage":54}'),
        ("h32", "Pocket", "A", "Mage", "/heroes-img/Pocket.png", '[]', '{"health":170,"armor":4,"speed":320,"damage":72}'),
        ("h33", "Rem", "A", "Marksman", "/heroes-img/Rem.png", '[]', '{"health":195,"armor":7,"speed":308,"damage":61}'),
        ("h34", "Shiv", "A", "Assassin", "/heroes-img/Shiv.png", '[]', '{"health":175,"armor":4,"speed":342,"damage":66}'),
        ("h35", "Vindicta", "A", "Marksman", "/heroes-img/Vindicta.png", '[]', '{"health":185,"armor":5,"speed":318,"damage":62}'),
        ("h36", "Viscous", "A", "Tank", "/heroes-img/Viscous.png", '[]', '{"health":275,"armor":20,"speed":270,"damage":46}'),
        ("h37", "Warden", "A", "Tank", "/heroes-img/Warden.png", '[]', '{"health":295,"armor":23,"speed":260,"damage":44}'),
        ("h38", "Yamato", "A", "Warrior", "/heroes-img/Yamato.png", '[]', '{"health":235,"armor":13,"speed":290,"damage":53}'),
    ]
    await db.executemany(
        "INSERT INTO meta_heroes (id, name, tier, role, image_url, abilities_json, stats_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        sample_heroes
    )

    # Sample builds - matching the real heroes
    sample_builds = [
        ("b1", "h21", "Divine Carbine Rush", "Deathy", "Deathy", "Standard early game rifle build for Apollo", "[2,1,1,3,1,4,1,3,3,2]", "[{\"slot\":1,\"itemId\":\"i1\",\"itemName\":\"Divine Carbine\"},{\"slot\":2,\"itemId\":\"i2\",\"itemName\":\"Rapid Rounds\"}]", 45, 3, "verified"),
        ("b2", "h22", "Crowbar + Enduring", "Deathy", "Deathy", "Billy aggressive melee build", "[1,2,1,3,1,4,2,3,2,2]", "[{\"slot\":1,\"itemId\":\"i3\",\"itemName\":\"Crowbar\"},{\"slot\":2,\"itemId\":\"i4\",\"itemName\":\"Enduring\"}]", 38, 2, "verified"),
        ("b3", "h23", "Kappa + Shadow", "Deathy", "Deathy", "Mirage assassin burst build", "[2,1,2,3,1,4,1,3,2,2]", "[{\"slot\":1,\"itemId\":\"i5\",\"itemName\":\"Kappa\"},{\"slot\":2,\"itemId\":\"i6\",\"itemName\":\"Shadow\"}]", 52, 4, "verified"),
        ("b4", "h24", "Rifle Build", "Deathy", "Deathy", "Silver sustained damage", "[1,2,1,3,2,4,1,3,2,2]", "[{\"slot\":1,\"itemId\":\"i7\",\"itemName\":\"Rifle\"},{\"slot\":2,\"itemId\":\"i8\",\"itemName\":\"Amplifier\"}]", 41, 5, "verified"),
        ("b5", "h25", "Staff + Arcane", "Deathy", "Deathy", "Celeste burst mage", "[2,1,2,3,1,4,1,3,2,2]", "[{\"slot\":1,\"itemId\":\"i9\",\"itemName\":\"Staff\"},{\"slot\":2,\"itemId\":\"i10\",\"itemName\":\"Arcane\"}]", 48, 2, "verified"),
    ]
    await db.executemany(
        "INSERT INTO meta_builds (id, hero_id, name, author_id, author_name, description, ability_order_json, items_json, upvotes, downvotes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sample_builds
    )

    # Real tier list from deadlockmeta.com (March 2026)
    await db.execute("""
        INSERT INTO meta_tier_lists (id, name, owner_id, is_public, tiers_json)
        VALUES ('tl1', 'Deathy Tier List - March 2026', 'admin', 1, '{"S+":["h21","h22","h23","h24","h25"],"S":["h11","h12","h13","h14","h15","h16","h17","h18","h19","h20"],"A":["h1","h26","h27","h28","h29","h30","h31","h32","h33","h34","h35","h36","h37","h38"],"B":["h3","h4","h6","h7","h8","h9","h10"],"C":["h2"],"D":[],"F":[]}')
    """)

    # Sample patch note
    await db.execute("""
        INSERT INTO meta_patch_notes (id, title, content, version)
        VALUES ('pn1', 'Patch 1.0', 'Initial release. Tier list and builds added.', '1.0.0')
    """)

    await db.commit()
