use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Path, Query, State},
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
        self, build_authorize_url, LinkedRoleProvider, MSG_CALLBACK_URL_UNAVAILABLE,
        MSG_DISCORD_ID_REQUIRED,
    },
    error::{AppError, AppResult},
    http,
};

pub const MSG_UNKNOWN_PROVIDER: &str = "Unbekannte Verknüpfung.";

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

/// `/linked-role/{provider}` — Ziel der Discord-Verifizierungs-URL.
pub async fn linked_role_login_for(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(provider): Path<String>,
    Query(query): Query<LoginQuery>,
) -> AppResult<Response> {
    let provider = parse_provider(&provider)?;
    start_login(&state, &headers, provider, query.next.as_deref()).await
}

pub async fn linked_role_callback_for(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(_peer): ConnectInfo<SocketAddr>,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> AppResult<Response> {
    let provider = parse_provider(&provider)?;
    finish_callback(&state, &headers, provider, query).await
}

/// Legacy-Pfade der Master-Application: deren `role_connections_verification_url`
/// und Redirect-URI stehen im Dev-Portal auf `/coaching/api/auth/discord/linked-role/*`
/// und nur der Portal-Inhaber kann sie dort umstellen. Solange die eigene
/// Steam-Application keine Zugangsdaten hat, laeuft die Steam-Verknuepfung weiter
/// ueber die Master-App — dann muessen diese beiden Adressen antworten.
pub async fn legacy_steam_login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<LoginQuery>,
) -> AppResult<Response> {
    start_login(
        &state,
        &headers,
        LinkedRoleProvider::Steam,
        query.next.as_deref(),
    )
    .await
}

pub async fn legacy_steam_callback(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(_peer): ConnectInfo<SocketAddr>,
    Query(query): Query<CallbackQuery>,
) -> AppResult<Response> {
    finish_callback(&state, &headers, LinkedRoleProvider::Steam, query).await
}

async fn start_login(
    state: &AppState,
    headers: &HeaderMap,
    provider: LinkedRoleProvider,
    next: Option<&str>,
) -> AppResult<Response> {
    let callback_url = build_callback_url(state, headers, provider)?;
    let fallback = auth::default_redirect_path(headers);
    let next_path = auth::normalize_redirect_path(next, &fallback);
    let state_id = crate::ids::token_urlsafe(32);
    let token = state.auth.create_pre_auth_jwt(&state_id, &next_path)?;
    let authorize_url = build_authorize_url(&state.cfg, provider, &state_id, &callback_url)?;

    let mut response_headers = HeaderMap::new();
    auth::append_cookie(
        &mut response_headers,
        auth::set_cookie(
            state,
            headers,
            &state_cookie_name(state, provider),
            &token,
            state.cfg.pre_auth_ttl_seconds,
        ),
    );
    Ok(http::redirect(&authorize_url, response_headers))
}

