use axum::Json;
use serde_json::json;

pub mod auth;
pub mod coaching;
pub mod meta;
pub mod platform;

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}
