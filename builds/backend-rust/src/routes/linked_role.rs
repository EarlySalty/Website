use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Query, State},
    http::HeaderMap,
    response::Response,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    app::AppState,
    auth, config,
    discord_role_connection::{
        self, build_authorize_url, MSG_CALLBACK_URL_UNAVAILABLE, MSG_DISCORD_ID_REQUIRED,
        ROLE_CONNECTION_CALLBACK_PATH,
    },
    error::{AppError, AppResult},
    http,
};

#[derive(Deserialize)]
pub struct LoginQuery {
    next: Option<String>,
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

pub async fn linked_role_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<LoginQuery>,
) -> AppResult<Response> {
    let callback_url = build_callback_url(&state, &headers)?;
    let fallback = auth::default_redirect_path(&headers);
    let next_path = auth::normalize_redirect_path(query.next.as_deref(), &fallback);
    let state_id = crate::ids::token_urlsafe(32);
    let token = state.auth.create_pre_auth_jwt(&state_id, &next_path)?;
    let authorize_url = build_authorize_url(&state.cfg, &state_id, &callback_url)?;

    let mut response_headers = HeaderMap::new();
    auth::append_cookie(
        &mut response_headers,
        auth::set_cookie(
            &state,
            &headers,
            &state.cfg.discord_role_connection_cookie_name,
            &token,
            state.cfg.pre_auth_ttl_seconds,
        ),
    );
    Ok(http::redirect(&authorize_url, response_headers))
}

pub async fn linked_role_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(_peer): ConnectInfo<SocketAddr>,
    Query(query): Query<CallbackQuery>,
) -> AppResult<Response> {
    let fallback = auth::default_redirect_path(&headers);
    let state_cookie_name = &state.cfg.discord_role_connection_cookie_name;
    let pre_auth = auth::cookie(&headers, state_cookie_name)
        .and_then(|token| state.auth.decode_jwt(&token))
        .filter(|claims| claims.kind.as_deref() == Some("pre_auth"));
    let next_path = pre_auth
        .as_ref()
        .and_then(|claims| claims.next.as_deref())
        .map(|next| auth::normalize_redirect_path(Some(next), &fallback))
        .unwrap_or(fallback);

    let mut response_headers = HeaderMap::new();
    for cookie in auth::clear_cookie_variants(&state, &headers, state_cookie_name) {
        auth::append_cookie(&mut response_headers, cookie);
    }

    let expected_state = pre_auth
        .as_ref()
        .and_then(|claims| claims.state_id.as_deref())
        .unwrap_or_default()
        .trim()
        .to_string();
    let returned_state = query.state.as_deref().unwrap_or_default().trim();
    if expected_state.is_empty() || expected_state != returned_state {
        return Ok(http::redirect(&next_path, response_headers));
    }
    if query
        .error
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        return Ok(http::redirect(&next_path, response_headers));
    }
    let code = query.code.as_deref().unwrap_or_default().trim();
    if code.is_empty() {
        return Ok(http::redirect(&next_path, response_headers));
    }
    let callback_url = build_callback_url(&state, &headers)?;

    let Ok(token) = state
        .discord_role_connections
        .exchange_code(code, &callback_url)
        .await
    else {
        return Ok(http::redirect(&next_path, response_headers));
    };
    let Ok(discord_user) = state
        .discord_role_connections
        .fetch_current_user(&token.access_token)
        .await
    else {
        return Ok(http::redirect(&next_path, response_headers));
    };
    let oauth_discord_id = auth::parse_discord_user_id(&discord_user.id)?;

    let role = auth::upsert_meta_user(
        &state,
        oauth_discord_id,
        &discord_user.display_name(),
        &discord_user.display_name(),
        None,
    )
    .await?;
    let _ = role;
    if discord_role_connection::store_oauth_tokens(&state, oauth_discord_id, &token)
        .await
        .is_err()
    {
        return Ok(http::redirect(&next_path, response_headers));
    }
    if let Err(err) = discord_role_connection::push_for_user(&state, oauth_discord_id).await {
        tracing::warn!(
            ?err,
            discord_id = oauth_discord_id,
            "Linked-Role-Metadata-Push fehlgeschlagen"
        );
    }
    Ok(http::redirect(&next_path, response_headers))
}

pub async fn register_metadata(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    auth::require_admin_user(&state, &headers, Some(peer)).await?;
    discord_role_connection::register_metadata(&state).await?;
    Ok(Json(json!({
        "ok": true,
        "records": discord_role_connection::metadata_records(),
    })))
}

pub async fn sync_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    if !has_internal_token(&headers) {
        auth::require_admin_user(&state, &headers, Some(peer)).await?;
    }
    if body
        .get("pending")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let limit = body.get("limit").and_then(Value::as_i64).unwrap_or(10);
        let processed =
            discord_role_connection::process_pending_sync(&state, limit.clamp(1, 100)).await?;
        return Ok(Json(json!({ "ok": true, "processed": processed })));
    }

    let discord_id = body
        .get("discord_id")
        .and_then(coerce_i64)
        .ok_or_else(|| AppError::bad_request(MSG_DISCORD_ID_REQUIRED))?;
    if body
        .get("enqueue")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let reason = body
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or("manual");
        discord_role_connection::enqueue_sync(&state.pool, discord_id, reason).await?;
        return Ok(Json(json!({ "ok": true, "outcome": "enqueued" })));
    }

    let outcome = discord_role_connection::push_for_user(&state, discord_id).await?;
    Ok(Json(json!({ "ok": true, "outcome": outcome.as_str() })))
}

fn build_callback_url(state: &AppState, headers: &HeaderMap) -> AppResult<String> {
    if let Some(url) = state.cfg.discord_role_connection_callback_url.as_ref() {
        return Ok(url.clone());
    }
    let scheme = headers
        .get("X-Forwarded-Proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http")
        .split(',')
        .next()
        .unwrap_or("http")
        .trim();
    let host = headers
        .get("X-Forwarded-Host")
        .or_else(|| headers.get("Host"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .split(',')
        .next()
        .unwrap_or_default()
        .trim();
    if scheme.is_empty() || host.is_empty() {
        return Err(AppError::service_unavailable(MSG_CALLBACK_URL_UNAVAILABLE));
    }
    Ok(format!("{scheme}://{host}{ROLE_CONNECTION_CALLBACK_PATH}"))
}

fn has_internal_token(headers: &HeaderMap) -> bool {
    let Some(secret) = config::first_env(&[
        "WEBSITE_INTERNAL_API_TOKEN",
        "TURNIER_INTERNAL_API_TOKEN",
        "MAIN_BOT_INTERNAL_TOKEN",
        "TWITCH_INTERNAL_API_TOKEN",
    ]) else {
        return false;
    };
    let provided = headers
        .get("X-Internal-Token")
        .or_else(|| headers.get("X-Bot-Token"))
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    constant_time_eq::constant_time_eq(provided.as_bytes(), secret.as_bytes())
}

fn coerce_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => number.as_i64(),
        Value::String(value) => value.trim().parse().ok(),
        _ => None,
    }
    .filter(|id| *id > 0)
}
