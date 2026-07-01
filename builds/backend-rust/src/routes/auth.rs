use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Query, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    app::AppState,
    auth, config,
    error::{AppError, AppResult},
    http,
};

#[derive(Deserialize)]
pub struct LoginQuery {
    next: Option<String>,
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    state_id: Option<String>,
}

pub async fn discord_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<LoginQuery>,
) -> AppResult<Response> {
    let callback_url = auth::build_callback_url(&state, &headers)?;
    let fallback = auth::default_redirect_path(&headers);
    let next_path = auth::normalize_redirect_path(query.next.as_deref(), &fallback);
    let data = call_dashboard_api(
        &state,
        "/internal/v1/discord/initiate",
        json!({
            "scope": "identify",
            "redirect_after": callback_url,
            "requesting_service": "builds",
            "metadata": { "site": "builds" },
        }),
    )
    .await?;

    let authorize_url = data
        .get("authorize_url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            AppError::service_unavailable("Central auth service returned incomplete data")
        })?;
    let state_id = data
        .get("state_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            AppError::service_unavailable("Central auth service returned incomplete data")
        })?;

    let token = state.auth.create_pre_auth_jwt(state_id, &next_path)?;
    let mut response_headers = HeaderMap::new();
    auth::append_cookie(
        &mut response_headers,
        auth::set_cookie(
            &state,
            &headers,
            state.auth.pre_auth_cookie_name(),
            &token,
            state.cfg.pre_auth_ttl_seconds,
        ),
    );
    Ok(http::redirect(authorize_url, response_headers))
}

pub async fn discord_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<CallbackQuery>,
) -> AppResult<Response> {
    let fallback = auth::default_redirect_path(&headers);
    let pre_auth = auth::cookie(&headers, state.auth.pre_auth_cookie_name())
        .and_then(|token| state.auth.decode_jwt(&token))
        .filter(|claims| claims.kind.as_deref() == Some("pre_auth"));
    let next_path = pre_auth
        .as_ref()
        .and_then(|claims| claims.next.as_deref())
        .map(|next| auth::normalize_redirect_path(Some(next), &fallback))
        .unwrap_or(fallback);

    let mut response_headers = HeaderMap::new();
    for cookie in auth::clear_cookie_variants(&state, &headers, state.auth.pre_auth_cookie_name()) {
        auth::append_cookie(&mut response_headers, cookie);
    }

    let state_id = query
        .state_id
        .or_else(|| pre_auth.and_then(|claims| claims.state_id))
        .unwrap_or_default();
    if state_id.trim().is_empty() {
        return Ok(http::redirect(&next_path, response_headers));
    }

    let Ok(data) = call_dashboard_api(
        &state,
        "/internal/v1/discord/consume-result",
        json!({ "state_id": state_id }),
    )
    .await
    else {
        return Ok(http::redirect(&next_path, response_headers));
    };

    let discord_id = data
        .get("discord_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let discord_name = data
        .get("discord_name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if discord_id.is_empty() || discord_name.is_empty() {
        return Ok(http::redirect(&next_path, response_headers));
    }
    let avatar = data.get("discord_avatar").and_then(Value::as_str);
    let role =
        auth::upsert_meta_user(&state, &discord_id, &discord_name, &discord_name, avatar).await?;
    let session = state.auth.create_session_jwt(
        &discord_id,
        &discord_name,
        &role,
        Some(&discord_name),
        avatar,
    )?;
    auth::append_cookie(
        &mut response_headers,
        auth::set_cookie(
            &state,
            &headers,
            state.auth.session_cookie_name(),
            &session,
            state.cfg.session_ttl_seconds,
        ),
    );
    for legacy in ["auth_token"] {
        for cookie in auth::clear_cookie_variants(&state, &headers, legacy) {
            auth::append_cookie(&mut response_headers, cookie);
        }
    }
    Ok(http::redirect(&next_path, response_headers))
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Response> {
    let Some(user) = auth::current_user(&state, &headers, Some(peer)).await? else {
        return Ok(http::json(json!({ "user": null })));
    };
    let is_coach = user.role == "admin" || auth::is_active_coach(&state, &user.sub).await?;
    Ok(http::json(
        json!({ "user": auth::json_user(user, is_coach) }),
    ))
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    let mut response_headers = HeaderMap::new();
    for name in [
        state.auth.session_cookie_name(),
        state.auth.pre_auth_cookie_name(),
        "auth_token",
    ] {
        for cookie in auth::clear_cookie_variants(&state, &headers, name) {
            auth::append_cookie(&mut response_headers, cookie);
        }
    }
    Ok(http::no_content(response_headers))
}

async fn call_dashboard_api(state: &AppState, path: &str, payload: Value) -> AppResult<Value> {
    let token = config::first_env(&[
        "WEBSITE_INTERNAL_API_TOKEN",
        "TURNIER_INTERNAL_API_TOKEN",
        "MAIN_BOT_INTERNAL_TOKEN",
        "TWITCH_INTERNAL_API_TOKEN",
    ])
    .ok_or_else(|| {
        AppError::service_unavailable("Internal dashboard auth token is not configured")
    })?;

    let url = format!(
        "{}{}",
        state.cfg.dashboard_internal_api_base.trim_end_matches('/'),
        path
    );
    let response = state
        .http
        .post(url)
        .header("X-Internal-Token", token)
        .json(&payload)
        .send()
        .await
        .map_err(|_| AppError::service_unavailable("Central auth service is not reachable"))?;

    if response.status() != StatusCode::OK {
        let detail = response
            .text()
            .await
            .unwrap_or_else(|_| "Central auth service rejected the request".to_string());
        let detail = detail.trim();
        return Err(AppError::service_unavailable(
            detail.chars().take(300).collect::<String>(),
        ));
    }
    response
        .json::<Value>()
        .await
        .map_err(|_| AppError::service_unavailable("Central auth service returned invalid payload"))
}
