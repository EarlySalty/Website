use std::{env, net::IpAddr};

use anyhow::{bail, Context};
use url::Url;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScrimBackendMode {
    Legacy,
    Proxy,
    Maintenance,
}

impl ScrimBackendMode {
    pub(crate) fn from_env_value(value: Option<String>) -> anyhow::Result<Self> {
        match value
            .as_deref()
            .unwrap_or("legacy")
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "" | "legacy" => Ok(Self::Legacy),
            "proxy" => Ok(Self::Proxy),
            "maintenance" => Ok(Self::Maintenance),
            value => bail!("unknown SCRIM_BACKEND_MODE: {value}"),
        }
    }
}

/// Eine Discord-Application, die als Linked-Role-Provider auftritt.
///
/// Es gibt zwei davon: die Steam-App (Steam-Verknuepfung und Deadlock-Rang) und
/// die Creator-App (Twitch-Autorisierung im Creator-Programm). Beide haben
/// eigene Client-Credentials, ein eigenes Bot-Token und einen eigenen Callback.
#[derive(Clone, Debug, Default)]
pub struct DiscordLinkedRoleApp {
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub application_id: Option<String>,
    pub bot_token: Option<String>,
    pub callback_url: Option<String>,
}

impl DiscordLinkedRoleApp {
    /// Reicht fuer den OAuth-Flow: Login, Callback, Token-Tausch.
    pub fn is_configured(&self) -> bool {
        self.client_id.is_some() && self.client_secret.is_some() && self.application_id.is_some()
    }

    /// Reicht zusaetzlich fuer die Metadata-Registrierung — die laeuft mit dem
    /// Bot-Token der App. Ohne diese Unterscheidung meldet der Sammel-Endpunkt
    /// eine App ohne Bot-Token als "konfiguriert" und scheitert dann mit 503,
    /// obwohl schlicht ein Wert fehlt.
    pub fn can_register_metadata(&self) -> bool {
        self.is_configured() && self.bot_token.is_some()
    }
}

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
    pub scrim_signup_role_id: Option<i64>,
    pub scrim_reserve_role_id: Option<i64>,
    pub ddl_creator_role_id: Option<u64>,
    pub youtube_api_key: Option<String>,
    pub auth_session_secret: Option<String>,
    pub discord_api_base: String,
    pub discord_oauth_authorize_base: String,
    /// Bot-Token des Hauptbots — von der Video-Ingest-Pipeline genutzt.
    pub discord_bot_token: Option<String>,
    pub discord_steam_app: DiscordLinkedRoleApp,
    pub discord_creator_app: DiscordLinkedRoleApp,
    pub linked_role_steam_link_url: String,
    pub linked_role_twitch_auth_url: String,
    pub linked_role_creator_info_url: String,
    pub twitch_analytics_dsn: Option<String>,
    pub discord_role_connection_cookie_name: String,
    pub discord_role_connection_sync_worker_enabled: bool,
    pub discord_role_connection_sync_interval_seconds: u64,
    /// Abstand, in dem der Worker die aktiven Creator-Tokens von selbst zum
    /// Abgleich einstellt. Fuer Creator gibt es keinen DB-Trigger, weil die
    /// Quelldaten in der Twitch-Datenbank liegen.
    pub discord_role_connection_creator_reconcile_seconds: u64,
    pub db_master_key_v1: Option<String>,
    pub scrim_backend_mode: ScrimBackendMode,
    pub scrim_turnier_base: String,
    pub scrim_turnier_token: Option<String>,
    pub scrim_ai_base: String,
    pub scrim_ai_token: Option<String>,
    pub scrim_upstream_timeout_ms: u64,
}

impl Config {
    #[cfg(test)]
    pub fn from_env() -> Self {
        Self::try_from_env().expect("valid environment configuration")
    }

