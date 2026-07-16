use std::{collections::BTreeMap, future::Future, pin::Pin, sync::Arc, time::Duration};

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::{DateTime, TimeDelta, Utc};
use rand::{rngs::OsRng, RngCore};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::{Executor, PgPool, Postgres, Row, Transaction};
use url::form_urlencoded;

use crate::{
    app::AppState,
    config::Config,
    error::{AppError, AppResult},
};

pub const LINKED_ROLE_SCOPE: &str = "identify role_connections.write";
pub const ROLE_CONNECTION_CALLBACK_PATH: &str = "/api/auth/discord/linked-role/callback";
pub const FALLBACK_DISPLAY_NAME: &str = "Discord-User";
pub const PLATFORM_NAME: &str = "Deadlock Community";
pub const PLATFORM_USERNAME_LINKED: &str = "Steam verknüpft";
pub const PLATFORM_USERNAME_UNLINKED: &str = "nicht verknüpft";
pub const METADATA_STEAM_NAME: &str = "Steam verknüpft";
pub const METADATA_STEAM_DESCRIPTION: &str =
    "Steam-Account ist mit der Community-Website verknüpft";
pub const METADATA_RANG_NAME: &str = "Deadlock-Rang";
pub const METADATA_RANG_DESCRIPTION: &str = "Verifizierter Rang aus den verknüpften Steam-Daten";
pub const MSG_NOT_CONFIGURED: &str = "Steam-Verknüpfung ist serverseitig nicht konfiguriert.";
pub const MSG_RELINK_REQUIRED: &str = "Discord-Verknüpfung abgelaufen — bitte neu verknüpfen.";
pub const MSG_DISCORD_UNAVAILABLE: &str =
    "Discord ist gerade nicht erreichbar — versuch es später nochmal.";
pub const MSG_CRYPTO_UNAVAILABLE: &str = "Interner Fehler bei der sicheren Speicherung.";
pub const MSG_CALLBACK_URL_UNAVAILABLE: &str = "Callback-URL konnte nicht bestimmt werden.";
pub const MSG_DISCORD_ID_REQUIRED: &str = "discord_id fehlt oder ist ungültig.";
const FIELD_CRYPTO_KEY_ID: &str = "v1";
const FIELD_CRYPTO_VERSION: u8 = 1;
const FIELD_CRYPTO_NONCE_SIZE: usize = 12;
const FIELD_CRYPTO_KEY_SIZE: usize = 32;
const ACCESS_AAD_FIELD: &str = "access_token";
const REFRESH_AAD_FIELD: &str = "refresh_token";
const TOKEN_AAD_VERSION: i32 = 1;
const ROLE_CONNECTION_ADVISORY_LOCK_NAMESPACE: i64 = 0x4452_0003_0000_0000;

pub type DynDiscordRoleConnectionClient = Arc<dyn DiscordRoleConnectionClient>;
pub type DiscordRoleConnectionFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, DiscordRoleConnectionError>> + Send + 'a>>;

pub trait DiscordRoleConnectionClient: Send + Sync {
    fn exchange_code<'a>(
        &'a self,
        code: &'a str,
        redirect_uri: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse>;

    fn refresh_token<'a>(
        &'a self,
        refresh_token: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse>;

    fn fetch_current_user<'a>(
        &'a self,
        access_token: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, DiscordCurrentUser>;

    fn update_user_role_connection<'a>(
        &'a self,
        application_id: &'a str,
        access_token: &'a str,
        payload: &'a UserRoleConnectionPayload,
    ) -> DiscordRoleConnectionFuture<'a, ()>;

    fn register_metadata<'a>(
        &'a self,
        application_id: &'a str,
        bot_token: &'a str,
        records: &'a [RoleConnectionMetadataRecord],
    ) -> DiscordRoleConnectionFuture<'a, ()>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscordRoleConnectionError {
    Unconfigured,
    InvalidGrant,
    Unauthorized,
    Transport,
    HttpStatus(StatusCode),
    InvalidResponse,
}

impl DiscordRoleConnectionError {
    fn from_status(status: StatusCode, error_code: Option<&str>) -> Self {
        if matches!(error_code, Some("invalid_grant")) {
            return Self::InvalidGrant;
        }
        match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Self::Unauthorized,
            _ => Self::HttpStatus(status),
        }
    }

    fn invalidates_user_token(self) -> bool {
        matches!(self, Self::InvalidGrant | Self::Unauthorized)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    #[serde(default)]
    pub token_type: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
    #[serde(default)]
    pub scope: Option<String>,
}

impl OAuthTokenResponse {
    fn expires_at(&self) -> DateTime<Utc> {
        let ttl = self.expires_in.unwrap_or(7 * 24 * 60 * 60).max(60);
        Utc::now() + TimeDelta::seconds(ttl)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordCurrentUser {
    pub id: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub global_name: Option<String>,
    #[serde(default)]
    pub avatar: Option<String>,
}

impl DiscordCurrentUser {
    pub fn display_name(&self) -> String {
        self.global_name
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .or_else(|| {
                let username = self.username.trim();
                (!username.is_empty()).then_some(username)
            })
            .unwrap_or(FALLBACK_DISPLAY_NAME)
            .to_string()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoleConnectionMetadataRecord {
    #[serde(rename = "type")]
    pub kind: i32,
    pub key: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserRoleConnectionPayload {
    pub platform_name: Option<String>,
    pub platform_username: Option<String>,
    pub metadata: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RoleConnectionPushOutcome {
    Pushed,
    NoToken,
    InactiveToken,
    TokenInvalidated,
    NotConfigured,
    CryptoUnavailable,
}

impl RoleConnectionPushOutcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pushed => "pushed",
            Self::NoToken => "no_token",
            Self::InactiveToken => "inactive_token",
            Self::TokenInvalidated => "token_invalidated",
            Self::NotConfigured => "not_configured",
            Self::CryptoUnavailable => "crypto_unavailable",
        }
    }
}

#[derive(Clone)]
pub struct ReqwestDiscordRoleConnectionClient {
    http: Client,
    api_base: String,
    client_id: Option<String>,
    client_secret: Option<String>,
}

impl ReqwestDiscordRoleConnectionClient {
    pub fn from_config(cfg: &Config) -> Result<Self, reqwest::Error> {
        let http = Client::builder().timeout(Duration::from_secs(20)).build()?;
        Ok(Self {
            http,
            api_base: cfg.discord_api_base.trim_end_matches('/').to_string(),
            client_id: cfg.discord_oauth_client_id.clone(),
            client_secret: cfg.discord_oauth_client_secret.clone(),
        })
    }

    async fn post_token_form(
        &self,
        form: Vec<(&str, &str)>,
    ) -> Result<OAuthTokenResponse, DiscordRoleConnectionError> {
        let url = format!("{}/oauth2/token", self.api_base);
        let response = self
            .http
            .post(url)
            .form(&form)
            .send()
            .await
            .map_err(|_| DiscordRoleConnectionError::Transport)?;
        decode_discord_response(response).await
    }
}

impl DiscordRoleConnectionClient for ReqwestDiscordRoleConnectionClient {
    fn exchange_code<'a>(
        &'a self,
        code: &'a str,
        redirect_uri: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse> {
        Box::pin(async move {
            let (Some(client_id), Some(client_secret)) =
                (self.client_id.as_deref(), self.client_secret.as_deref())
            else {
                return Err(DiscordRoleConnectionError::Unconfigured);
            };
            self.post_token_form(vec![
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", redirect_uri),
            ])
            .await
        })
    }

    fn refresh_token<'a>(
        &'a self,
        refresh_token: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse> {
        Box::pin(async move {
            let (Some(client_id), Some(client_secret)) =
                (self.client_id.as_deref(), self.client_secret.as_deref())
            else {
                return Err(DiscordRoleConnectionError::Unconfigured);
            };
            self.post_token_form(vec![
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
            ])
            .await
        })
    }

    fn fetch_current_user<'a>(
        &'a self,
        access_token: &'a str,
    ) -> DiscordRoleConnectionFuture<'a, DiscordCurrentUser> {
        Box::pin(async move {
            let response = self
                .http
                .get(format!("{}/users/@me", self.api_base))
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|_| DiscordRoleConnectionError::Transport)?;
            decode_discord_response(response).await
        })
    }

