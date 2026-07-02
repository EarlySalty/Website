use anyhow::Context;
use sqlx::PgPool;

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