    pub fn try_from_env() -> anyhow::Result<Self> {
        let scrim_backend_mode =
            ScrimBackendMode::from_env_value(env::var("SCRIM_BACKEND_MODE").ok())?;
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
            scrim_signup_role_id: env::var("SCRIM_SIGNUP_ROLE_ID")
                .map_or(Some(1_520_849_762_851_618_817), |v| {
                    v.trim().parse().ok().filter(|v| *v > 0)
                }),
            scrim_reserve_role_id: env::var("SCRIM_RESERVE_ROLE_ID")
                .map_or(Some(1_523_803_562_306_703_430), |v| {
                    v.trim().parse().ok().filter(|v| *v > 0)
                }),
            ddl_creator_role_id: env::var("DDL_CREATOR_ROLE_ID")
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .filter(|v| *v > 0),
            youtube_api_key: env::var("YOUTUBE_API_KEY")
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty()),
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
            discord_bot_token: first_env(&[
                "DISCORD_ROLE_CONNECTION_BOT_TOKEN",
                "DISCORD_BOT_TOKEN",
                "DISCORD_TOKEN",
                "BOT_TOKEN",
            ]),
            discord_steam_app: steam_app_from_env(),
            // Creator-App: bewusst ohne Fallback. Fehlen die Werte, meldet der
            // Provider "nicht konfiguriert" statt versehentlich die Steam-App zu
            // benutzen.
            discord_creator_app: DiscordLinkedRoleApp {
                client_id: first_env(&["DISCORD_CREATOR_CLIENT_ID", "DISCORD_CREATOR_APP_ID"]),
                client_secret: first_env(&["DISCORD_CREATOR_CLIENT_SECRET"]),
                application_id: first_env(&["DISCORD_CREATOR_APP_ID", "DISCORD_CREATOR_CLIENT_ID"]),
                bot_token: first_env(&["DISCORD_CREATOR_BOT_TOKEN"]),
                callback_url: first_env(&["DISCORD_CREATOR_CALLBACK_URL"]),
            },
            linked_role_steam_link_url: env_or(
                "LINKED_ROLE_STEAM_LINK_URL",
                "https://discord.com/channels/1289721245281292288/1398021105339334666",
            ),
            linked_role_twitch_auth_url: env_or(
                "LINKED_ROLE_TWITCH_AUTH_URL",
                "https://deutsche-deadlock-community.de/twitch/raid/auth",
            ),
            // Wer im Creator-Programm noch gar nicht auftaucht, kann den
            // Partner-Flow des Twitch-Bots nicht betreten: dessen Login-Gate
            // laesst nur eingetragene Partner durch und schickt alle anderen
            // im Kreis. Deshalb geht dieser Fall auf die Streamer-Seite, die
            // den Weg ins Programm erklaert.
            linked_role_creator_info_url: env_or(
                "LINKED_ROLE_CREATOR_INFO_URL",
                "https://deutsche-deadlock-community.de/streamer",
            ),
            twitch_analytics_dsn: first_env(&["TWITCH_ANALYTICS_DSN"]),
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
            discord_role_connection_creator_reconcile_seconds: env::var(
                "DISCORD_ROLE_CONNECTION_CREATOR_RECONCILE_SECONDS",
            )
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .filter(|v| *v > 0)
            .unwrap_or(3600),
            db_master_key_v1: first_env(&["DB_MASTER_KEY_V1"]),
            scrim_backend_mode,
            scrim_turnier_base: env_or("TURNIER_INTERNAL_API_BASE_URL", "http://127.0.0.1:8900"),
            scrim_turnier_token: first_env(&["TURNIER_INTERNAL_API_TOKEN"]),
            scrim_ai_base: env_or(
                "DL_SCRIM_LAGEBILD_INTERNAL_BASE_URL",
                "http://127.0.0.1:8770",
            ),
            scrim_ai_token: first_env(&["TURNIER_INTERNAL_API_TOKEN"]),
            scrim_upstream_timeout_ms: env::var("SCRIM_UPSTREAM_TIMEOUT_MS")
                .ok()
                .and_then(|v| v.trim().parse().ok())
                .filter(|v| *v > 0)
                .unwrap_or(3_000),
        }
        .tap_validate()
    }

    fn tap_validate(self) -> anyhow::Result<Self> {
        self.validate_startup()?;
        Ok(self)
    }

    pub fn validate_startup(&self) -> anyhow::Result<()> {
        if self.scrim_backend_mode == ScrimBackendMode::Proxy {
            self.validate_scrim_proxy()?;
        }
        Ok(())
    }

    pub fn validate_scrim_proxy(&self) -> anyhow::Result<()> {
        validate_loopback_http_origin("TURNIER_INTERNAL_API_BASE_URL", &self.scrim_turnier_base)?;
        validate_loopback_http_origin("DL_SCRIM_LAGEBILD_INTERNAL_BASE_URL", &self.scrim_ai_base)?;
        require_token(
            "TURNIER_INTERNAL_API_TOKEN",
            self.scrim_turnier_token.as_deref(),
        )?;
        require_token("TURNIER_INTERNAL_API_TOKEN", self.scrim_ai_token.as_deref())?;
        Ok(())
    }

    pub fn scrim_substitute_sweep_interval_seconds(&self) -> u64 {
        env::var("SCRIM_SUBSTITUTE_SWEEP_INTERVAL_SECONDS")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .filter(|v| *v > 0)
            .unwrap_or(600)
    }

    pub fn scrim_announce_channel_id(&self) -> u64 {
        env::var("SCRIM_ANNOUNCE_CHANNEL_ID")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .filter(|v| *v > 0)
            .unwrap_or(1_520_842_755_037_855_975)
    }
}