    fn update_user_role_connection<'a>(
        &'a self,
        application_id: &'a str,
        access_token: &'a str,
        payload: &'a UserRoleConnectionPayload,
    ) -> DiscordRoleConnectionFuture<'a, ()> {
        Box::pin(async move {
            let response = self
                .http
                .put(format!(
                    "{}/users/@me/applications/{}/role-connection",
                    self.api_base, application_id
                ))
                .bearer_auth(access_token)
                .json(payload)
                .send()
                .await
                .map_err(|_| DiscordRoleConnectionError::Transport)?;
            decode_empty_discord_response(response).await
        })
    }

    fn register_metadata<'a>(
        &'a self,
        application_id: &'a str,
        bot_token: &'a str,
        records: &'a [RoleConnectionMetadataRecord],
    ) -> DiscordRoleConnectionFuture<'a, ()> {
        Box::pin(async move {
            let response = self
                .http
                .put(format!(
                    "{}/applications/{}/role-connections/metadata",
                    self.api_base, application_id
                ))
                .header("Authorization", format!("Bot {bot_token}"))
                .json(records)
                .send()
                .await
                .map_err(|_| DiscordRoleConnectionError::Transport)?;
            decode_empty_discord_response(response).await
        })
    }
}

async fn decode_discord_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
) -> Result<T, DiscordRoleConnectionError> {
    let status = response.status();
    if !status.is_success() {
        let error_code = response
            .json::<serde_json::Value>()
            .await
            .ok()
            .and_then(|value| {
                value
                    .get("error")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string)
            });
        return Err(DiscordRoleConnectionError::from_status(
            status,
            error_code.as_deref(),
        ));
    }
    response
        .json::<T>()
        .await
        .map_err(|_| DiscordRoleConnectionError::InvalidResponse)
}

async fn decode_empty_discord_response(
    response: reqwest::Response,
) -> Result<(), DiscordRoleConnectionError> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let error_code = response
        .json::<serde_json::Value>()
        .await
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        });
    Err(DiscordRoleConnectionError::from_status(
        status,
        error_code.as_deref(),
    ))
}

pub fn build_authorize_url(cfg: &Config, state: &str, redirect_uri: &str) -> AppResult<String> {
    let Some(client_id) = cfg.discord_oauth_client_id.as_deref() else {
        return Err(AppError::service_unavailable(MSG_NOT_CONFIGURED));
    };
    let query = form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", LINKED_ROLE_SCOPE)
        .append_pair("state", state)
        .finish();
    Ok(format!(
        "{}?{}",
        cfg.discord_oauth_authorize_base.trim_end_matches('/'),
        query
    ))
}

pub fn metadata_records() -> Vec<RoleConnectionMetadataRecord> {
    vec![
        RoleConnectionMetadataRecord {
            kind: 7,
            key: "steam_verknuepft".to_string(),
            name: METADATA_STEAM_NAME.to_string(),
            description: METADATA_STEAM_DESCRIPTION.to_string(),
        },
        RoleConnectionMetadataRecord {
            kind: 2,
            key: "rang".to_string(),
            name: METADATA_RANG_NAME.to_string(),
            description: METADATA_RANG_DESCRIPTION.to_string(),
        },
    ]
}

pub async fn register_metadata(state: &AppState) -> AppResult<()> {
    let Some(application_id) = state.cfg.discord_application_id.as_deref() else {
        return Err(AppError::service_unavailable(MSG_NOT_CONFIGURED));
    };
    let Some(bot_token) = state.cfg.discord_bot_token.as_deref() else {
        return Err(AppError::service_unavailable(MSG_NOT_CONFIGURED));
    };
    state
        .discord_role_connections
        .register_metadata(application_id, bot_token, &metadata_records())
        .await
        .map_err(map_discord_error)?;
    Ok(())
}

pub async fn store_oauth_tokens(
    state: &AppState,
    discord_id: i64,
    token: &OAuthTokenResponse,
) -> AppResult<i32> {
    let crypto = FieldCrypto::from_config(&state.cfg)?;
    let encrypted = encrypt_oauth_token_fields(&crypto, discord_id, token)?;
    store_oauth_tokens_encrypted(&state.pool, discord_id, &encrypted).await
}

struct EncryptedOAuthToken {
    access_token: Vec<u8>,
    refresh_token: Vec<u8>,
    token_type: String,
    scope: String,
    expires_at: DateTime<Utc>,
}