async fn finish_callback(
    state: &AppState,
    headers: &HeaderMap,
    provider: LinkedRoleProvider,
    query: CallbackQuery,
) -> AppResult<Response> {
    let fallback = auth::default_redirect_path(headers);
    let state_cookie_name = state_cookie_name(state, provider);
    let pre_auth = auth::cookie(headers, &state_cookie_name)
        .and_then(|token| state.auth.decode_jwt(&token))
        .filter(|claims| claims.kind.as_deref() == Some("pre_auth"));
    let next_path = pre_auth
        .as_ref()
        .and_then(|claims| claims.next.as_deref())
        .map(|next| auth::normalize_redirect_path(Some(next), &fallback))
        .unwrap_or(fallback);

    let mut response_headers = HeaderMap::new();
    for cookie in auth::clear_cookie_variants(state, headers, &state_cookie_name) {
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
    let callback_url = build_callback_url(state, headers, provider)?;
    let credentials = provider.credentials(&state.cfg)?;

    let Ok(token) = state
        .discord_role_connections
        .exchange_code(&credentials, code, &callback_url)
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
        state,
        oauth_discord_id,
        &discord_user.display_name(),
        &discord_user.display_name(),
        None,
    )
    .await?;
    let _ = role;
    if discord_role_connection::store_oauth_tokens(state, provider, oauth_discord_id, &token)
        .await
        .is_err()
    {
        return Ok(http::redirect(&next_path, response_headers));
    }
    let pushed_profile = match discord_role_connection::push_for_user_with_profile(
        state,
        provider,
        oauth_discord_id,
    )
    .await
    {
        Ok((_, profile)) => profile,
        Err(err) => {
            tracing::warn!(
                ?err,
                discord_id = oauth_discord_id,
                provider = provider.as_str(),
                "Linked-Role-Metadata-Push fehlgeschlagen"
            );
            None
        }
    };

    // Fehlt die eigentliche Verknuepfung noch, geht es direkt in den bestehenden
    // Flow weiter — Steam in den Discord-Kanal, Creator in den Twitch-Flow des
    // Twitch-Bots. Der Metadata-Push oben hat die Rolle schon auf den aktuellen
    // Stand gebracht, damit ein bereits verknuepfter User hier nicht landet.
    let profile = match pushed_profile {
        Some(profile) => Ok(profile),
        None => {
            discord_role_connection::load_linked_role_profile(state, provider, oauth_discord_id)
                .await
        }
    };
    match profile {
        Ok(profile) if !profile.is_satisfied() => {
            let target = follow_up_url(state, provider, &profile);
            Ok(http::redirect(&target, response_headers))
        }
        Ok(_) => Ok(http::redirect(&next_path, response_headers)),
        Err(err) => {
            tracing::warn!(
                ?err,
                discord_id = oauth_discord_id,
                provider = provider.as_str(),
                "Linked-Role-Profil nach dem Callback nicht lesbar"
            );
            Ok(http::redirect(&next_path, response_headers))
        }
    }
}

fn follow_up_url(
    state: &AppState,
    provider: LinkedRoleProvider,
    profile: &discord_role_connection::LinkedRoleProfile,
) -> String {
    match (provider, profile) {
        (LinkedRoleProvider::Steam, _) => state.cfg.linked_role_steam_link_url.clone(),
        (
            LinkedRoleProvider::Creator,
            discord_role_connection::LinkedRoleProfile::Creator(creator),
        ) if creator.twitch_login.is_some() => {
            // Discord und Twitch sind verknuepft, es fehlt nur die
            // Autorisierung unserer Twitch-Anwendung.
            state.cfg.linked_role_twitch_auth_url.clone()
        }
        // Ohne Eintrag im Creator-Programm hilft der Partner-Flow des
        // Twitch-Bots nicht: dessen Gate laesst nur eingetragene Partner durch
        // und schickt alle anderen zurueck in den Login. Deshalb hier die
        // Streamer-Seite, die den Weg ins Programm erklaert.
        (LinkedRoleProvider::Creator, _) => state.cfg.linked_role_creator_info_url.clone(),
    }
}

pub async fn register_metadata_for(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(provider): Path<String>,
) -> AppResult<Json<Value>> {
    auth::require_admin_user(&state, &headers, Some(peer)).await?;
    let provider = parse_provider(&provider)?;
    let records = discord_role_connection::register_metadata(&state, provider).await?;
    Ok(Json(json!({
        "ok": true,
        "provider": provider.as_str(),
        "records": records,
    })))
}