fn validate_loopback_http_origin(name: &str, value: &str) -> anyhow::Result<()> {
    let url = Url::parse(value).with_context(|| format!("{name} is not a valid URL"))?;
    if url.scheme() != "http" {
        bail!("{name} must use http for loopback-only internal traffic");
    }
    if !url.username().is_empty() || url.password().is_some() {
        bail!("{name} must not include credentials");
    }
    if url.query().is_some() || url.fragment().is_some() || !matches!(url.path(), "" | "/") {
        bail!("{name} must be an origin without path, query, or fragment");
    }
    let host = url
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("{name} must include a host"))?;
    if host.eq_ignore_ascii_case("localhost") {
        return Ok(());
    }
    let ip: IpAddr = host
        .parse()
        .with_context(|| format!("{name} host must be localhost or a loopback IP"))?;
    if !ip.is_loopback() {
        bail!("{name} host must be loopback");
    }
    Ok(())
}

fn require_token(name: &str, value: Option<&str>) -> anyhow::Result<()> {
    if value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        bail!("{name} is required in SCRIM_BACKEND_MODE=proxy");
    }
    Ok(())
}

/// Zugangsdaten der Steam-Application: entweder ganz aus den eigenen
/// `DISCORD_STEAM_*`-Variablen oder ganz aus der alten Master-Application.
///
/// Keine Mischung pro Feld. Wer beim Anlegen der dedizierten App nur die
/// Application-ID hinterlegt, bekaeme sonst die Client-ID der neuen App mit dem
/// Secret der alten: jeder Token-Tausch scheitert dann mit `invalid_client`, und
/// die bereits live laufende Steam-Verknuepfung ist tot. Lieber laut unvollstaendig
/// ("nicht konfiguriert") als leise falsch.
fn steam_app_from_env() -> DiscordLinkedRoleApp {
    steam_app_with(first_env)
}

