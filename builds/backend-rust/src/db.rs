use anyhow::Context;
use sqlx::PgPool;

const REQUIRED_CENTRAL_SCRIM_MIGRATIONS: [i64; 4] =
    [2_026_071_601, 2_026_071_602, 2_026_071_603, 2_026_071_662];

fn missing_required_scrim_migrations(applied: &[i64]) -> Vec<i64> {
    REQUIRED_CENTRAL_SCRIM_MIGRATIONS
        .into_iter()
        .filter(|version| !applied.contains(version))
        .collect()
}

async fn verify_central_scrim_schema(pool: &PgPool) -> anyhow::Result<()> {
    let applied = sqlx::query_scalar::<_, i64>(
        "SELECT version FROM _sqlx_migrations WHERE success AND version = ANY($1)",
    )
    .bind(REQUIRED_CENTRAL_SCRIM_MIGRATIONS.as_slice())
    .fetch_all(pool)
    .await
    .context("zentrale Scrim-Migrationshistorie lesen")?;
    let missing = missing_required_scrim_migrations(&applied);
    if !missing.is_empty() {
        anyhow::bail!(
            "zentrales Scrim-Schema ist veraltet; fehlende Deadlock-Bots-Migrationen: {missing:?}. Zuerst Deadlock-Bots/rust/target/release/dl-central-migrate ausfuehren"
        );
    }
    Ok(())
}

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
    verify_central_scrim_schema(pool).await?;
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
    let applied: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM public.website_backend_migrations WHERE version=$1)",
    )
    .bind(2_026_072_000_i64)
    .fetch_one(&mut *tx)
    .await?;
    if !applied {
        sqlx::raw_sql(include_str!(
            "../migrations/2026072000_video_action_audit.sql"
        ))
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO public.website_backend_migrations(version) VALUES($1)")
            .bind(2_026_072_000_i64)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fehlende_zentrale_scrim_migrationen_werden_vollstaendig_gemeldet() {
        assert_eq!(
            missing_required_scrim_migrations(&[2_026_071_601, 2_026_071_603]),
            vec![2_026_071_602, 2_026_071_662]
        );
        assert!(missing_required_scrim_migrations(&[
            2_026_071_601,
            2_026_071_602,
            2_026_071_603,
            2_026_071_662,
        ])
        .is_empty());
    }

    #[tokio::test]
    #[ignore = "braucht die migrierte Wegwerf-DB aus central_test_db.sh"]
    async fn migrierte_zentrale_db_erfuellt_den_scrim_schema_vertrag() {
        let pool = connect().await.expect("Wegwerf-DB verbinden");
        verify_central_scrim_schema(&pool)
            .await
            .expect("zentraler Scrim-Schema-Vertrag");
    }
}