fn encrypt_oauth_token_fields(
    crypto: &FieldCrypto,
    discord_id: i64,
    token: &OAuthTokenResponse,
) -> AppResult<EncryptedOAuthToken> {
    Ok(EncryptedOAuthToken {
        access_token: crypto.encrypt(
            &token.access_token,
            &token_aad(discord_id, ACCESS_AAD_FIELD),
            FIELD_CRYPTO_KEY_ID,
        )?,
        refresh_token: crypto.encrypt(
            &token.refresh_token,
            &token_aad(discord_id, REFRESH_AAD_FIELD),
            FIELD_CRYPTO_KEY_ID,
        )?,
        token_type: token.token_type.as_deref().unwrap_or("Bearer").to_string(),
        scope: token
            .scope
            .as_deref()
            .unwrap_or(LINKED_ROLE_SCOPE)
            .to_string(),
        expires_at: token.expires_at(),
    })
}

async fn store_oauth_tokens_encrypted<'e, E>(
    executor: E,
    discord_id: i64,
    token: &EncryptedOAuthToken,
) -> AppResult<i32>
where
    E: Executor<'e, Database = Postgres>,
{
    let token_version = sqlx::query_scalar(
        "INSERT INTO core.discord_role_connection_tokens \
         (discord_id, access_token, refresh_token, token_type, scope, expires_at, active, \
          invalidated_at, invalidation_reason, last_refresh_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, NULL, now(), now()) \
         ON CONFLICT (discord_id) DO UPDATE SET \
             access_token=EXCLUDED.access_token, \
             refresh_token=EXCLUDED.refresh_token, \
             token_type=EXCLUDED.token_type, \
             scope=EXCLUDED.scope, \
             expires_at=EXCLUDED.expires_at, \
             token_version=core.discord_role_connection_tokens.token_version + 1, \
             active=TRUE, \
             invalidated_at=NULL, \
             invalidation_reason=NULL, \
             last_refresh_at=now(), \
             updated_at=now() \
         RETURNING token_version",
    )
    .bind(discord_id)
    .bind(&token.access_token)
    .bind(&token.refresh_token)
    .bind(&token.token_type)
    .bind(&token.scope)
    .bind(token.expires_at)
    .fetch_one(executor)
    .await?;
    Ok(token_version)
}

pub async fn push_for_user(
    state: &AppState,
    discord_id: i64,
) -> AppResult<RoleConnectionPushOutcome> {
    let Some(application_id) = state.cfg.discord_application_id.as_deref() else {
        return Ok(RoleConnectionPushOutcome::NotConfigured);
    };
    let mut tx = state.pool.begin().await?;
    acquire_role_connection_lock(&mut tx, discord_id).await?;

    let Some(stored) = load_stored_token(&mut tx, discord_id).await? else {
        tx.commit().await?;
        return Ok(RoleConnectionPushOutcome::NoToken);
    };
    if !stored.active {
        tx.commit().await?;
        return Ok(RoleConnectionPushOutcome::InactiveToken);
    }
    let Ok(crypto) = FieldCrypto::from_config(&state.cfg) else {
        tx.commit().await?;
        return Ok(RoleConnectionPushOutcome::CryptoUnavailable);
    };
    let mut token_version = stored.token_version;
    let mut access_token = match crypto.decrypt(
        &stored.access_token,
        &token_aad(discord_id, ACCESS_AAD_FIELD),
    ) {
        Ok(token) => token,
        Err(err) => {
            tracing::warn!(%err, discord_id, "Linked-Role-Token konnte nicht entschluesselt werden");
            mark_token_inactive(&mut tx, discord_id, "decrypt_failed", token_version).await?;
            tx.commit().await?;
            return Ok(RoleConnectionPushOutcome::TokenInvalidated);
        }
    };

    if stored.expires_at <= Utc::now() + TimeDelta::seconds(60) {
        let refresh_token = match crypto.decrypt(
            &stored.refresh_token,
            &token_aad(discord_id, REFRESH_AAD_FIELD),
        ) {
            Ok(token) => token,
            Err(err) => {
                tracing::warn!(%err, discord_id, "Linked-Role-Refresh-Token konnte nicht entschluesselt werden");
                mark_token_inactive(&mut tx, discord_id, "decrypt_failed", token_version).await?;
                tx.commit().await?;
                return Ok(RoleConnectionPushOutcome::TokenInvalidated);
            }
        };
        match state
            .discord_role_connections
            .refresh_token(&refresh_token)
            .await
        {
            Ok(refreshed) => {
                access_token = refreshed.access_token.clone();
                let encrypted = encrypt_oauth_token_fields(&crypto, discord_id, &refreshed)?;
                token_version =
                    store_oauth_tokens_encrypted(&mut *tx, discord_id, &encrypted).await?;
            }
            Err(err) if err.invalidates_user_token() => {
                mark_token_inactive(&mut tx, discord_id, "refresh_invalid", token_version).await?;
                tx.commit().await?;
                return Ok(RoleConnectionPushOutcome::TokenInvalidated);
            }
            Err(err) => {
                record_push_error(&mut tx, discord_id, format!("refresh:{err:?}")).await?;
                tx.commit().await?;
                return Err(map_discord_error(err));
            }
        }
    }

    let profile = load_role_connection_profile(&mut *tx, discord_id).await?;
    let payload = build_user_role_connection_payload(&profile);
    match state
        .discord_role_connections
        .update_user_role_connection(application_id, &access_token, &payload)
        .await
    {
        Ok(()) => {
            record_push_success(&mut tx, discord_id).await?;
            tx.commit().await?;
            Ok(RoleConnectionPushOutcome::Pushed)
        }
        Err(err) if err.invalidates_user_token() => {
            mark_token_inactive(&mut tx, discord_id, "push_invalid", token_version).await?;
            tx.commit().await?;
            Ok(RoleConnectionPushOutcome::TokenInvalidated)
        }
        Err(err) => {
            record_push_error(&mut tx, discord_id, format!("push:{err:?}")).await?;
            tx.commit().await?;
            Err(map_discord_error(err))
        }
    }
}

pub async fn enqueue_sync(pool: &PgPool, discord_id: i64, reason: &str) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO core.discord_role_connection_sync_state \
         (discord_id, pending, reason, attempts, next_attempt_at, last_error, updated_at) \
         VALUES ($1, TRUE, $2, 0, now(), NULL, now()) \
         ON CONFLICT (discord_id) DO UPDATE SET \
             pending=TRUE, reason=EXCLUDED.reason, attempts=0, next_attempt_at=now(), \
             last_error=NULL, updated_at=now()",
    )
    .bind(discord_id)
    .bind(reason)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn spawn_sync_worker(state: AppState) {
    if !state.cfg.discord_role_connection_sync_worker_enabled {
        return;
    }
    tokio::spawn(async move {
        let interval = Duration::from_secs(state.cfg.discord_role_connection_sync_interval_seconds);
        loop {
            if let Err(err) = process_pending_sync(&state, 10).await {
                tracing::warn!(?err, "Linked-Role-Sync-Worker fehlgeschlagen");
            }
            tokio::time::sleep(interval).await;
        }
    });
}

