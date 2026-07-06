use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub auth_cookie_name: String,
    pub pre_auth_cookie_name: String,
    pub session_ttl_seconds: i64,
    pub pre_auth_ttl_seconds: i64,
    pub session_audience: String,
    pub session_issuer: String,
    pub cookie_domain: Option<String>,
    pub ddc_cookie_domain: String,
    pub cookie_path: String,
    pub cookie_samesite: String,
    pub auth_public_callback_url: Option<String>,
    pub dashboard_internal_api_base: String,
    pub master_broker_base: String,
    pub master_broker_token: Option<String>,
    pub scrim_guild_id: u64,
    pub scrim_reserve_role_id: Option<i64>,
    pub auth_session_secret: Option<String>,
    pub discord_api_base: String,
    pub discord_oauth_authorize_base: String,
    pub discord_oauth_client_id: Option<String>,
    pub discord_oauth_client_secret: Option<String>,
    pub discord_application_id: Option<String>,
    pub discord_bot_token: Option<String>,
    pub discord_role_connection_callback_url: Option<String>,
    pub discord_role_connection_cookie_name: String,
    pub discord_role_connection_sync_worker_enabled: bool,
    pub discord_role_connection_sync_interval_seconds: u64,
    pub db_master_key_v1: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env_or("WEBSITE_BACKEND_HOST", "127.0.0.1"),
            port: env::var("WEBSITE_BACKEND_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8772),
            auth_cookie_name: env_or("AUTH_COOKIE_NAME", "ddc_session"),
            pre_auth_cookie_name: env_or("AUTH_PRE_AUTH_COOKIE_NAME", "ddc_pre_auth"),
            session_ttl_seconds: env::var("AUTH_SESSION_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30 * 24 * 60 * 60),
            pre_auth_ttl_seconds: env::var("AUTH_PRE_AUTH_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(600),
            session_audience: env_or("AUTH_SESSION_AUDIENCE", "ddc-web"),
            session_issuer: env_or("AUTH_SESSION_ISSUER", "ddc-auth"),
            cookie_domain: env::var("AUTH_COOKIE_DOMAIN")
                .ok()
                .map(normalized_domain)
                .filter(|v| !v.is_empty()),
            ddc_cookie_domain: env::var("AUTH_DDC_COOKIE_DOMAIN")
                .ok()
                .map(normalized_domain)
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "deutsche-deadlock-community.de".to_string()),
            cookie_path: env_or("AUTH_COOKIE_PATH", "/"),
            cookie_samesite: env_or("AUTH_COOKIE_SAMESITE", "lax").to_ascii_lowercase(),
            auth_public_callback_url: env::var("AUTH_PUBLIC_CALLBACK_URL")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty()),
            dashboard_internal_api_base: env_or(
                "DASHBOARD_INTERNAL_API_BASE",
                "http://127.0.0.1:8766",
            ),
            master_broker_base: env_or("MASTER_BROKER_BASE", "http://127.0.0.1:8770"),
            master_broker_token: first_env(&[
                "MASTER_BROKER_TOKEN",
                "MAIN_BOT_INTERNAL_TOKEN",
                "TWITCH_INTERNAL_API_TOKEN",
            ]),
            scrim_guild_id: env::var("SCRIM_GUILD_ID")
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .unwrap_or(1_289_721_245_281_292_288),
            scrim_reserve_role_id: env::var("SCRIM_RESERVE_ROLE_ID")
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .filter(|v| *v > 0),
            auth_session_secret: first_env(&[
                "AUTH_SESSION_SECRET",
                "JWT_SECRET",
                "SESSIONS_ENCRYPTION_KEY",
            ]),
            discord_api_base: env_or("DISCORD_API_BASE", "https://discord.com/api/v10"),
            discord_oauth_authorize_base: first_env(&[
                "DISCORD_OAUTH_AUTHORIZE_BASE",
                "DISCORD_AUTHORIZE_BASE",
            ])
            .unwrap_or_else(|| "https://discord.com/oauth2/authorize".to_string()),
            discord_oauth_client_id: first_env(&["DISCORD_OAUTH_CLIENT_ID", "DISCORD_CLIENT_ID"]),
            discord_oauth_client_secret: first_env(&[
                "DISCORD_OAUTH_CLIENT_SECRET",
                "DISCORD_CLIENT_SECRET",
            ]),
            discord_application_id: first_env(&[
                "DISCORD_APPLICATION_ID",
                "DISCORD_OAUTH_CLIENT_ID",
                "DISCORD_CLIENT_ID",
            ]),
            discord_bot_token: first_env(&[
                "DISCORD_ROLE_CONNECTION_BOT_TOKEN",
                "DISCORD_BOT_TOKEN",
                "DISCORD_TOKEN",
                "BOT_TOKEN",
            ]),
            discord_role_connection_callback_url: env::var("DISCORD_ROLE_CONNECTION_CALLBACK_URL")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty()),
            discord_role_connection_cookie_name: env_or(
                "DISCORD_ROLE_CONNECTION_STATE_COOKIE_NAME",
                "ddc_role_connection_state",
            ),
            discord_role_connection_sync_worker_enabled: env::var(
                "DISCORD_ROLE_CONNECTION_SYNC_WORKER_ENABLED",
            )
            .ok()
            .as_deref()
            .map(|v| is_truthy(v, true))
            .unwrap_or(true),
            discord_role_connection_sync_interval_seconds: env::var(
                "DISCORD_ROLE_CONNECTION_SYNC_INTERVAL_SECONDS",
            )
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .filter(|v| *v > 0)
            .unwrap_or(30),
            db_master_key_v1: first_env(&["DB_MASTER_KEY_V1"]),
        }
    }
}

pub fn first_env(names: &[&str]) -> Option<String> {
    for name in names {
        if let Ok(value) = env::var(name) {
            let value = value.trim().to_string();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn env_or(name: &str, fallback: &str) -> String {
    env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn normalized_domain(value: String) -> String {
    value.trim().trim_start_matches('.').to_ascii_lowercase()
}

fn is_truthy(value: &str, default: bool) -> bool {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        _ => default,
    }
}