fn steam_app_with(lookup: impl Fn(&[&str]) -> Option<String>) -> DiscordLinkedRoleApp {
    const OWN: [&str; 5] = [
        "DISCORD_STEAM_CLIENT_ID",
        "DISCORD_STEAM_APP_ID",
        "DISCORD_STEAM_CLIENT_SECRET",
        "DISCORD_STEAM_BOT_TOKEN",
        "DISCORD_STEAM_CALLBACK_URL",
    ];
    if OWN.iter().any(|name| lookup(&[name]).is_some()) {
        return DiscordLinkedRoleApp {
            client_id: lookup(&["DISCORD_STEAM_CLIENT_ID", "DISCORD_STEAM_APP_ID"]),
            client_secret: lookup(&["DISCORD_STEAM_CLIENT_SECRET"]),
            application_id: lookup(&["DISCORD_STEAM_APP_ID", "DISCORD_STEAM_CLIENT_ID"]),
            bot_token: lookup(&["DISCORD_STEAM_BOT_TOKEN"]),
            callback_url: lookup(&["DISCORD_STEAM_CALLBACK_URL"]),
        };
    }
    // Solange keine eigene App hinterlegt ist, laeuft der Steam-Provider
    // unveraendert auf der alten Application weiter.
    DiscordLinkedRoleApp {
        client_id: lookup(&["DISCORD_OAUTH_CLIENT_ID", "DISCORD_CLIENT_ID"]),
        client_secret: lookup(&["DISCORD_OAUTH_CLIENT_SECRET", "DISCORD_CLIENT_SECRET"]),
        application_id: lookup(&[
            "DISCORD_APPLICATION_ID",
            "DISCORD_OAUTH_CLIENT_ID",
            "DISCORD_CLIENT_ID",
        ]),
        bot_token: lookup(&[
            "DISCORD_ROLE_CONNECTION_BOT_TOKEN",
            "DISCORD_BOT_TOKEN",
            "DISCORD_TOKEN",
            "BOT_TOKEN",
        ]),
        callback_url: lookup(&["DISCORD_ROLE_CONNECTION_CALLBACK_URL"]),
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

#[cfg(test)]
mod tests {
    use super::{steam_app_with, Config, ScrimBackendMode};
    use serial_test::serial;

    /// Nachschlag aus einer festen Tabelle statt aus der Prozess-Umgebung — die
    /// Tests laufen parallel, und `set_var` waere ein Rennen mit allen anderen.
    fn lookup_from<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&[&str]) -> Option<String> + 'a {
        move |names: &[&str]| {
            names.iter().find_map(|name| {
                pairs
                    .iter()
                    .find(|(key, _)| key == name)
                    .map(|(_, value)| (*value).to_string())
            })
        }
    }

    #[test]
    fn steam_app_mischt_die_eigene_app_nie_mit_der_master_app() {
        // Der gefaehrliche Zwischenzustand: die eigene Application ist angelegt,
        // aber noch nicht vollstaendig hinterlegt. Wuerde das Secret dabei aus der
        // Master-App kommen, waere die Kombination Client-ID neu + Secret alt —
        // jeder Token-Tausch scheitert mit invalid_client, und die live laufende
        // Steam-Verknuepfung ist tot. Also lieber unvollstaendig.
        let halb = steam_app_with(lookup_from(&[
            ("DISCORD_STEAM_APP_ID", "neu-1"),
            ("DISCORD_OAUTH_CLIENT_ID", "alt-1"),
            ("DISCORD_OAUTH_CLIENT_SECRET", "alt-secret"),
            ("DISCORD_TOKEN", "alt-bot"),
        ]));
        assert_eq!(halb.client_id.as_deref(), Some("neu-1"));
        assert_eq!(
            halb.client_secret, None,
            "das Secret der Master-App darf nicht zur neuen Client-ID gemischt werden"
        );
        assert!(
            !halb.is_configured(),
            "unvollstaendig muss unvollstaendig bleiben"
        );

        // Ohne jede eigene Variable bleibt der live laufende Steam-Flow auf der
        // alten Application.
        let master = steam_app_with(lookup_from(&[
            ("DISCORD_OAUTH_CLIENT_ID", "alt-1"),
            ("DISCORD_OAUTH_CLIENT_SECRET", "alt-secret"),
            ("DISCORD_TOKEN", "alt-bot"),
        ]));
        assert_eq!(master.client_id.as_deref(), Some("alt-1"));
        assert_eq!(master.client_secret.as_deref(), Some("alt-secret"));
        assert_eq!(master.bot_token.as_deref(), Some("alt-bot"));
        assert!(master.can_register_metadata());

        // Vollstaendig eigene App: kein Wert kommt mehr von der Master-App.
        let eigen = steam_app_with(lookup_from(&[
            ("DISCORD_STEAM_CLIENT_ID", "neu-1"),
            ("DISCORD_STEAM_APP_ID", "neu-1"),
            ("DISCORD_STEAM_CLIENT_SECRET", "neu-secret"),
            ("DISCORD_STEAM_BOT_TOKEN", "neu-bot"),
            ("DISCORD_OAUTH_CLIENT_SECRET", "alt-secret"),
            ("DISCORD_TOKEN", "alt-bot"),
        ]));
        assert_eq!(eigen.client_secret.as_deref(), Some("neu-secret"));
        assert_eq!(eigen.bot_token.as_deref(), Some("neu-bot"));
        assert!(eigen.can_register_metadata());
    }

    #[test]
    fn scrim_backend_mode_defaults_to_legacy_when_unset_or_empty() {
        assert_eq!(
            ScrimBackendMode::from_env_value(None).expect("unset mode"),
            ScrimBackendMode::Legacy
        );
        assert_eq!(
            ScrimBackendMode::from_env_value(Some("  ".into())).expect("empty mode"),
            ScrimBackendMode::Legacy
        );
    }

    #[test]
    #[serial]
    fn lagebild_token_uses_turnier_internal_api_token() {
        let previous_mode = std::env::var_os("SCRIM_BACKEND_MODE");
        let previous_token = std::env::var_os("TURNIER_INTERNAL_API_TOKEN");
        std::env::set_var("SCRIM_BACKEND_MODE", "legacy");
        std::env::set_var("TURNIER_INTERNAL_API_TOKEN", "shared-test-token");

        let config = Config::try_from_env();

        match previous_mode {
            Some(value) => std::env::set_var("SCRIM_BACKEND_MODE", value),
            None => std::env::remove_var("SCRIM_BACKEND_MODE"),
        }
        match previous_token {
            Some(value) => std::env::set_var("TURNIER_INTERNAL_API_TOKEN", value),
            None => std::env::remove_var("TURNIER_INTERNAL_API_TOKEN"),
        }

        let config = config.expect("valid legacy configuration");
        assert!(config.scrim_ai_token.as_deref() == Some("shared-test-token"));
    }
}
