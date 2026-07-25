use std::time::Duration;

use axum::{
    body::Bytes,
    http::{header, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use rand::RngCore;
use reqwest::Client;
use serde_json::{json, Value};

use crate::{auth::User, config::Config};

pub const SCRIM_UPSTREAM_MAX_RESPONSE_BYTES: usize = 256 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScrimUpstreamKind {
    Turnier,
    Ai,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ScrimActorAssertion {
    pub discord_id: String,
    pub display_name: String,
}

impl ScrimActorAssertion {
    pub fn from_user(user: &User) -> Self {
        Self {
            discord_id: user.sub.clone(),
            display_name: user.display_name.clone(),
        }
    }
}

#[derive(Debug)]
pub struct ScrimUpstreamRequest {
    pub kind: ScrimUpstreamKind,
    pub method: Method,
    pub path_and_query: String,
    pub body: Option<Vec<u8>>,
    pub actor: ScrimActorAssertion,
    pub request_id: String,
    pub idempotency_key: Option<String>,
}

#[derive(Debug)]
pub struct ScrimUpstreamResponse {
    pub status: StatusCode,
    pub content_type: Option<HeaderValue>,
    pub retry_after: Option<HeaderValue>,
    pub body: Bytes,
}

#[derive(Debug)]
pub enum ScrimUpstreamError {
    Misconfigured,
    Timeout,
    Transport,
    InternalAuth,
    ResponseTooLarge,
}

pub struct ScrimUpstreamClient<'a> {
    cfg: &'a Config,
    http: &'a Client,
}

impl<'a> ScrimUpstreamClient<'a> {
    pub fn new(cfg: &'a Config, http: &'a Client) -> Self {
        Self { cfg, http }
    }

    pub async fn send(
        &self,
        request: ScrimUpstreamRequest,
    ) -> Result<ScrimUpstreamResponse, ScrimUpstreamError> {
        let (base, token) = self.upstream_config(request.kind)?;
        let method = reqwest::Method::from_bytes(request.method.as_str().as_bytes())
            .map_err(|_| ScrimUpstreamError::Transport)?;
        let url = format!("{}{}", base.trim_end_matches('/'), request.path_and_query);
        let mut builder = self
            .http
            .request(method, url)
            .timeout(Duration::from_millis(self.cfg.scrim_upstream_timeout_ms))
            .header("X-Internal-Token", token)
            .header("X-Request-Id", &request.request_id)
            .header(
                "X-Actor-Discord-Id",
                safe_header_value(&request.actor.discord_id),
            )
            .header(
                "X-Actor-Display-Name",
                safe_header_value(&request.actor.display_name),
            )
            .header(header::ACCEPT, "application/json");
        if let Some(idempotency_key) = request.idempotency_key.as_deref() {
            builder = builder
                .header("Idempotency-Key", idempotency_key)
                .header("X-Idempotency-Key", idempotency_key);
        }
        if let Some(body) = request.body {
            builder = builder
                .header(header::CONTENT_TYPE, "application/json")
                .body(body);
        }
        let response = builder.send().await.map_err(map_reqwest_error)?;
        let status = response.status();
        if status == StatusCode::UNAUTHORIZED {
            return Err(ScrimUpstreamError::InternalAuth);
        }
        if response
            .content_length()
            .is_some_and(|length| length > SCRIM_UPSTREAM_MAX_RESPONSE_BYTES as u64)
        {
            return Err(ScrimUpstreamError::ResponseTooLarge);
        }
        let content_type = response.headers().get(header::CONTENT_TYPE).cloned();
        let retry_after = response.headers().get(header::RETRY_AFTER).cloned();
        let body = capped_response_body(response).await?;
        Ok(ScrimUpstreamResponse {
            status,
            content_type,
            retry_after,
            body,
        })
    }

    fn upstream_config(&self, kind: ScrimUpstreamKind) -> Result<(&str, &str), ScrimUpstreamError> {
        let (base, token) = match kind {
            ScrimUpstreamKind::Turnier => (
                self.cfg.scrim_turnier_base.as_str(),
                self.cfg.scrim_turnier_token.as_deref(),
            ),
            ScrimUpstreamKind::Ai => (
                self.cfg.scrim_ai_base.as_str(),
                self.cfg.scrim_ai_token.as_deref(),
            ),
        };
        let token = token
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or(ScrimUpstreamError::Misconfigured)?;
        if base.trim().is_empty() {
            return Err(ScrimUpstreamError::Misconfigured);
        }
        Ok((base, token))
    }
}

pub fn generated_request_id() -> String {
    let mut random = [0_u8; 8];
    rand::thread_rng().fill_bytes(&mut random);
    format!(
        "scrim_bff:v1:{}:{}",
        chrono::Utc::now().timestamp_millis(),
        hex(&random)
    )
}

pub fn idempotency_key(request_id: &str) -> String {
    let mut tail = safe_key_part(
        request_id
            .strip_prefix("scrim_bff:v1:")
            .unwrap_or(request_id),
    );
    if tail.len() > 96 {
        tail.truncate(96);
    }
    format!("scrim_bff:v1:{tail}")
}

pub fn upstream_response_to_browser(response: ScrimUpstreamResponse, request_id: &str) -> Response {
    if !response.status.is_success() {
        return upstream_browser_error_response(response, request_id);
    }
    let mut builder = Response::builder()
        .status(response.status)
        .header("X-Request-Id", request_id);
    if let Some(content_type) = response.content_type {
        builder = builder.header(header::CONTENT_TYPE, content_type);
    }
    if let Some(retry_after) = response.retry_after {
        builder = builder.header(header::RETRY_AFTER, retry_after);
    }
    builder
        .body(axum::body::Body::from(response.body))
        .unwrap_or_else(|_| service_unavailable_response(request_id))
}

fn upstream_browser_error_response(response: ScrimUpstreamResponse, request_id: &str) -> Response {
    let upstream_body = serde_json::from_slice::<Value>(&response.body).ok();
    let detail = upstream_body
        .as_ref()
        .and_then(|value| {
            ["detail", "message"].iter().find_map(|key| {
                value
                    .get(*key)
                    .and_then(|detail| detail.as_str())
                    .filter(|detail| !detail.trim().is_empty())
                    .map(str::to_string)
            })
        })
        .unwrap_or_else(|| "Scrim upstream rejected the request".to_string());
    let mut body = json!({
        "detail": detail,
        "request_id": request_id,
    });
    if response.status == StatusCode::NOT_IMPLEMENTED {
        if let Some(capability) = upstream_501_capability(upstream_body.as_ref()) {
            body["capability"] = capability;
        }
    }
    let mut browser = (response.status, Json(body)).into_response();
    if let Some(retry_after) = response.retry_after {
        browser
            .headers_mut()
            .insert(header::RETRY_AFTER, retry_after);
    }
    if let Ok(value) = HeaderValue::from_str(request_id) {
        browser.headers_mut().insert("X-Request-Id", value);
    }
    browser
}

fn upstream_501_capability(value: Option<&Value>) -> Option<Value> {
    let value = value?;
    let available = capability_bool(value, "available");
    let verified = capability_bool(value, "verified");
    if available.is_none() && verified.is_none() {
        return None;
    }
    let mut capability = serde_json::Map::new();
    if let Some(available) = available {
        capability.insert("available".to_string(), Value::Bool(available));
    }
    if let Some(verified) = verified {
        capability.insert("verified".to_string(), Value::Bool(verified));
    }
    Some(Value::Object(capability))
}

fn capability_bool(value: &Value, key: &str) -> Option<bool> {
    value
        .get(key)
        .and_then(Value::as_bool)
        .or_else(|| value.get("capability")?.get(key)?.as_bool())
}

impl ScrimUpstreamError {
    pub fn class(&self) -> &'static str {
        match self {
            Self::Misconfigured => "misconfigured",
            Self::Timeout => "timeout",
            Self::Transport => "transport",
            Self::InternalAuth => "internal_auth",
            Self::ResponseTooLarge => "response_too_large",
        }
    }
}

pub fn upstream_error_response(error: ScrimUpstreamError, request_id: &str) -> Response {
    match error {
        ScrimUpstreamError::Timeout => error_response(
            StatusCode::GATEWAY_TIMEOUT,
            "Scrim upstream timed out",
            request_id,
        ),
        ScrimUpstreamError::Transport | ScrimUpstreamError::ResponseTooLarge => {
            error_response(StatusCode::BAD_GATEWAY, "Scrim upstream failed", request_id)
        }
        ScrimUpstreamError::Misconfigured | ScrimUpstreamError::InternalAuth => {
            service_unavailable_response(request_id)
        }
    }
}

pub fn service_unavailable_response(request_id: &str) -> Response {
    error_response(
        StatusCode::SERVICE_UNAVAILABLE,
        "Scrim upstream unavailable",
        request_id,
    )
}

fn error_response(status: StatusCode, detail: &str, request_id: &str) -> Response {
    let mut response = (
        status,
        Json(json!({
            "detail": detail,
            "request_id": request_id,
        })),
    )
        .into_response();
    if let Ok(value) = HeaderValue::from_str(request_id) {
        response.headers_mut().insert("X-Request-Id", value);
    }
    response
}

async fn capped_response_body(
    mut response: reqwest::Response,
) -> Result<Bytes, ScrimUpstreamError> {
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_reqwest_error)? {
        if body.len().saturating_add(chunk.len()) > SCRIM_UPSTREAM_MAX_RESPONSE_BYTES {
            return Err(ScrimUpstreamError::ResponseTooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(Bytes::from(body))
}

fn map_reqwest_error(error: reqwest::Error) -> ScrimUpstreamError {
    if error.is_timeout() {
        ScrimUpstreamError::Timeout
    } else {
        ScrimUpstreamError::Transport
    }
}

fn hex(bytes: &[u8]) -> String {
    const CHARS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(CHARS[(byte >> 4) as usize] as char);
        out.push(CHARS[(byte & 0x0f) as usize] as char);
    }
    out
}

fn safe_key_part(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | ':' => ch,
            _ => '_',
        })
        .collect()
}

fn safe_header_value(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii() && !ch.is_ascii_control() {
                ch
            } else {
                '?'
            }
        })
        .collect()
}
