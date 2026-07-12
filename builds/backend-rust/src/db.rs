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
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(8_773_202_607_199_i64)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS public.website_backend_migrations (\
         version BIGINT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    )
    .execute(&mut *tx)
    .await?;
    let applied: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM public.website_backend_migrations WHERE version=$1)",
    )
    .bind(2_026_071_999_i64)
    .fetch_one(&mut *tx)
    .await?;
    if !applied {
        sqlx::raw_sql(include_str!("../migrations/2026071999_video_library.sql"))
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO public.website_backend_migrations(version) VALUES($1)")
            .bind(2_026_071_999_i64)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}
