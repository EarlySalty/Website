mod app;
mod auth;
mod config;
mod db;
mod error;
mod http;
mod ids;
mod routes;
mod rows;

use anyhow::Context;
use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,sqlx=warn,reqwest=warn".to_string()),
        )
        .init();

    let cfg = Config::from_env();
    let state = app::AppState::new(cfg.clone())
        .await
        .context("Website-Backend initialisieren")?;
    let router = app::router(state);
    let addr = format!("{}:{}", cfg.host, cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("Port binden: {addr}"))?;

    tracing::info!(%addr, db_path = %cfg.db_path, "ddc-website-backend läuft");
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await
    .context("HTTP-Server")?;

    Ok(())
}