pub async fn register_metadata(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    auth::require_admin_user(&state, &headers, Some(peer)).await?;
    let mut registered = Vec::new();
    // Uebersprungene Provider werden mitgeliefert: ein Tippfehler in
    // DISCORD_CREATOR_CLIENT_ID sah sonst wie ein Erfolg aus, obwohl nichts
    // registriert wurde.
    let mut skipped = Vec::new();
    // Jeder Provider wird versucht, damit ein Fehler beim zweiten den ersten nicht
    // verdeckt — nach aussen bleibt ein Teilfehlschlag aber ein Fehler, wie beim
    // Sync-Endpunkt. Was gelungen ist, steht im Log.
    let mut first_error = None;
    for provider in LinkedRoleProvider::ALL {
        if !provider.app(&state.cfg).is_configured() {
            skipped.push(json!({ "provider": provider.as_str(), "reason": "not_configured" }));
            continue;
        }
        match discord_role_connection::register_metadata(&state, provider).await {
            Ok(records) => {
                registered.push(json!({ "provider": provider.as_str(), "records": records }))
            }
            Err(err) => {
                tracing::warn!(
                    provider = provider.as_str(),
                    bereits_registriert = %serde_json::Value::Array(registered.clone()),
                    "Metadata-Registrierung fehlgeschlagen"
                );
                if first_error.is_none() {
                    first_error = Some(err);
                }
            }
        }
    }
    if let Some(err) = first_error {
        return Err(err);
    }
    Ok(Json(json!({
        "ok": true,
        "registered": registered,
        "skipped": skipped,
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
    let providers = match body.get("provider").and_then(Value::as_str) {
        Some(raw) => vec![LinkedRoleProvider::parse(raw)
            .ok_or_else(|| AppError::bad_request(MSG_UNKNOWN_PROVIDER))?],
        // Ohne Angabe nur Steam: bestehende Aufrufer (Discord-Bot beim Steam-Link)
        // haben nie Creator-Arbeit bestellt, und ein Fehler auf der Creator-Seite
        // wuerde sie zu einem Retry eines schon erledigten Steam-Pushes treiben.
        None => vec![LinkedRoleProvider::Steam],
    };

    if body
        .get("enqueue")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let reason = body
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or("manual");
        for provider in &providers {
            discord_role_connection::enqueue_sync(&state.pool, *provider, discord_id, reason)
                .await?;
        }
        return Ok(Json(json!({ "ok": true, "outcome": "enqueued" })));
    }

    // Jeder Provider wird versucht, damit ein Fehler beim zweiten den ersten nicht
    // verwirft. Nach aussen bleibt es aber bei 503, sonst liest ein Aufrufer, der
    // nur den Status prueft, Erfolg, obwohl Discord nichts bekommen hat.
    let mut outcomes = serde_json::Map::new();
    let mut first_error = None;
    for provider in providers {
        match discord_role_connection::push_for_user(&state, provider, discord_id).await {
            Ok(outcome) => {
                outcomes.insert(
                    provider.as_str().to_string(),
                    Value::String(outcome.as_str().to_string()),
                );
            }
            Err(err) => {
                tracing::warn!(
                    discord_id,
                    provider = provider.as_str(),
                    bisher = %serde_json::Value::Object(outcomes.clone()),
                    "Linked-Role-Push ueber den internen Endpunkt fehlgeschlagen"
                );
                outcomes.insert(
                    provider.as_str().to_string(),
                    Value::String("error".to_string()),
                );
                if first_error.is_none() {
                    first_error = Some(err);
                }
            }
        }
    }
    if let Some(err) = first_error {
        return Err(err);
    }
    // `outcome` ist der alte Vertrag dieses Endpunkts (ein String). Bei genau einem
    // angefragten Provider traegt es dessen Ergebnis, sonst das von Steam — nie
    // "skipped", wenn tatsaechlich gepusht wurde.
    let legacy_outcome = if outcomes.len() == 1 {
        outcomes.values().next().cloned().unwrap_or(Value::Null)
    } else {
        outcomes
            .get(LinkedRoleProvider::Steam.as_str())
            .cloned()
            .unwrap_or(Value::Null)
    };
    Ok(Json(
        json!({ "ok": true, "outcome": legacy_outcome, "outcomes": outcomes }),
    ))
}

fn parse_provider(raw: &str) -> AppResult<LinkedRoleProvider> {
    LinkedRoleProvider::parse(raw).ok_or_else(|| AppError::bad_request(MSG_UNKNOWN_PROVIDER))
}

fn state_cookie_name(state: &AppState, provider: LinkedRoleProvider) -> String {
    match provider {
        LinkedRoleProvider::Steam => state.cfg.discord_role_connection_cookie_name.clone(),
        LinkedRoleProvider::Creator => {
            format!("{}_creator", state.cfg.discord_role_connection_cookie_name)
        }
    }
}

fn build_callback_url(
    state: &AppState,
    headers: &HeaderMap,
    provider: LinkedRoleProvider,
) -> AppResult<String> {
    if let Some(url) = provider.app(&state.cfg).callback_url.as_ref() {
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
    Ok(format!("{scheme}://{host}{}", provider.callback_path()))
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
