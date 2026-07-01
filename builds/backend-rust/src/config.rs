use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub db_path: String,
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
    pub auth_session_secret: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env_or("WEBSITE_BACKEND_HOST", "127.0.0.1"),
            port: env::var("WEBSITE_BACKEND_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8772),
            db_path: env_or("DB_PATH", "./deadlock.db"),
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
            auth_session_secret: first_env(&[
                "AUTH_SESSION_SECRET",
                "JWT_SECRET",
                "SESSIONS_ENCRYPTION_KEY",
            ]),
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
