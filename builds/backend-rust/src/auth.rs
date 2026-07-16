use std::net::{IpAddr, SocketAddr};

use axum::http::{
    header::{COOKIE, SET_COOKIE},
    HeaderMap, HeaderValue,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use url::Url;

use crate::{
    app::AppState,
    config::Config,
    error::{AppError, AppResult},
};

const LEGACY_SESSION_COOKIE_NAMES: [&str; 1] = ["auth_token"];

#[derive(Clone)]
pub struct Auth {
    cfg: Config,
}

#[derive(Clone, Debug, Serialize)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    pub role: String,
    pub sub: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Option<String>,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: Option<String>,
    pub iss: Option<String>,
    pub aud: Option<Value>,
    pub iat: i64,
    pub exp: i64,
    pub kind: Option<String>,
    pub state_id: Option<String>,
    pub next: Option<String>,
}

impl Auth {
    pub fn new(cfg: Config) -> Self {
        Self { cfg }
    }

    pub fn create_session_jwt(
        &self,
        user_id: &str,
        username: &str,
        role: &str,
        display_name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> AppResult<String> {
        self.create_jwt(Claims {
            sub: Some(user_id.to_string()),
            username: Some(username.to_string()),
            display_name: Some(display_name.unwrap_or(username).to_string()),
            avatar_url: avatar_url.map(str::to_string),
            role: Some(role.to_string()),
            iss: Some(self.cfg.session_issuer.clone()),
            aud: Some(Value::String(self.cfg.session_audience.clone())),
            iat: Utc::now().timestamp(),
            exp: (Utc::now() + Duration::seconds(self.cfg.session_ttl_seconds)).timestamp(),
            kind: None,
            state_id: None,
            next: None,
        })
    }

    pub fn create_pre_auth_jwt(&self, state_id: &str, next: &str) -> AppResult<String> {
        self.create_jwt(Claims {
            sub: None,
            username: None,
            display_name: None,
            avatar_url: None,
            role: None,
            iss: Some(self.cfg.session_issuer.clone()),
            aud: Some(Value::String(self.cfg.session_audience.clone())),
            iat: Utc::now().timestamp(),
            exp: (Utc::now() + Duration::seconds(self.cfg.pre_auth_ttl_seconds)).timestamp(),
            kind: Some("pre_auth".to_string()),
            state_id: Some(state_id.to_string()),
            next: Some(next.to_string()),
        })
    }

    pub fn decode_jwt(&self, token: &str) -> Option<Claims> {
        let secret = self.cfg.auth_session_secret.as_ref()?;
        if token.trim().is_empty() {
            return None;
        }
        let key = DecodingKey::from_secret(secret.as_bytes());
        let mut strict = Validation::new(Algorithm::HS256);
        strict.set_audience(&[self.cfg.session_audience.as_str()]);
        strict.set_issuer(&[self.cfg.session_issuer.as_str()]);
        if let Ok(data) = decode::<Claims>(token, &key, &strict) {
            return Some(data.claims);
        }

        let mut loose = Validation::new(Algorithm::HS256);
        loose.validate_aud = false;
        decode::<Claims>(token, &key, &loose)
            .ok()
            .map(|data| data.claims)
    }

    fn create_jwt(&self, claims: Claims) -> AppResult<String> {
        let Some(secret) = self.cfg.auth_session_secret.as_ref() else {
            return Err(AppError::service_unavailable(
                "Auth session secret is not configured",
            ));
        };
        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .map_err(|_| AppError::service_unavailable("Auth session secret is not configured"))
    }

    pub fn pre_auth_cookie_name(&self) -> &str {
        &self.cfg.pre_auth_cookie_name
    }

    pub fn session_cookie_name(&self) -> &str {
        &self.cfg.auth_cookie_name
    }
}

pub async fn current_user(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<Option<User>> {
    if headers
        .get("X-Admin-Validated")
        .and_then(|v| v.to_str().ok())
        == Some("1")
        && trusted_loopback(peer)
    {
        let username = headers
            .get("X-Admin-User")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("admin")
            .to_string();
        return Ok(Some(User {
            id: "caddy-validated-admin".to_string(),
            username: username.clone(),
            display_name: username,
            avatar_url: None,
            role: "admin".to_string(),
            sub: "caddy-validated-admin".to_string(),
        }));
    }

    let token = session_cookie_value(state, headers);
    let Some(payload) = state.auth.decode_jwt(&token) else {
        return Ok(None);
    };
    let user_id = payload.sub.unwrap_or_default().trim().to_string();
    let username = payload.username.unwrap_or_default().trim().to_string();
    if user_id.is_empty() || username.is_empty() {
        return Ok(None);
    }
    let role = load_user_role(state, &user_id, payload.role.as_deref().unwrap_or("user")).await?;
    let display_name = payload
        .display_name
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| username.clone());
    Ok(Some(User {
        id: user_id.clone(),
        username,
        display_name,
        avatar_url: payload.avatar_url,
        role,
        sub: user_id,
    }))
}

pub async fn require_authenticated_user(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<User> {
    current_user(state, headers, peer)
        .await?
        .ok_or_else(|| AppError::unauthorized("Not authenticated"))
}

pub async fn require_admin_user(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<User> {
    let user = require_authenticated_user(state, headers, peer).await?;
    if user.role != "admin" {
        return Err(AppError::forbidden("Admin only"));
    }
    Ok(user)
}

pub async fn require_coach_user(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<User> {
    let user = require_authenticated_user(state, headers, peer).await?;
    if user.role == "admin" || is_active_coach(state, &user.sub).await? {
        return Ok(user);
    }
    Err(AppError::forbidden("Coach only"))
}

pub async fn is_active_coach(state: &AppState, user_id: &str) -> AppResult<bool> {
    let discord_id = parse_discord_user_id(user_id)?;
    let exists: Option<i32> = sqlx::query_scalar(
        "SELECT 1 FROM coaching.coaches WHERE discord_user_id=$1 AND status='active'",
    )
    .bind(discord_id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(exists.is_some())
}

pub async fn upsert_meta_user(
    state: &AppState,
    user_id: i64,
    username: &str,
    display_name: &str,
    avatar_url: Option<&str>,
) -> AppResult<String> {
    let role = sqlx::query_scalar(
        "INSERT INTO core.meta_users (id, username, display_name, avatar_url, role) \
         VALUES ($1, $2, $3, $4, 'user') \
         ON CONFLICT (id) DO UPDATE SET \
             username=EXCLUDED.username, \
             display_name=EXCLUDED.display_name, \
             avatar_url=EXCLUDED.avatar_url \
         RETURNING role",
    )
    .bind(user_id)
    .bind(username)
    .bind(display_name)
    .bind(avatar_url)
    .fetch_one(&state.pool)
    .await?;
    Ok(role)
}

pub fn parse_discord_user_id(value: &str) -> AppResult<i64> {
    let value = value.trim();
    if value.is_empty() || !value.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(AppError::bad_request("Discord user id is invalid"));
    }
    let id = value
        .parse::<i64>()
        .map_err(|_| AppError::bad_request("Discord user id is invalid"))?;
    if id <= 0 {
        return Err(AppError::bad_request("Discord user id is invalid"));
    }
    Ok(id)
}

pub fn session_cookie_value(state: &AppState, headers: &HeaderMap) -> String {
    if let Some(value) = cookie(headers, state.auth.session_cookie_name()) {
        return value;
    }
    for legacy in LEGACY_SESSION_COOKIE_NAMES {
        if let Some(value) = cookie(headers, legacy) {
            return value;
        }
    }
    String::new()
}

pub fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(COOKIE)?.to_str().ok()?;
    for part in raw.split(';') {
        let mut pieces = part.trim().splitn(2, '=');
        let key = pieces.next()?.trim();
        let value = pieces.next().unwrap_or("").trim();
        if key == name {
            return Some(value.to_string());
        }
    }
    None
}

pub fn append_cookie(headers: &mut HeaderMap, value: String) {
    if let Ok(value) = HeaderValue::from_str(&value) {
        headers.append(SET_COOKIE, value);
    }
}

pub fn set_cookie(
    state: &AppState,
    request_headers: &HeaderMap,
    name: &str,
    value: &str,
    max_age: i64,
) -> String {
    let mut parts = vec![
        format!("{name}={value}"),
        "Path=".to_string() + &state.cfg.cookie_path,
        "HttpOnly".to_string(),
        format!("SameSite={}", same_site_label(&state.cfg.cookie_samesite)),
        format!("Max-Age={max_age}"),
    ];
    if cookie_secure(request_headers) {
        parts.push("Secure".to_string());
    }
    if let Some(domain) = cookie_domain(state, request_headers) {
        parts.push(format!("Domain={domain}"));
    }
    parts.join("; ")
}

pub fn clear_cookie_variants(
    state: &AppState,
    request_headers: &HeaderMap,
    name: &str,
) -> Vec<String> {
    let mut variants = vec![format!(
        "{name}=; Path={}; HttpOnly; SameSite={}; Max-Age=0",
        state.cfg.cookie_path,
        same_site_label(&state.cfg.cookie_samesite)
    )];
    if let Some(domain) = cookie_domain(state, request_headers) {
        variants.push(format!(
            "{name}=; Path={}; Domain={domain}; HttpOnly; SameSite={}; Max-Age=0",
            state.cfg.cookie_path,
            same_site_label(&state.cfg.cookie_samesite)
        ));
    }
    variants
}

pub fn request_host(headers: &HeaderMap) -> String {
    let raw = headers
        .get("X-Forwarded-Host")
        .or_else(|| headers.get("Host"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .split(',')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    bare_host(&raw)
}

pub fn build_callback_url(state: &AppState, headers: &HeaderMap) -> AppResult<String> {
    if let Some(url) = state.cfg.auth_public_callback_url.as_ref() {
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
        return Err(AppError::service_unavailable(
            "Cannot determine external auth callback URL",
        ));
    }
    Ok(format!("{scheme}://{host}/api/auth/discord/callback"))
}

pub fn normalize_redirect_path(value: Option<&str>, fallback: &str) -> String {
    let raw = value.unwrap_or("").trim();
    if raw.is_empty() || raw.chars().any(|ch| matches!(ch, '\r' | '\n' | '\0')) {
        return fallback.to_string();
    }
    if raw.starts_with("//") || !raw.starts_with('/') {
        return fallback.to_string();
    }
    let parsed = match Url::parse(&format!("http://local{raw}")) {
        Ok(parsed) => parsed,
        Err(_) => return fallback.to_string(),
    };
    if parsed
        .path_segments()
        .is_some_and(|mut s| s.any(|p| p == ".."))
    {
        return fallback.to_string();
    }
    let mut normalized = parsed.path().to_string();
    if let Some(query) = parsed.query() {
        normalized.push('?');
        normalized.push_str(query);
    }
    if let Some(fragment) = parsed.fragment() {
        normalized.push('#');
        normalized.push_str(fragment);
    }
    normalized
}

pub fn default_redirect_path(headers: &HeaderMap) -> String {
    let host = request_host(headers);
    if host == "deutsche-deadlock-community.de" || host.ends_with(".deutsche-deadlock-community.de")
    {
        "/coaching/".to_string()
    } else {
        "/".to_string()
    }
}

fn trusted_loopback(peer: Option<SocketAddr>) -> bool {
    matches!(
        peer.map(|p| p.ip()),
        Some(IpAddr::V4(ip)) if ip.is_loopback()
    ) || matches!(peer.map(|p| p.ip()), Some(IpAddr::V6(ip)) if ip.is_loopback())
}

async fn load_user_role(state: &AppState, user_id: &str, fallback: &str) -> AppResult<String> {
    let user_id = parse_discord_user_id(user_id)?;
    let row = sqlx::query("SELECT role FROM core.meta_users WHERE id=$1")
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await?;
    Ok(row
        .and_then(|row| row.try_get::<Option<String>, _>("role").ok().flatten())
        .unwrap_or_else(|| fallback.to_string()))
}

fn cookie_domain(state: &AppState, headers: &HeaderMap) -> Option<String> {
    if state.cfg.cookie_domain.is_some() {
        return state.cfg.cookie_domain.clone();
    }
    let host = request_host(headers);
    if host == state.cfg.ddc_cookie_domain
        || host.ends_with(&format!(".{}", state.cfg.ddc_cookie_domain))
    {
        Some(state.cfg.ddc_cookie_domain.clone())
    } else {
        None
    }
}

fn cookie_secure(headers: &HeaderMap) -> bool {
    if let Ok(explicit) = std::env::var("AUTH_COOKIE_SECURE") {
        return is_truthy(Some(&explicit), false);
    }
    if is_truthy(std::env::var("AUTH_INSECURE_COOKIE").ok().as_deref(), false) {
        return false;
    }
    let host = request_host(headers);
    if matches!(host.as_str(), "127.0.0.1" | "localhost" | "::1") {
        return false;
    }
    headers
        .get("X-Forwarded-Proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .split(',')
        .next()
        .unwrap_or("")
        .trim()
        == "https"
}

fn is_truthy(value: Option<&str>, default: bool) -> bool {
    value
        .map(|v| {
            matches!(
                v.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default)
}

fn bare_host(value: &str) -> String {
    if let Some(stripped) = value.strip_prefix('[') {
        return stripped.split(']').next().unwrap_or(stripped).to_string();
    }
    if value.matches(':').count() == 1 {
        value
            .rsplit_once(':')
            .map(|(host, _)| host)
            .unwrap_or(value)
            .to_string()
    } else {
        value.to_string()
    }
}

fn same_site_label(value: &str) -> &'static str {
    match value.to_ascii_lowercase().as_str() {
        "strict" => "Strict",
        "none" => "None",
        _ => "Lax",
    }
}

pub fn json_user(user: User, is_coach: bool) -> Value {
    json!({
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "role": user.role,
        "is_coach": is_coach,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_jwt_round_trip_rejects_wrong_key() {
        let mut cfg = Config::from_env();
        cfg.auth_session_secret = Some("round-trip-secret".into());
        cfg.session_issuer = "test-issuer".into();
        cfg.session_audience = "test-audience".into();
        cfg.session_ttl_seconds = 60;

        let auth = Auth::new(cfg.clone());
        let token = auth
            .create_session_jwt("user-123", "tester", "user", None, None)
            .expect("HS256 session token should encode");
        let claims = auth
            .decode_jwt(&token)
            .expect("HS256 session token should decode");

        assert_eq!(claims.sub.as_deref(), Some("user-123"));
        assert_eq!(claims.username.as_deref(), Some("tester"));
        assert_eq!(claims.role.as_deref(), Some("user"));

        cfg.auth_session_secret = Some("wrong-secret".into());
        assert!(Auth::new(cfg).decode_jwt(&token).is_none());
    }
}