pub async fn process_pending_sync(state: &AppState, limit: i64) -> AppResult<usize> {
    let rows = sqlx::query(
        "UPDATE core.discord_role_connection_sync_state AS sync \
            SET pending=FALSE, locked_at=now(), updated_at=now() \
          WHERE sync.discord_id IN ( \
              SELECT discord_id \
                FROM core.discord_role_connection_sync_state \
               WHERE pending=TRUE \
                 AND next_attempt_at <= now() \
               ORDER BY updated_at ASC \
               LIMIT $1 \
               FOR UPDATE SKIP LOCKED \
          ) \
          RETURNING sync.discord_id, sync.attempts",
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    let mut processed = 0usize;
    for row in rows {
        let discord_id: i64 = row.get("discord_id");
        let attempts: i32 = row.get("attempts");
        match push_for_user(state, discord_id).await {
            Ok(RoleConnectionPushOutcome::Pushed)
            | Ok(RoleConnectionPushOutcome::NoToken)
            | Ok(RoleConnectionPushOutcome::InactiveToken)
            | Ok(RoleConnectionPushOutcome::TokenInvalidated) => {
                sqlx::query(
                    "UPDATE core.discord_role_connection_sync_state \
                        SET pending=FALSE, locked_at=NULL, last_error=NULL, updated_at=now() \
                      WHERE discord_id=$1",
                )
                .bind(discord_id)
                .execute(&state.pool)
                .await?;
            }
            Ok(outcome @ RoleConnectionPushOutcome::NotConfigured)
            | Ok(outcome @ RoleConnectionPushOutcome::CryptoUnavailable) => {
                let next_attempts = attempts.saturating_add(1);
                record_sync_retry(
                    state,
                    discord_id,
                    next_attempts,
                    outcome.as_str().to_string(),
                )
                .await?;
            }
            Err(err) => {
                let next_attempts = attempts.saturating_add(1);
                record_sync_retry(state, discord_id, next_attempts, format!("{err:?}")).await?;
            }
        }
        processed += 1;
    }
    Ok(processed)
}

async fn record_sync_retry(
    state: &AppState,
    discord_id: i64,
    attempts: i32,
    error: String,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE core.discord_role_connection_sync_state \
            SET pending=TRUE, locked_at=NULL, attempts=$2, \
                next_attempt_at=now() + (($3::int * 60)::text || ' seconds')::interval, \
                last_error=$4, updated_at=now() \
          WHERE discord_id=$1",
    )
    .bind(discord_id)
    .bind(attempts)
    .bind(attempts.clamp(1, 30))
    .bind(error.chars().take(300).collect::<String>())
    .execute(&state.pool)
    .await?;
    Ok(())
}

#[derive(Debug)]
struct StoredToken {
    access_token: Vec<u8>,
    refresh_token: Vec<u8>,
    expires_at: DateTime<Utc>,
    token_version: i32,
    active: bool,
}

async fn acquire_role_connection_lock(
    tx: &mut Transaction<'_, Postgres>,
    discord_id: i64,
) -> AppResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(role_connection_lock_key(discord_id))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

fn role_connection_lock_key(discord_id: i64) -> i64 {
    ROLE_CONNECTION_ADVISORY_LOCK_NAMESPACE ^ discord_id
}

async fn load_stored_token(
    tx: &mut Transaction<'_, Postgres>,
    discord_id: i64,
) -> AppResult<Option<StoredToken>> {
    let row = sqlx::query(
        "SELECT access_token, refresh_token, expires_at, token_version, active \
           FROM core.discord_role_connection_tokens \
          WHERE discord_id=$1 \
          FOR UPDATE",
    )
    .bind(discord_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|row| StoredToken {
        access_token: row.get("access_token"),
        refresh_token: row.get("refresh_token"),
        expires_at: row.get("expires_at"),
        token_version: row.get("token_version"),
        active: row.get("active"),
    }))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoleConnectionProfile {
    pub steam_linked: bool,
    pub rank: i32,
}

pub async fn load_role_connection_profile<'e, E>(
    executor: E,
    discord_id: i64,
) -> AppResult<RoleConnectionProfile>
where
    E: Executor<'e, Database = Postgres>,
{
    let row = sqlx::query(
        "SELECT \
            EXISTS( \
                SELECT 1 FROM core.steam_links \
                 WHERE discord_id=$1 AND verified=TRUE AND steam_id IS NOT NULL AND steam_id <> '' \
            ) AS steam_linked, \
            COALESCE(( \
                SELECT COALESCE(deadlock_badge_level, deadlock_rank) \
                  FROM core.steam_links \
                 WHERE discord_id=$1 \
                   AND verified=TRUE \
                   AND COALESCE(deadlock_badge_level, deadlock_rank) IS NOT NULL \
                 ORDER BY primary_account DESC, deadlock_rank_updated_at DESC NULLS LAST, \
                          updated_at DESC NULLS LAST \
                 LIMIT 1 \
            ), 0) AS rank",
    )
    .bind(discord_id)
    .fetch_one(executor)
    .await?;
    Ok(RoleConnectionProfile {
        steam_linked: row.get("steam_linked"),
        rank: row.get("rank"),
    })
}

pub fn build_user_role_connection_payload(
    profile: &RoleConnectionProfile,
) -> UserRoleConnectionPayload {
    let mut metadata = BTreeMap::new();
    metadata.insert(
        "steam_verknuepft".to_string(),
        if profile.steam_linked { "1" } else { "0" }.to_string(),
    );
    metadata.insert("rang".to_string(), profile.rank.max(0).to_string());
    UserRoleConnectionPayload {
        platform_name: Some(PLATFORM_NAME.to_string()),
        platform_username: Some(
            if profile.steam_linked {
                PLATFORM_USERNAME_LINKED
            } else {
                PLATFORM_USERNAME_UNLINKED
            }
            .to_string(),
        ),
        metadata,
    }
}

async fn mark_token_inactive(
    tx: &mut Transaction<'_, Postgres>,
    discord_id: i64,
    reason: &'static str,
    token_version: i32,
) -> AppResult<bool> {
    let result = sqlx::query(
        "UPDATE core.discord_role_connection_tokens \
            SET active=FALSE, invalidated_at=now(), invalidation_reason=$2, updated_at=now() \
          WHERE discord_id=$1 AND token_version=$3",
    )
    .bind(discord_id)
    .bind(reason)
    .bind(token_version)
    .execute(&mut **tx)
    .await?;
    Ok(result.rows_affected() > 0)
}

