use std::collections::HashSet;

use anyhow::Context;
use sqlx::{PgPool, Row};

pub async fn connect() -> anyhow::Result<PgPool> {
    let dsn = dl_central_db::dsn_from_env()
        .context("DEADLOCK_CENTRAL_DSN ist fuer das Rust-Website-Backend erforderlich")?;
    dl_central_db::connect_pool(&dsn)
        .await
        .context("zentrale Website-Datenbank verbinden")
}

pub async fn init(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .context("zentrale Website-Datenbank Smoke-Check")?;
    Ok(())
}

pub async fn table_columns(pool: &PgPool, table: &str) -> Result<HashSet<String>, sqlx::Error> {
    let (schema, table_name) = match table {
        "meta_users" => ("core", "meta_users"),
        "meta_heroes" => ("tierlist", "meta_heroes"),
        "meta_builds" => ("tierlist", "meta_builds"),
        "meta_items" => ("tierlist", "meta_items"),
        "meta_tier_lists" => ("tierlist", "meta_tier_lists"),
        "meta_votes" => ("tierlist", "meta_votes"),
        "meta_tier_history" => ("tierlist", "meta_tier_history"),
        "meta_reports" => ("content", "meta_reports"),
        "meta_announcements" => ("content", "meta_announcements"),
        "meta_patch_notes" => ("patchnotes", "meta_patch_notes"),
        "coaches" => ("coaching", "coaches"),
        "coach_reviews" => ("coaching", "coach_reviews"),
        "coaching_requests" => ("coaching", "requests"),
        "coaching_sessions" => ("coaching", "sessions"),
        "coaching_surveys" => ("coaching", "surveys"),
        "coach_applications" => ("coaching", "coach_applications"),
        "coachees" => ("coaching", "coachees"),
        "coaching_goals" => ("coaching", "goals"),
        "coaching_milestones" => ("coaching", "milestones"),
        "session_notes" => ("coaching", "session_notes"),
        "coaching_appointments" => ("coaching", "appointments"),
        _ => return Ok(HashSet::new()),
    };

    let rows = sqlx::query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2",
    )
    .bind(schema)
    .bind(table_name)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("column_name").ok())
        .collect())
}
