use axum::Json;
use serde_json::json;

pub mod auth;
pub mod coaching;
pub mod linked_role;
pub mod meta;
pub mod platform;
pub mod public;
pub mod scrim;
pub mod scrim_proxy;

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}