async fn record_push_success(tx: &mut Transaction<'_, Postgres>, discord_id: i64) -> AppResult<()> {
    sqlx::query(
        "UPDATE core.discord_role_connection_tokens \
            SET last_push_at=now(), last_push_error=NULL, updated_at=now() \
          WHERE discord_id=$1",
    )
    .bind(discord_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn record_push_error(
    tx: &mut Transaction<'_, Postgres>,
    discord_id: i64,
    error: String,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE core.discord_role_connection_tokens \
            SET last_push_error=$2, updated_at=now() \
          WHERE discord_id=$1",
    )
    .bind(discord_id)
    .bind(error.chars().take(300).collect::<String>())
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn map_discord_error(err: DiscordRoleConnectionError) -> AppError {
    match err {
        DiscordRoleConnectionError::Unconfigured => {
            AppError::service_unavailable(MSG_NOT_CONFIGURED)
        }
        DiscordRoleConnectionError::InvalidGrant | DiscordRoleConnectionError::Unauthorized => {
            AppError::unauthorized(MSG_RELINK_REQUIRED)
        }
        DiscordRoleConnectionError::Transport => {
            AppError::service_unavailable(MSG_DISCORD_UNAVAILABLE)
        }
        DiscordRoleConnectionError::HttpStatus(status)
            if status == StatusCode::TOO_MANY_REQUESTS =>
        {
            AppError::service_unavailable(MSG_NOT_CONFIGURED)
        }
        DiscordRoleConnectionError::HttpStatus(_) | DiscordRoleConnectionError::InvalidResponse => {
            AppError::service_unavailable(MSG_NOT_CONFIGURED)
        }
    }
}

fn token_aad(discord_id: i64, field: &str) -> String {
    format!("core.discord_role_connection_tokens|{field}|{discord_id}|{TOKEN_AAD_VERSION}")
}

struct FieldCrypto {
    key_v1: [u8; FIELD_CRYPTO_KEY_SIZE],
}

impl FieldCrypto {
    fn from_config(cfg: &Config) -> AppResult<Self> {
        let Some(raw) = cfg.db_master_key_v1.as_deref() else {
            return Err(AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE));
        };
        let decoded = decode_hex(raw.trim())
            .map_err(|_| AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE))?;
        let key_v1: [u8; FIELD_CRYPTO_KEY_SIZE] = decoded
            .try_into()
            .map_err(|_| AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE))?;
        Ok(Self { key_v1 })
    }

    fn encrypt(&self, plaintext: &str, aad: &str, kid: &str) -> AppResult<Vec<u8>> {
        if kid != FIELD_CRYPTO_KEY_ID {
            return Err(AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE));
        }
        let mut nonce = [0_u8; FIELD_CRYPTO_NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce);
        let cipher = Aes256Gcm::new_from_slice(&self.key_v1)
            .map_err(|_| AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE))?;
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                aes_gcm::aead::Payload {
                    msg: plaintext.as_bytes(),
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE))?;
        let kid_bytes = kid.as_bytes();
        if kid_bytes.len() > u8::MAX as usize {
            return Err(AppError::service_unavailable(MSG_CRYPTO_UNAVAILABLE));
        }
        let mut out = Vec::with_capacity(2 + kid_bytes.len() + nonce.len() + ciphertext.len());
        out.push(FIELD_CRYPTO_VERSION);
        out.push(kid_bytes.len() as u8);
        out.extend_from_slice(kid_bytes);
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    fn decrypt(&self, blob: &[u8], aad: &str) -> Result<String, &'static str> {
        if blob.len() < 2 + 1 + FIELD_CRYPTO_NONCE_SIZE {
            return Err("invalid_payload");
        }
        if blob[0] != FIELD_CRYPTO_VERSION {
            return Err("invalid_version");
        }
        let kid_len = blob[1] as usize;
        let kid_start = 2;
        let kid_end = kid_start + kid_len;
        let nonce_end = kid_end + FIELD_CRYPTO_NONCE_SIZE;
        if blob.len() <= nonce_end {
            return Err("truncated_payload");
        }
        let kid = std::str::from_utf8(&blob[kid_start..kid_end]).map_err(|_| "invalid_kid")?;
        if kid != FIELD_CRYPTO_KEY_ID {
            return Err("missing_key");
        }
        let nonce = &blob[kid_end..nonce_end];
        let ciphertext = &blob[nonce_end..];
        let cipher = Aes256Gcm::new_from_slice(&self.key_v1).map_err(|_| "invalid_key")?;
        let plaintext = cipher
            .decrypt(
                Nonce::from_slice(nonce),
                aes_gcm::aead::Payload {
                    msg: ciphertext,
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| "decrypt_failed")?;
        String::from_utf8(plaintext).map_err(|_| "invalid_utf8")
    }
}

