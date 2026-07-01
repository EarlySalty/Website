use std::{path::Path, str::FromStr};

use anyhow::Context;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Executor, SqlitePool,
};

pub async fn connect(db_path: &str) -> anyhow::Result<SqlitePool> {
    let options = if db_path == ":memory:" {
        SqliteConnectOptions::from_str("sqlite::memory:")?
    } else {
        if let Some(parent) = Path::new(db_path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("DB-Verzeichnis anlegen: {}", parent.display()))?;
            }
        }
        SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true)
    };

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await?;

    let _ = sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await;
    sqlx::query("PRAGMA synchronous=NORMAL")
        .execute(&pool)
        .await?;

    Ok(pool)
}

pub async fn init(pool: &SqlitePool) -> anyhow::Result<()> {
    let schema = r#"
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
        );
        CREATE TABLE IF NOT EXISTS meta_users (
            id TEXT PRIMARY KEY,
            username TEXT,
            display_name TEXT,
            avatar_url TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        );
        CREATE TABLE IF NOT EXISTS meta_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            stats_json TEXT,
            image_url TEXT
        );
        CREATE TABLE IF NOT EXISTS meta_tier_lists (
            id TEXT PRIMARY KEY,
            name TEXT,
            owner_id TEXT,
            is_public INTEGER DEFAULT 0,
            secret_code TEXT,
            tiers_json TEXT,
            forked_from TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meta_votes (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            build_id TEXT,
            vote_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, build_id)
        );
        CREATE TABLE IF NOT EXISTS meta_reports (
            id TEXT PRIMARY KEY,
            build_id TEXT,
            reporter_id TEXT,
            reporter_name TEXT,
            reason TEXT,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meta_patch_notes (
            id TEXT PRIMARY KEY,
            title TEXT,
            content TEXT,
            version TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meta_announcements (
            id TEXT PRIMARY KEY,
            message TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meta_tier_history (
            id TEXT PRIMARY KEY,
            hero_id TEXT,
            hero_name TEXT,
            old_tier TEXT,
            new_tier TEXT,
            changed_by TEXT,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        );
        CREATE TABLE IF NOT EXISTS coach_reviews (
            id TEXT PRIMARY KEY,
            coach_id TEXT REFERENCES coaches(id),
            session_id TEXT,
            user_display_name TEXT,
            rating INTEGER CHECK(rating >= 0 AND rating <= 10),
            feedback_text TEXT,
            improved_areas TEXT,
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        );
        CREATE TABLE IF NOT EXISTS coaching_surveys (
            id TEXT PRIMARY KEY,
            session_id TEXT REFERENCES coaching_sessions(id) UNIQUE,
            rating INTEGER CHECK(rating >= 0 AND rating <= 10),
            feedback_text TEXT,
            improved_areas TEXT,
            unresolved_items TEXT,
            would_recommend INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
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
        );
        CREATE TABLE IF NOT EXISTS coaching_milestones (
            id TEXT PRIMARY KEY,
            goal_id TEXT REFERENCES coaching_goals(id),
            title TEXT NOT NULL,
            description TEXT,
            achieved INTEGER DEFAULT 0,
            achieved_at TIMESTAMP,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS session_notes (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            coachee_id TEXT REFERENCES coachees(id),
            coach_id TEXT REFERENCES coaches(id),
            content TEXT,
            visibility TEXT DEFAULT 'coach_only',
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
    "#;
    pool.execute(schema).await?;

    for alter in [
        "ALTER TABLE coaching_requests ADD COLUMN assigned_coach_id TEXT",
        "ALTER TABLE coaching_requests ADD COLUMN assigned_coach_username TEXT",
        "ALTER TABLE coaching_requests ADD COLUMN reserved_until INTEGER",
        "ALTER TABLE coaching_requests ADD COLUMN preferred_coach_id TEXT",
        "ALTER TABLE coaching_requests ADD COLUMN notify_discord_at TIMESTAMP",
        "ALTER TABLE coaching_sessions ADD COLUMN coachee_id TEXT",
        "ALTER TABLE coaching_requests ADD COLUMN bot_request_id INTEGER",
        "ALTER TABLE coaching_sessions ADD COLUMN bot_session_id TEXT",
        "ALTER TABLE coaches ADD COLUMN twitch_url TEXT",
    ] {
        let _ = sqlx::query(alter).execute(pool).await;
    }

    seed_sample_data_if_empty(pool).await?;
    Ok(())
}

async fn seed_sample_data_if_empty(pool: &SqlitePool) -> anyhow::Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meta_heroes")
        .fetch_one(pool)
        .await?;
    if count > 0 {
        return Ok(());
    }

    let heroes = [
        ("h1", "Abrams", "A", "Tank", "/heroes-img/Abrams.png"),
        ("h2", "Bebop", "C", "Tank", "/heroes-img/Bebop.png"),
        ("h3", "Dynamo", "B", "Mage", "/heroes-img/Dynamo.png"),
        (
            "h4",
            "Grey Talon",
            "B",
            "Marksman",
            "/heroes-img/GreyTalon.png",
        ),
        ("h5", "Haze", "A", "Assassin", "/heroes-img/Haze.png"),
    ];
    for (id, name, tier, role, image_url) in heroes {
        sqlx::query(
            "INSERT INTO meta_heroes (id, name, tier, role, image_url, abilities_json, stats_json) VALUES (?, ?, ?, ?, ?, '[]', '{}')",
        )
        .bind(id)
        .bind(name)
        .bind(tier)
        .bind(role)
        .bind(image_url)
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT INTO meta_tier_lists (id, name, owner_id, is_public, tiers_json) VALUES ('tl1', 'Deathy Tier List - March 2026', 'admin', 1, '{}')",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "INSERT INTO meta_patch_notes (id, title, content, version) VALUES ('pn1', 'Patch 1.0', 'Initial release. Tier list and builds added.', '1.0.0')",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn table_columns(
    pool: &SqlitePool,
    table: &str,
) -> Result<std::collections::HashSet<String>, sqlx::Error> {
    let sql = format!("PRAGMA table_info({table})");
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .filter_map(|row| sqlx::Row::try_get::<String, _>(&row, "name").ok())
        .collect())
}