fn decode_hex(raw: &str) -> Result<Vec<u8>, ()> {
    if raw.len() != FIELD_CRYPTO_KEY_SIZE * 2 {
        return Err(());
    }
    let mut out = Vec::with_capacity(FIELD_CRYPTO_KEY_SIZE);
    for idx in (0..raw.len()).step_by(2) {
        let byte = u8::from_str_radix(&raw[idx..idx + 2], 16).map_err(|_| ())?;
        out.push(byte);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use std::{
        net::{IpAddr, Ipv4Addr, SocketAddr},
        sync::{
            atomic::{AtomicUsize, Ordering},
            Mutex,
        },
        time::Duration,
    };

    use super::*;
    use crate::{
        app::{router, AppState},
        auth,
        discord_broker::ReqwestDiscordRoleBroker,
    };
    use axum::{
        body::Body,
        extract::connect_info::ConnectInfo,
        http::{header, Method, Request, StatusCode},
    };
    use serde_json::{json, Value};
    use tower::ServiceExt;

    #[test]
    fn metadata_records_match_discord_contract() {
        let records = metadata_records();
        assert_eq!(
            serde_json::to_value(&records).expect("metadata json"),
            json!([
                {
                    "type": 7,
                    "key": "steam_verknuepft",
                    "name": "Steam verknüpft",
                    "description": "Steam-Account ist mit der Community-Website verknüpft"
                },
                {
                    "type": 2,
                    "key": "rang",
                    "name": "Deadlock-Rang",
                    "description": "Verifizierter Rang aus den verknüpften Steam-Daten"
                }
            ])
        );
    }

    #[test]
    fn role_connection_payload_stringifies_metadata_values() {
        let payload = build_user_role_connection_payload(&RoleConnectionProfile {
            steam_linked: true,
            rank: 843,
        });
        assert_eq!(
            serde_json::to_value(&payload).expect("payload json"),
            json!({
                "platform_name": "Deadlock Community",
                "platform_username": "Steam verknüpft",
                "metadata": {
                    "rang": "843",
                    "steam_verknuepft": "1"
                }
            })
        );
    }

    #[test]
    fn field_crypto_roundtrip_binds_aad() {
        let cfg = test_cfg();
        let crypto = FieldCrypto::from_config(&cfg).expect("crypto");
        let blob = crypto
            .encrypt("access-token", "table|field|1|1", FIELD_CRYPTO_KEY_ID)
            .expect("encrypt");
        assert_eq!(
            crypto.decrypt(&blob, "table|field|1|1").expect("decrypt"),
            "access-token"
        );
        assert!(crypto.decrypt(&blob, "table|field|2|1").is_err());
    }

    #[tokio::test]
    async fn linked_role_login_without_session_redirects_to_discord() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940500"));
        let (_db, state) = test_state(role_client).await;
        let app = router(state);
        let request = request(
            Method::GET,
            "/api/auth/discord/linked-role/login?next=/done",
            None,
        )
        .body(Body::empty())
        .expect("request");

        let response = app.oneshot(with_peer(request)).await.expect("response");

        assert_eq!(response.status(), StatusCode::FOUND);
        let location = response
            .headers()
            .get(header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .expect("location");
        assert!(location.starts_with("https://discord.com/oauth2/authorize?"));
        assert!(location.contains("scope=identify+role_connections.write"));
        assert!(response.headers().get(header::SET_COOKIE).is_some());
    }

    #[tokio::test]
    async fn linked_role_callback_stores_token_and_pushes_metadata() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940501"));
        let (_db, state) = test_state(role_client.clone()).await;
        seed_verified_steam_link(&state, 940501, 843).await;

        let session = state
            .auth
            .create_session_jwt("940501", "unit_user", "user", Some("Unit User"), None)
            .expect("session");
        let role_state = state
            .auth
            .create_pre_auth_jwt("state-940501", "/done")
            .expect("role state");
        let app = router(state.clone());
        let request = request(
            Method::GET,
            "/api/auth/discord/linked-role/callback?state=state-940501&code=oauth-code",
            None,
        )
        .header(
            header::COOKIE,
            format!("ddc_session={session}; ddc_role_connection_state={role_state}"),
        )
        .body(Body::empty())
        .expect("request");
        let response = app.oneshot(with_peer(request)).await.expect("response");

        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(
            response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok()),
            Some("/done")
        );
        {
            let updates = role_client.updates.lock().expect("updates");
            assert_eq!(updates.len(), 1);
            assert_eq!(updates[0].0, "access-token");
            assert_eq!(updates[0].1.metadata["steam_verknuepft"], "1");
            assert_eq!(updates[0].1.metadata["rang"], "843");
        }

        let active: bool = sqlx::query_scalar(
            "SELECT active FROM core.discord_role_connection_tokens WHERE discord_id=$1",
        )
        .bind(940501_i64)
        .fetch_one(&state.pool)
        .await
        .expect("token row");
        assert!(active);
    }

    #[tokio::test]
    async fn linked_role_callback_without_session_stores_token_and_pushes_metadata() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940506"));
        let (_db, state) = test_state(role_client.clone()).await;
        seed_verified_steam_link(&state, 940506, 721).await;

        let role_state = state
            .auth
            .create_pre_auth_jwt("state-940506", "/done")
            .expect("role state");
        let app = router(state.clone());
        let request = request(
            Method::GET,
            "/api/auth/discord/linked-role/callback?state=state-940506&code=oauth-code",
            None,
        )
        .header(
            header::COOKIE,
            format!("ddc_role_connection_state={role_state}"),
        )
        .body(Body::empty())
        .expect("request");
        let response = app.oneshot(with_peer(request)).await.expect("response");

        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(
            response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok()),
            Some("/done")
        );
        {
            let updates = role_client.updates.lock().expect("updates");
            assert_eq!(updates.len(), 1);
            assert_eq!(updates[0].0, "access-token");
            assert_eq!(updates[0].1.metadata["steam_verknuepft"], "1");
            assert_eq!(updates[0].1.metadata["rang"], "721");
        }

        let active: bool = sqlx::query_scalar(
            "SELECT active FROM core.discord_role_connection_tokens WHERE discord_id=$1",
        )
        .bind(940506_i64)
        .fetch_one(&state.pool)
        .await
        .expect("token row");
        assert!(active);
    }

    #[tokio::test]
    async fn push_refreshes_expired_token_before_discord_update() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940502"));
        let (_db, state) = test_state(role_client.clone()).await;
        seed_verified_steam_link(&state, 940502, 512).await;
        auth::upsert_meta_user(&state, 940502, "refresh_user", "Refresh User", None)
            .await
            .expect("meta user");
        store_oauth_tokens(
            &state,
            940502,
            &OAuthTokenResponse {
                access_token: "old-access".into(),
                refresh_token: "old-refresh".into(),
                token_type: Some("Bearer".into()),
                expires_in: Some(3600),
                scope: Some(LINKED_ROLE_SCOPE.into()),
            },
        )
        .await
        .expect("store token");
        sqlx::query(
            "UPDATE core.discord_role_connection_tokens SET expires_at=now() - interval '1 minute' WHERE discord_id=$1",
        )
        .bind(940502_i64)
        .execute(&state.pool)
        .await
        .expect("expire token");

        let outcome = push_for_user(&state, 940502).await.expect("push");

        assert_eq!(outcome, RoleConnectionPushOutcome::Pushed);
        assert_eq!(role_client.refresh_count.load(Ordering::SeqCst), 1);
        let updates = role_client.updates.lock().expect("updates");
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].0, "refreshed-access");
        assert_eq!(updates[0].1.metadata["rang"], "512");
    }

    #[tokio::test]
    async fn concurrent_pushes_serialize_refresh_and_keep_rotated_token_active() {
        let role_client = Arc::new(
            MockRoleConnectionClient::with_refresh_responses(
                "940504",
                vec![
                    Ok(OAuthTokenResponse {
                        access_token: "race-refreshed-access".into(),
                        refresh_token: "race-refreshed-refresh".into(),
                        token_type: Some("Bearer".into()),
                        expires_in: Some(3600),
                        scope: Some(LINKED_ROLE_SCOPE.into()),
                    }),
                    Err(DiscordRoleConnectionError::InvalidGrant),
                ],
            )
            .with_refresh_delay(Duration::from_millis(50)),
        );
        let (_db, state) = test_state(role_client.clone()).await;
        seed_verified_steam_link(&state, 940504, 640).await;
        auth::upsert_meta_user(&state, 940504, "race_user", "Race User", None)
            .await
            .expect("meta user");
        store_oauth_tokens(
            &state,
            940504,
            &OAuthTokenResponse {
                access_token: "old-access".into(),
                refresh_token: "old-refresh".into(),
                token_type: Some("Bearer".into()),
                expires_in: Some(3600),
                scope: Some(LINKED_ROLE_SCOPE.into()),
            },
        )
        .await
        .expect("store token");
        sqlx::query(
            "UPDATE core.discord_role_connection_tokens SET expires_at=now() - interval '1 minute' WHERE discord_id=$1",
        )
        .bind(940504_i64)
        .execute(&state.pool)
        .await
        .expect("expire token");

        let (first, second) =
            tokio::join!(push_for_user(&state, 940504), push_for_user(&state, 940504));

        assert_eq!(
            first.expect("first push"),
            RoleConnectionPushOutcome::Pushed
        );
        assert_eq!(
            second.expect("second push"),
            RoleConnectionPushOutcome::Pushed
        );
        assert_eq!(role_client.refresh_count.load(Ordering::SeqCst), 1);
        {
            let updates = role_client.updates.lock().expect("updates");
            assert_eq!(updates.len(), 2);
            assert!(updates
                .iter()
                .all(|(access_token, _)| access_token == "race-refreshed-access"));
        }
        let (active, token_version): (bool, i32) = sqlx::query_as(
            "SELECT active, token_version FROM core.discord_role_connection_tokens WHERE discord_id=$1",
        )
        .bind(940504_i64)
        .fetch_one(&state.pool)
        .await
        .expect("token row");
        assert!(active);
        assert_eq!(token_version, 2);
    }

    #[tokio::test]
    async fn pending_sync_survives_missing_config_and_processes_after_config_returns() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940505"));
        let mut cfg = test_cfg();
        cfg.discord_application_id = None;
        let (_db, state) = test_state_with_cfg(role_client.clone(), cfg).await;
        seed_verified_steam_link(&state, 940505, 1024).await;
        auth::upsert_meta_user(&state, 940505, "pending_user", "Pending User", None)
            .await
            .expect("meta user");
        store_oauth_tokens(
            &state,
            940505,
            &OAuthTokenResponse {
                access_token: "pending-access".into(),
                refresh_token: "pending-refresh".into(),
                token_type: Some("Bearer".into()),
                expires_in: Some(3600),
                scope: Some(LINKED_ROLE_SCOPE.into()),
            },
        )
        .await
        .expect("store token");
        enqueue_sync(&state.pool, 940505, "unit")
            .await
            .expect("enqueue");

        let processed = process_pending_sync(&state, 1).await.expect("process");

        assert_eq!(processed, 1);
        let (pending, attempts, last_error): (bool, i32, Option<String>) = sqlx::query_as(
            "SELECT pending, attempts, last_error \
               FROM core.discord_role_connection_sync_state \
              WHERE discord_id=$1",
        )
        .bind(940505_i64)
        .fetch_one(&state.pool)
        .await
        .expect("sync row");
        assert!(pending);
        assert_eq!(attempts, 1);
        assert_eq!(last_error.as_deref(), Some("not_configured"));

        sqlx::query(
            "UPDATE core.discord_role_connection_sync_state \
                SET next_attempt_at=now() \
              WHERE discord_id=$1",
        )
        .bind(940505_i64)
        .execute(&state.pool)
        .await
        .expect("make due");
        let ready_state =
            state_for_pool_with_cfg(state.pool.clone(), test_cfg(), role_client.clone());

        let processed = process_pending_sync(&ready_state, 1)
            .await
            .expect("process configured");

        assert_eq!(processed, 1);
        let (pending, last_error): (bool, Option<String>) = sqlx::query_as(
            "SELECT pending, last_error \
               FROM core.discord_role_connection_sync_state \
              WHERE discord_id=$1",
        )
        .bind(940505_i64)
        .fetch_one(&ready_state.pool)
        .await
        .expect("sync row after config");
        assert!(!pending);
        assert!(last_error.is_none());
        assert_eq!(role_client.updates.lock().expect("updates").len(), 1);
    }

    #[tokio::test]
    async fn metadata_registration_route_uses_mock_client() {
        let role_client = Arc::new(MockRoleConnectionClient::new("940503"));
        let (_db, state) = test_state(role_client.clone()).await;
        let app = router(state);
        let request = request(
            Method::POST,
            "/api/admin/discord-role-connections/metadata",
            None,
        )
        .header("X-Admin-Validated", "1")
        .header("X-Admin-User", "admin")
        .body(Body::empty())
        .expect("request");
        let response = app.oneshot(with_peer(request)).await.expect("response");

        assert_eq!(response.status(), StatusCode::OK);
        let records = role_client.registered.lock().expect("registered");
        assert_eq!(records.len(), 1);
        assert_eq!(records[0][0].key, "steam_verknuepft");
        assert_eq!(records[0][1].key, "rang");
    }

    async fn test_state(
        role_client: Arc<MockRoleConnectionClient>,
    ) -> (dl_central_db::TestDb, AppState) {
        test_state_with_cfg(role_client, test_cfg()).await
    }

    async fn test_state_with_cfg(
        role_client: Arc<MockRoleConnectionClient>,
        cfg: Config,
    ) -> (dl_central_db::TestDb, AppState) {
        let db = dl_central_db::testing::test_pool()
            .await
            .expect("central test pool");
        let state = state_for_pool_with_cfg(db.pool().clone(), cfg, role_client);
        (db, state)
    }

    fn state_for_pool_with_cfg(
        pool: PgPool,
        cfg: Config,
        role_client: Arc<MockRoleConnectionClient>,
    ) -> AppState {
        let broker = Arc::new(ReqwestDiscordRoleBroker::from_config(&cfg).expect("broker"));
        AppState::for_test_pool_with_clients(
            pool,
            cfg,
            broker,
            role_client as DynDiscordRoleConnectionClient,
        )
    }

    fn test_cfg() -> Config {
        Config {
            host: "127.0.0.1".into(),
            port: 1,
            auth_cookie_name: "ddc_session".into(),
            pre_auth_cookie_name: "ddc_pre_auth".into(),
            session_ttl_seconds: 3600,
            pre_auth_ttl_seconds: 600,
            session_audience: "ddc-web-test".into(),
            session_issuer: "ddc-auth-test".into(),
            cookie_domain: None,
            ddc_cookie_domain: "example.test".into(),
            cookie_path: "/".into(),
            cookie_samesite: "lax".into(),
            auth_public_callback_url: None,
            dashboard_internal_api_base: "http://127.0.0.1:8766".into(),
            master_broker_base: "http://127.0.0.1:8770".into(),
            master_broker_token: None,
            scrim_guild_id: 1,
            scrim_signup_role_id: None,
            scrim_reserve_role_id: None,
            ddl_creator_role_id: None,
            youtube_api_key: None,
            auth_session_secret: Some("test-session-secret".into()),
            discord_api_base: "https://discord.com/api/v10".into(),
            discord_oauth_client_id: Some("123".into()),
            discord_oauth_client_secret: Some("secret".into()),
            discord_application_id: Some("123".into()),
            discord_bot_token: Some("bot-token".into()),
            discord_role_connection_callback_url: None,
            discord_role_connection_cookie_name: "ddc_role_connection_state".into(),
            discord_role_connection_sync_worker_enabled: false,
            discord_role_connection_sync_interval_seconds: 30,
            db_master_key_v1: Some("00".repeat(32)),
            discord_oauth_authorize_base: "https://discord.com/oauth2/authorize".into(),
        }
    }

    async fn seed_verified_steam_link(state: &AppState, discord_id: i64, badge_level: i32) {
        sqlx::query(
            "INSERT INTO core.users(discord_id, username) VALUES($1, $2) \
             ON CONFLICT(discord_id) DO NOTHING",
        )
        .bind(discord_id)
        .bind(format!("user-{discord_id}"))
        .execute(&state.pool)
        .await
        .expect("core user");
        sqlx::query(
            "INSERT INTO core.steam_links \
             (discord_id, steam_id, steam_id64, verified, primary_account, deadlock_badge_level, updated_at) \
             VALUES ($1, $2, $3, TRUE, TRUE, $4, now())",
        )
        .bind(discord_id)
        .bind(format!("steam-{discord_id}"))
        .bind(discord_id)
        .bind(badge_level)
        .execute(&state.pool)
        .await
        .expect("steam link");
    }

    fn request(method: Method, uri: &str, body: Option<Value>) -> axum::http::request::Builder {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::HOST, "example.test")
            .header("X-Forwarded-Proto", "https")
            .header("content-type", "application/json");
        if let Some(body) = body {
            builder.header("content-length", body.to_string().len())
        } else {
            builder
        }
    }

    fn with_peer(mut request: Request<Body>) -> Request<Body> {
        request.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        request
    }

    struct MockRoleConnectionClient {
        user_id: String,
        updates: Mutex<Vec<(String, UserRoleConnectionPayload)>>,
        registered: Mutex<Vec<Vec<RoleConnectionMetadataRecord>>>,
        refresh_count: AtomicUsize,
        refresh_responses: Mutex<Vec<Result<OAuthTokenResponse, DiscordRoleConnectionError>>>,
        refresh_delay: Duration,
    }

    impl MockRoleConnectionClient {
        fn new(user_id: &str) -> Self {
            Self {
                user_id: user_id.to_string(),
                updates: Mutex::new(Vec::new()),
                registered: Mutex::new(Vec::new()),
                refresh_count: AtomicUsize::new(0),
                refresh_responses: Mutex::new(Vec::new()),
                refresh_delay: Duration::ZERO,
            }
        }

        fn with_refresh_responses(
            user_id: &str,
            refresh_responses: Vec<Result<OAuthTokenResponse, DiscordRoleConnectionError>>,
        ) -> Self {
            Self {
                refresh_responses: Mutex::new(refresh_responses),
                ..Self::new(user_id)
            }
        }

        fn with_refresh_delay(mut self, refresh_delay: Duration) -> Self {
            self.refresh_delay = refresh_delay;
            self
        }
    }

    impl DiscordRoleConnectionClient for MockRoleConnectionClient {
        fn exchange_code<'a>(
            &'a self,
            _code: &'a str,
            _redirect_uri: &'a str,
        ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse> {
            Box::pin(async move {
                Ok(OAuthTokenResponse {
                    access_token: "access-token".into(),
                    refresh_token: "refresh-token".into(),
                    token_type: Some("Bearer".into()),
                    expires_in: Some(3600),
                    scope: Some(LINKED_ROLE_SCOPE.into()),
                })
            })
        }

        fn refresh_token<'a>(
            &'a self,
            _refresh_token: &'a str,
        ) -> DiscordRoleConnectionFuture<'a, OAuthTokenResponse> {
            Box::pin(async move {
                let call_idx = self.refresh_count.fetch_add(1, Ordering::SeqCst);
                if !self.refresh_delay.is_zero() {
                    tokio::time::sleep(self.refresh_delay).await;
                }
                if let Some(response) = self
                    .refresh_responses
                    .lock()
                    .expect("refresh responses")
                    .get(call_idx)
                    .cloned()
                {
                    return response;
                }
                Ok(default_refreshed_token())
            })
        }

        fn fetch_current_user<'a>(
            &'a self,
            _access_token: &'a str,
        ) -> DiscordRoleConnectionFuture<'a, DiscordCurrentUser> {
            Box::pin(async move {
                Ok(DiscordCurrentUser {
                    id: self.user_id.clone(),
                    username: "unit_user".into(),
                    global_name: Some("Unit User".into()),
                    avatar: None,
                })
            })
        }

        fn update_user_role_connection<'a>(
            &'a self,
            _application_id: &'a str,
            access_token: &'a str,
            payload: &'a UserRoleConnectionPayload,
        ) -> DiscordRoleConnectionFuture<'a, ()> {
            Box::pin(async move {
                self.updates
                    .lock()
                    .expect("updates")
                    .push((access_token.to_string(), payload.clone()));
                Ok(())
            })
        }

        fn register_metadata<'a>(
            &'a self,
            _application_id: &'a str,
            _bot_token: &'a str,
            records: &'a [RoleConnectionMetadataRecord],
        ) -> DiscordRoleConnectionFuture<'a, ()> {
            Box::pin(async move {
                self.registered
                    .lock()
                    .expect("registered")
                    .push(records.to_vec());
                Ok(())
            })
        }
    }

    fn default_refreshed_token() -> OAuthTokenResponse {
        OAuthTokenResponse {
            access_token: "refreshed-access".into(),
            refresh_token: "refreshed-refresh".into(),
            token_type: Some("Bearer".into()),
            expires_in: Some(3600),
            scope: Some(LINKED_ROLE_SCOPE.into()),
        }
    }
}
