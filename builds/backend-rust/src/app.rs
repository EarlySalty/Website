use std::sync::Arc;

use anyhow::Context;

use axum::{
    http::{header, Method},
    routing::{delete, get, patch, post, put},
    Router,
};
use reqwest::Client;
use sqlx::PgPool;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::{
    auth::Auth,
    config::{Config, ScrimBackendMode},
    db,
    discord_broker::{DynDiscordRoleBroker, ReqwestDiscordRoleBroker},
    discord_role_connection::{DynDiscordRoleConnectionClient, ReqwestDiscordRoleConnectionClient},
    routes,
};

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppInner>,
}

pub struct AppInner {
    pub cfg: Config,
    pub pool: PgPool,
    pub http: Client,
    pub scrim_http: Client,
    pub discord_role_broker: DynDiscordRoleBroker,
    pub discord_role_connections: DynDiscordRoleConnectionClient,
    /// Pool auf die Twitch-Datenbank, per `default_transaction_read_only` auf
    /// Lesen festgelegt. Quelle fuer das Creator-Linked-Role-Profil; ohne
    /// `TWITCH_ANALYTICS_DSN` bleibt er leer und der Creator-Provider meldet
    /// "nicht abrufbar".
    pub twitch_pool: Option<PgPool>,
    pub auth: Auth,
}

impl AppState {
    pub async fn new(cfg: Config) -> anyhow::Result<Self> {
        cfg.validate_startup()?;
        let pool = db::connect().await?;
        db::init(&pool).await?;
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()?;
        let scrim_http = scrim_http_client(&cfg)?;
        let discord_role_broker = Arc::new(ReqwestDiscordRoleBroker::from_config(&cfg)?);
        let discord_role_connections =
            Arc::new(ReqwestDiscordRoleConnectionClient::from_config(&cfg)?);
        ensure_role_connection_schema(&pool).await?;
        let twitch_pool = connect_twitch_pool(&cfg);
        let auth = Auth::new(cfg.clone());
        let state = Self {
            inner: Arc::new(AppInner {
                cfg,
                pool,
                http,
                scrim_http,
                discord_role_broker,
                discord_role_connections,
                twitch_pool,
                auth,
            }),
        };
        // Nicht awaiten: der Pool ist lazy, eine nicht erreichbare Twitch-DB
        // kostet hier bis zu acquire_timeout, und der Steam-Provider soll darauf
        // nicht warten. Die Meldung kommt Sekunden nach dem Start ins Journal.
        {
            let state = state.clone();
            tokio::spawn(async move { report_creator_source_health(&state).await });
        }
        crate::discord_role_connection::spawn_sync_worker(state.clone());
        if state.cfg.scrim_backend_mode == ScrimBackendMode::Legacy {
            crate::routes::scrim::spawn_substitute_sweep_worker(state.clone());
        }
        crate::video::spawn_ingest_worker(state.clone());
        Ok(state)
    }

    #[cfg(test)]
    pub(crate) fn for_test_pool_with_broker(
        pool: PgPool,
        cfg: Config,
        discord_role_broker: DynDiscordRoleBroker,
    ) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("test http client");
        let scrim_http = scrim_http_client(&cfg).expect("test scrim http client");
        let auth = Auth::new(cfg.clone());
        let discord_role_connections =
            Arc::new(ReqwestDiscordRoleConnectionClient::from_config(&cfg).expect("role client"));
        Self {
            inner: Arc::new(AppInner {
                cfg,
                pool,
                http,
                scrim_http,
                discord_role_broker,
                discord_role_connections,
                twitch_pool: None,
                auth,
            }),
        }
    }

    #[cfg(test)]
    pub(crate) fn for_test_pool_with_clients(
        pool: PgPool,
        cfg: Config,
        discord_role_broker: DynDiscordRoleBroker,
        discord_role_connections: DynDiscordRoleConnectionClient,
    ) -> Self {
        Self::for_test_pool_with_clients_and_twitch(
            pool,
            cfg,
            discord_role_broker,
            discord_role_connections,
            None,
        )
    }

    #[cfg(test)]
    pub(crate) fn for_test_pool_with_clients_and_twitch(
        pool: PgPool,
        cfg: Config,
        discord_role_broker: DynDiscordRoleBroker,
        discord_role_connections: DynDiscordRoleConnectionClient,
        twitch_pool: Option<PgPool>,
    ) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("test http client");
        let scrim_http = scrim_http_client(&cfg).expect("test scrim http client");
        let auth = Auth::new(cfg.clone());
        Self {
            inner: Arc::new(AppInner {
                cfg,
                pool,
                http,
                scrim_http,
                discord_role_broker,
                discord_role_connections,
                twitch_pool,
                auth,
            }),
        }
    }
}

impl std::ops::Deref for AppState {
    type Target = AppInner;

    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/videos", get(crate::video::public_feed))
        .route("/api/videos/taxonomy", get(crate::video::list_taxonomy))
        .route(
            "/api/videos/channels",
            get(crate::video::own_channels).post(crate::video::register_channel),
        )
        .route(
            "/api/videos/channels/{id}",
            delete(crate::video::detach_own_channel),
        )
        .route("/api/videos/mine", get(crate::video::own_videos))
        .route(
            "/api/videos/{id}/approve",
            post(crate::video::approve_video),
        )
        .route("/api/videos/{id}/hide", post(crate::video::hide_video))
        .route("/api/videos/{id}/tags", put(crate::video::tag_video))
        .route(
            "/api/videos/playlists",
            get(crate::video::list_playlists).post(crate::video::create_playlist),
        )
        .route(
            "/api/videos/playlists/{id}",
            get(crate::video::playlist_detail)
                .put(crate::video::update_playlist)
                .delete(crate::video::delete_playlist),
        )
        .route(
            "/api/videos/creators/{id}",
            get(crate::video::creator_profile),
        )
        .route(
            "/api/admin/videos/channels/{id}",
            delete(crate::video::detach_channel),
        )
        .route(
            "/api/admin/videos/taxonomy",
            post(crate::video::create_taxonomy),
        )
        .route(
            "/api/admin/videos/taxonomy/{id}",
            put(crate::video::update_taxonomy).delete(crate::video::delete_taxonomy),
        )
        .route("/api/health", get(routes::health))
        .route(
            "/api/public/patch-timeline",
            get(routes::public::patch_timeline),
        )
        .route("/api/public/patch-notes", get(routes::public::patch_notes))
        .route("/api/auth/discord/login", get(routes::auth::discord_login))
        .route(
            "/api/auth/discord/callback",
            get(routes::auth::discord_callback),
        )
        .route(
            "/linked-role/{provider}",
            get(routes::linked_role::linked_role_login_for),
        )
        .route(
            "/auth/discord/{provider}/callback",
            get(routes::linked_role::linked_role_callback_for),
        )
        // Die Master-Application zeigt im Dev-Portal auf diese beiden Adressen.
        .route(
            "/api/auth/discord/linked-role/login",
            get(routes::linked_role::legacy_steam_login),
        )
        .route(
            "/api/auth/discord/linked-role/callback",
            get(routes::linked_role::legacy_steam_callback),
        )
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/auth/logout", post(routes::auth::logout))
        .route(
            "/api/heroes",
            get(routes::meta::list_heroes).post(routes::meta::create_hero),
        )
        .route(
            "/api/heroes/{hero_id}",
            get(routes::meta::get_hero)
                .put(routes::meta::update_hero)
                .delete(routes::meta::delete_hero),
        )
        .route(
            "/api/builds",
            get(routes::meta::list_builds).post(routes::meta::create_build),
        )
        .route(
            "/api/builds/{build_id}",
            get(routes::meta::get_build)
                .put(routes::meta::update_build)
                .delete(routes::meta::delete_build),
        )
        .route(
            "/api/builds/{build_id}/vote",
            post(routes::meta::vote_build),
        )
        .route(
            "/api/builds/{build_id}/report",
            post(routes::meta::report_build),
        )
        .route("/api/items", get(routes::meta::list_items))
        .route("/api/items/{item_id}", get(routes::meta::get_item))
        .route(
            "/api/tierlists",
            get(routes::meta::list_tierlists).post(routes::meta::create_tierlist),
        )
        .route("/api/tierlists/my", get(routes::meta::my_tierlists))
        .route(
            "/api/tierlists/{list_id}",
            get(routes::meta::get_tierlist)
                .put(routes::meta::update_tierlist)
                .delete(routes::meta::delete_tierlist),
        )
        .route(
            "/api/tierlists/{list_id}/fork",
            post(routes::meta::fork_tierlist),
        )
        .route(
            "/api/patchnotes",
            get(routes::meta::list_patchnotes).post(routes::meta::create_patchnote),
        )
        .route(
            "/api/patchnotes/{note_id}",
            delete(routes::meta::delete_patchnote),
        )
        .route("/api/history", get(routes::meta::list_history))
        .route("/api/admin/reports", get(routes::meta::list_reports))
        .route(
            "/api/admin/reports/{report_id}",
            put(routes::meta::update_report),
        )
        .route("/api/admin/votes", get(routes::meta::list_votes))
        .route(
            "/api/admin/votes/{vote_id}",
            delete(routes::meta::delete_vote),
        )
        .route(
            "/api/admin/announcement",
            post(routes::meta::set_announcement),
        )
        .route(
            "/api/admin/announcement/{ann_id}",
            delete(routes::meta::delete_announcement),
        )
        .route("/api/admin/users", get(routes::meta::list_users))
        .route(
            "/api/admin/users/{user_id}/role",
            put(routes::meta::update_user_role),
        )
        .route(
            "/api/admin/discord-role-connections/metadata/{provider}",
            post(routes::linked_role::register_metadata_for),
        )
        .route(
            "/api/admin/discord-role-connections/metadata",
            post(routes::linked_role::register_metadata),
        )
        .route(
            "/api/internal/discord-role-connections/sync",
            post(routes::linked_role::sync_user),
        )
        .route("/api/coaching/coaches", get(routes::coaching::list_coaches))
        .route(
            "/api/coaching/coaches/profile",
            post(routes::coaching::create_or_update_coach_profile),
        )
        .route(
            "/api/coaching/coaches/apply",
            post(routes::coaching::apply_to_be_coach),
        )
        .route(
            "/api/coaching/coaches/{coach_id}",
            get(routes::coaching::get_coach),
        )
        .route(
            "/api/coaching/coaches/{coach_id}/reviews",
            get(routes::coaching::get_coach_reviews),
        )
        .route(
            "/api/coaching/requests",
            get(routes::coaching::list_coaching_requests)
                .post(routes::coaching::create_coaching_request),
        )
        .route(
            "/api/coaching/requests/{request_id}/match",
            patch(routes::coaching::match_coach_to_request),
        )
        .route(
            "/api/coaching/surveys",
            post(routes::coaching::submit_survey),
        )
        .route(
            "/api/coaching/dashboard",
            get(routes::coaching::get_coach_dashboard),
        )
        .route(
            "/api/coaching/sessions/{session_id}/end",
            post(routes::coaching::end_session),
        )
        .route(
            "/api/coaching/admin/applications/{application_id}",
            patch(routes::coaching::review_application),
        )
        .route(
            "/api/coaching/platform/sync",
            post(routes::platform::platform_sync),
        )
        .route(
            "/api/coaching/platform/overview",
            get(routes::platform::platform_overview),
        )
        .route(
            "/api/coaching/platform/queue",
            get(routes::platform::platform_queue),
        )
        .route(
            "/api/coaching/platform/coachees",
            get(routes::platform::list_coachees),
        )
        .route(
            "/api/coaching/platform/coachees/{coachee_id}",
            get(routes::platform::get_coachee).patch(routes::platform::update_coachee),
        )
        .route(
            "/api/coaching/platform/coachees/{coachee_id}/goals",
            post(routes::platform::create_goal),
        )
        .route(
            "/api/coaching/platform/goals/{goal_id}",
            patch(routes::platform::update_goal).delete(routes::platform::delete_goal),
        )
        .route(
            "/api/coaching/platform/goals/{goal_id}/milestones",
            post(routes::platform::create_milestone),
        )
        .route(
            "/api/coaching/platform/milestones/{milestone_id}",
            patch(routes::platform::update_milestone).delete(routes::platform::delete_milestone),
        )
        .route(
            "/api/coaching/platform/coachees/{coachee_id}/notes",
            post(routes::platform::create_note),
        )
        .route(
            "/api/coaching/platform/notes/{note_id}",
            patch(routes::platform::update_note).delete(routes::platform::delete_note),
        )
        .route(
            "/api/coaching/platform/me",
            get(routes::platform::my_coaching),
        )
        .route(
            "/api/coaching/platform/coaches/sync",
            post(routes::platform::coaches_sync),
        )
        .route(
            "/api/coaching/platform/appointments",
            get(routes::platform::list_appointments).post(routes::platform::create_appointment),
        )
        .route(
            "/api/coaching/platform/appointments/{appointment_id}",
            patch(routes::platform::update_appointment),
        )
        .route(
            "/api/coaching/platform/notifications/due",
            get(routes::platform::notifications_due),
        )
        .route(
            "/api/coaching/platform/notifications/ack",
            post(routes::platform::notifications_ack),
        )
        .route(
            "/api/coaching/platform/coaches/me",
            get(routes::platform::get_my_coach_profile)
                .patch(routes::platform::update_my_coach_profile),
        )
        .merge(scrim_router(state.cfg.scrim_backend_mode))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            routes::scrim_proxy::scrim_browser_security_middleware,
        ))
        .layer(cors_layer(&state.cfg))
        .with_state(state)
}

fn scrim_router(mode: ScrimBackendMode) -> Router<AppState> {
    match mode {
        ScrimBackendMode::Legacy => legacy_scrim_router(),
        ScrimBackendMode::Proxy | ScrimBackendMode::Maintenance => routes::scrim_proxy::router(),
    }
}

/// Legt den nur-lesenden Twitch-Pool fuer das Creator-Linked-Role-Profil an.
///
/// Lazy, damit eine beim Start kurz nicht erreichbare Twitch-Datenbank nicht bis
/// zum naechsten Neustart als "nicht vorhanden" haengen bleibt. Jede Verbindung
/// setzt `default_transaction_read_only`; das faengt versehentliche Schreibzugriffe
/// ab, ist aber ein Session-Schalter und keine Rechtegrenze — die gaebe erst ein
/// eigener DB-User ohne Schreibrecht.
fn connect_twitch_pool(cfg: &Config) -> Option<PgPool> {
    let Some(dsn) = cfg.twitch_analytics_dsn.as_deref() else {
        // Ohne diese Meldung liesse sich die Creator-Haelfte deployen und taete
        // dauerhaft nichts: der Reconcile-Sweep gibt still 0 zurueck, und nur
        // vereinzelte Callback-Warnungen wuerden es verraten.
        if cfg.discord_creator_app.is_configured() {
            tracing::error!(
                "TWITCH_ANALYTICS_DSN fehlt, die Creator-Application ist aber konfiguriert — \
                 der Creator-Provider kann kein Profil lesen und bleibt wirkungslos."
            );
        } else {
            tracing::info!("TWITCH_ANALYTICS_DSN nicht gesetzt — Creator-Linked-Role ist inaktiv.");
        }
        return None;
    };
    match sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                // Statement-Timeout, weil dieser Pool waehrend einer offenen
                // zentralen Transaktion befragt wird: eine haengende Query wuerde
                // dort sonst unbegrenzt eine Verbindung mit gehaltener Lock binden.
                //
                // Zwei getrennte Statements, nicht eines mit Semikolon: sqlx::query
                // geht auch ohne Bindings durch das Extended-Protocol, und Postgres
                // lehnt zwei Befehle in einem Prepared Statement mit 42601 ab. Das
                // wuerde jede Verbindung dieses Pools scheitern lassen, also den
                // ganzen Creator-Provider.
                sqlx::query("SET default_transaction_read_only = on")
                    .execute(&mut *conn)
                    .await?;
                sqlx::query("SET statement_timeout = '5s'")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect_lazy(dsn)
    {
        Ok(pool) => Some(pool),
        Err(err) => {
            tracing::warn!(
                ?err,
                "Twitch-DSN fuer den Creator-Provider nicht verwendbar"
            );
            None
        }
    }
}

/// Meldet beim Start, wie viele Streamer-Identitaeten eine Discord-Verknuepfung
/// tragen. Eine leere Quelle ist der stille Totalausfall des Creator-Providers:
/// jeder Push schreibt "0", jeder Callback landet auf der Info-Seite, und nichts
/// davon sieht nach einem Fehler aus.
async fn report_creator_source_health(state: &AppState) {
    if !state.cfg.discord_creator_app.is_configured() || state.twitch_pool.is_none() {
        return;
    }
    match crate::discord_role_connection::creator_source_health(state).await {
        Ok(0) => tracing::error!(
            "Creator-Quelle leer: keine Zeile in twitch_streamer_identities hat eine \
             discord_user_id. Der Creator-Provider kann niemandem eine Rolle geben."
        ),
        Ok(count) => tracing::info!(verknuepfte_streamer = count, "Creator-Quelle erreichbar"),
        Err(err) => tracing::error!(?err, "Creator-Quelle nicht lesbar"),
    }
}

/// Prueft beim Start, ob Migration 2026081301 aus
/// `Deadlock-Bots/rust/crates/dl-central-db/migrations/` (anderes Repo)
/// vollstaendig eingespielt ist: Spalte `provider` **und** ein Unique-Index auf
/// `(discord_id, provider)` auf beiden Tabellen — genau das setzt jedes
/// `ON CONFLICT (discord_id, provider)` voraus.
///
/// Fehlt etwas davon, bricht der Start ab. Weiterlaufen hiesse: die bereits
/// live laufende Steam-Verknuepfung scheitert bei jedem Callback still, waehrend
/// der Dienst gesund aussieht. Ein Dienst, der nicht startet, ist im Deploy
/// sofort sichtbar — und der Weg zurueck ist genau ein Migrationslauf.
async fn ensure_role_connection_schema(pool: &PgPool) -> anyhow::Result<()> {
    for table in [
        "discord_role_connection_tokens",
        "discord_role_connection_sync_state",
    ] {
        let column: Option<i32> = sqlx::query_scalar(
            "SELECT 1 FROM information_schema.columns \
              WHERE table_schema='core' AND table_name=$1 AND column_name='provider'",
        )
        .bind(table)
        .fetch_optional(pool)
        .await
        .with_context(|| format!("Schema-Pruefung von core.{table} fehlgeschlagen"))?;
        if column.is_none() {
            anyhow::bail!(
                "core.{table}.provider fehlt — Migration 2026081301 aus dl-central-db ist \
                 nicht eingespielt. Erst `dl-central-migrate` laufen lassen, dann diesen \
                 Dienst starten."
            );
        }

        let unique: Option<i32> = sqlx::query_scalar(
            "SELECT 1 \
               FROM pg_constraint con \
               JOIN pg_class cls ON cls.oid = con.conrelid \
               JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace \
              WHERE nsp.nspname='core' AND cls.relname=$1 \
                AND con.contype IN ('p','u') \
                AND (SELECT array_agg(att.attname::text ORDER BY att.attname) \
                       FROM pg_attribute att \
                      WHERE att.attrelid = cls.oid \
                        AND att.attnum = ANY (con.conkey)) \
                    = ARRAY['discord_id','provider']",
        )
        .bind(table)
        .fetch_optional(pool)
        .await
        .with_context(|| format!("Schluessel-Pruefung von core.{table} fehlgeschlagen"))?;
        if unique.is_none() {
            anyhow::bail!(
                "core.{table} hat keinen Unique-Index auf (discord_id, provider) — Migration \
                 2026081301 ist nur halb eingespielt. Jedes ON CONFLICT (discord_id, provider) \
                 wuerde zur Laufzeit scheitern."
            );
        }
    }
    Ok(())
}

fn scrim_http_client(cfg: &Config) -> anyhow::Result<Client> {
    Ok(Client::builder()
        .timeout(std::time::Duration::from_millis(
            cfg.scrim_upstream_timeout_ms,
        ))
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()?)
}

fn cors_layer(cfg: &Config) -> CorsLayer {
    let cfg = cfg.clone();
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(move |origin, _parts| {
            origin
                .to_str()
                .ok()
                .is_some_and(|origin| origin_allowed(&cfg, origin))
        }))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(true)
}

fn origin_allowed(cfg: &Config, origin: &str) -> bool {
    let Ok(url) = url::Url::parse(origin) else {
        return false;
    };
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return false;
    }
    let Some(host) = url.host_str().map(|host| host.to_ascii_lowercase()) else {
        return false;
    };
    if matches!(host.as_str(), "localhost" | "127.0.0.1" | "::1") {
        return matches!(url.scheme(), "http" | "https");
    }
    if url.scheme() != "https" {
        return false;
    }
    let domain = cfg.ddc_cookie_domain.as_str();
    host == domain || host == format!("www.{domain}") || host == format!("admin.{domain}")
}

fn legacy_scrim_router() -> Router<AppState> {
    Router::new()
        .route("/api/scrim/me", get(routes::scrim::get_me))
        .route(
            "/api/scrim/me/availability",
            put(routes::scrim::put_my_availability),
        )
        .route("/api/scrim/signup", post(routes::scrim::signup))
        .route("/api/scrim/pool", get(routes::scrim::pool))
        .route("/api/scrim/coaches", get(routes::scrim::coaches))
        .route(
            "/api/scrim/teams",
            get(routes::scrim::teams).post(routes::scrim::create_team),
        )
        .route("/api/scrim/teams/{id}", patch(routes::scrim::patch_team))
        .route(
            "/api/scrim/teams/{id}/announce",
            post(routes::scrim::announce_team),
        )
        .route(
            "/api/scrim/teams/{id}/board",
            get(routes::scrim::team_board),
        )
        .route(
            "/api/scrim/teams/{id}/suggest",
            post(routes::scrim::suggest_roster),
        )
        .route(
            "/api/scrim/teams/{id}/substitute",
            post(routes::scrim::substitute),
        )
        .route(
            "/api/scrim/participants/{id}/resync-discord",
            post(routes::scrim::resync_participant_discord),
        )
        .route(
            "/api/scrim/participants/{id}",
            patch(routes::scrim::patch_participant),
        )
}

#[cfg(test)]
mod tests {
    use std::{
        net::{IpAddr, Ipv4Addr, SocketAddr},
        sync::{Arc, Mutex},
    };

    use axum::{
        body::{to_bytes, Body},
        extract::connect_info::ConnectInfo,
        http::{HeaderMap, HeaderValue, Method, Request, StatusCode, Uri},
        response::IntoResponse,
        routing::any,
    };
    use chrono::{TimeZone, Utc};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use super::*;
    use crate::{auth, config::ScrimBackendMode, rows};

    #[derive(Debug, Clone)]
    struct RecordedScrimUpstreamRequest {
        method: Method,
        path_and_query: String,
        internal_token: Option<String>,
        request_id: Option<String>,
        idempotency_key: Option<String>,
        actor_discord_id: Option<String>,
        actor_display_name: Option<String>,
        browser_actor_header: Option<String>,
        body: Value,
    }

    #[derive(Clone)]
    struct MockScrimRoute {
        method: Method,
        path: &'static str,
        status: StatusCode,
        response: Value,
        raw_response: Option<&'static str>,
        retry_after: Option<&'static str>,
        expected_body: Option<Value>,
        delay_ms: Option<u64>,
    }

    impl MockScrimRoute {
        fn new(method: Method, path: &'static str, status: StatusCode, response: Value) -> Self {
            Self {
                method,
                path,
                status,
                response,
                raw_response: None,
                retry_after: None,
                expected_body: None,
                delay_ms: None,
            }
        }

        fn expect_body(mut self, body: Value) -> Self {
            self.expected_body = Some(body);
            self
        }

        fn retry_after(mut self, value: &'static str) -> Self {
            self.retry_after = Some(value);
            self
        }

        fn raw_response(mut self, value: &'static str) -> Self {
            self.raw_response = Some(value);
            self
        }

        fn delay_ms(mut self, value: u64) -> Self {
            self.delay_ms = Some(value);
            self
        }
    }

    async fn spawn_scrim_upstream(
        status: StatusCode,
        response: Value,
    ) -> (String, Arc<Mutex<Vec<RecordedScrimUpstreamRequest>>>) {
        spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/command-center",
                status,
                response.clone(),
            ),
            MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-request-batches",
                status,
                response,
            ),
        ])
        .await
    }

    async fn spawn_scrim_upstream_routes(
        routes: Vec<MockScrimRoute>,
    ) -> (String, Arc<Mutex<Vec<RecordedScrimUpstreamRequest>>>) {
        let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("scrim upstream listener");
        let addr = listener.local_addr().expect("scrim upstream addr");
        let recorded = Arc::new(Mutex::new(Vec::new()));
        let mut app = Router::new();
        for route in routes {
            let recorded_for_route = Arc::clone(&recorded);
            let path = route.path;
            app = app.route(
                path,
                any(
                    move |method: Method, uri: Uri, headers: HeaderMap, body: Body| {
                        let route = route.clone();
                        let recorded = Arc::clone(&recorded_for_route);
                        async move {
                            if method != route.method {
                                return (StatusCode::METHOD_NOT_ALLOWED, axum::Json(json!({})))
                                    .into_response();
                            }
                            if let Some(delay_ms) = route.delay_ms {
                                tokio::time::sleep(std::time::Duration::from_millis(delay_ms))
                                    .await;
                            }
                            let bytes = to_bytes(body, usize::MAX).await.expect("upstream body");
                            let body = if bytes.is_empty() {
                                Value::Null
                            } else {
                                serde_json::from_slice(&bytes).expect("upstream json body")
                            };
                            if let Some(expected) = route.expected_body.as_ref() {
                                assert_eq!(&body, expected);
                            }
                            recorded.lock().expect("record upstream").push(
                                RecordedScrimUpstreamRequest {
                                    method,
                                    path_and_query: uri
                                        .path_and_query()
                                        .map(|value| value.as_str().to_string())
                                        .unwrap_or_else(|| uri.path().to_string()),
                                    internal_token: header_string(&headers, "X-Internal-Token"),
                                    request_id: header_string(&headers, "X-Request-Id"),
                                    idempotency_key: header_string(&headers, "Idempotency-Key"),
                                    actor_discord_id: header_string(&headers, "X-Actor-Discord-Id"),
                                    actor_display_name: header_string(
                                        &headers,
                                        "X-Actor-Display-Name",
                                    ),
                                    browser_actor_header: header_string(&headers, "X-DDC-Actor"),
                                    body,
                                },
                            );
                            let mut headers = HeaderMap::new();
                            if let Some(retry_after) = route.retry_after {
                                headers
                                    .insert("Retry-After", HeaderValue::from_static(retry_after));
                            }
                            if let Some(raw_response) = route.raw_response {
                                return (route.status, headers, raw_response.to_string())
                                    .into_response();
                            }
                            (route.status, headers, axum::Json(route.response)).into_response()
                        }
                    },
                ),
            );
        }
        tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("scrim upstream server");
        });
        (format!("http://{addr}"), recorded)
    }

    fn header_string(headers: &HeaderMap, name: &str) -> Option<String> {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
    }

    fn valid_planning_payload() -> Value {
        serde_json::from_str(include_str!(
            "../tests/fixtures/scrim-turnier-planning-create.json"
        ))
        .expect("planning fixture")
    }

    fn turnier_scrim_read_model() -> Value {
        json!({
            "participants": [
                {
                    "id": "201",
                    "discord_id": "111111111111111111",
                    "display_name": "Main Player",
                    "rank": "Oracle",
                    "rank_source": "self",
                    "rank_verified": false,
                    "roles": "Carry",
                    "availability": "Flexibel",
                    "availability_slots": null,
                    "notes": "Shotcaller",
                    "status": "assigned",
                    "source": "web_form",
                    "created_at": "2026-07-25T10:00:00Z",
                    "updated_at": "2026-07-25T10:00:00Z"
                },
                {
                    "id": "202",
                    "discord_id": null,
                    "display_name": "Confirmed Player",
                    "rank": null,
                    "rank_source": "self",
                    "rank_verified": false,
                    "roles": "Support",
                    "availability": null,
                    "availability_slots": {
                        "mon": { "status": "available", "from": 1140, "to": 1320 },
                        "tue": { "status": "unavailable", "from": null, "to": null }
                    },
                    "notes": null,
                    "status": "assigned",
                    "source": "web_form",
                    "created_at": "2026-07-25T10:01:00Z",
                    "updated_at": "2026-07-25T10:01:00Z"
                },
                {
                    "id": "203",
                    "discord_id": "333333333333333333",
                    "display_name": "Bench Player",
                    "rank": "Ritualist",
                    "rank_source": "self",
                    "rank_verified": false,
                    "roles": "Flex",
                    "availability": "Geht nicht",
                    "availability_slots": null,
                    "notes": "Bench only",
                    "status": "reserve",
                    "source": "web_form",
                    "created_at": "2026-07-25T10:02:00Z",
                    "updated_at": "2026-07-25T10:02:00Z"
                }
            ],
            "teams": [
                {
                    "id": "101",
                    "name": "Team Alpha",
                    "coach": "Coach A",
                    "coach_discord_id": "222222222222222222",
                    "discord_role_id": "444444444444444444",
                    "discord_channel_id": "555555555555555555",
                    "default_from": 1140,
                    "default_to": 1320,
                    "created_at": "2026-07-25T09:00:00Z",
                    "members": [
                        {
                            "team_id": "101",
                            "participant_id": "201",
                            "display_name": "Main Player",
                            "rank": "Oracle",
                            "discord_id": "111111111111111111",
                            "roles": "Carry",
                            "availability": "Flexibel",
                            "availability_slots": null,
                            "notes": "Shotcaller",
                            "role": "Captain",
                            "is_captain": true,
                            "is_bench": false,
                            "substitute_until": null
                        },
                        {
                            "team_id": "101",
                            "participant_id": "202",
                            "display_name": "Confirmed Player",
                            "rank": null,
                            "discord_id": null,
                            "roles": "Support",
                            "availability": null,
                            "availability_slots": {
                                "mon": { "status": "available", "from": 1140, "to": 1320 },
                                "tue": { "status": "unavailable", "from": null, "to": null }
                            },
                            "notes": null,
                            "role": null,
                            "is_captain": false,
                            "is_bench": false,
                            "substitute_until": null
                        },
                        {
                            "team_id": "101",
                            "participant_id": "203",
                            "display_name": "Bench Player",
                            "rank": "Ritualist",
                            "discord_id": "333333333333333333",
                            "roles": "Flex",
                            "availability": "Geht nicht",
                            "availability_slots": null,
                            "notes": "Bench only",
                            "role": "Sub",
                            "is_captain": false,
                            "is_bench": true,
                            "substitute_until": null
                        }
                    ]
                }
            ],
            "matches": [
                {
                    "id": "301",
                    "team_a": { "id": "101", "name": "Team Alpha" },
                    "team_b": { "id": "102", "name": "Team Beta" },
                    "when_text": "Freitag 20 Uhr",
                    "scheduled_at": "2026-08-02T18:00:00Z",
                    "status": "planned"
                }
            ],
            "match_request_batches": [{ "id": "401", "missing_response_count": 1 }],
            "lagebild_refs": [{ "id": "501", "team_id": "101" }]
        })
    }

    async fn proxy_test_state(
        turnier_base: String,
        ai_base: String,
        mode: ScrimBackendMode,
    ) -> (dl_central_db::TestDb, AppState, String) {
        proxy_test_state_with_timeout(turnier_base, ai_base, mode, 3_000).await
    }

    async fn proxy_test_state_with_timeout(
        turnier_base: String,
        ai_base: String,
        mode: ScrimBackendMode,
        scrim_timeout_ms: u64,
    ) -> (dl_central_db::TestDb, AppState, String) {
        let (db, state) = test_state_with(
            move |cfg| {
                cfg.scrim_backend_mode = mode;
                cfg.scrim_turnier_base = turnier_base;
                cfg.scrim_turnier_token = Some("turnier-token".into());
                cfg.scrim_ai_base = ai_base;
                cfg.scrim_ai_token = Some("ai-token".into());
                cfg.scrim_upstream_timeout_ms = scrim_timeout_ms;
            },
            std::time::Duration::from_secs(5),
        )
        .await;
        sqlx::query(
            "INSERT INTO coaching.coaches \
             (id, discord_user_id, discord_username, display_name, status, created_at, updated_at) \
             VALUES ('scrim-bff-coach', 940901, 'scrim_bff_coach', 'Scrim BFF Coach', 'active', now(), now())",
        )
        .execute(&state.pool)
        .await
        .expect("seed active coach");
        let token = state
            .auth
            .create_session_jwt(
                "940901",
                "scrim_bff_coach",
                "user",
                Some("Scrim BFF Coach"),
                None,
            )
            .expect("coach session");
        (db, state, token)
    }

    #[tokio::test]
    async fn legacy_mode_uses_legacy_router_without_upstream_calls() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "proxied": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "proxied": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Legacy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool",
                &token,
                None,
            ))
            .await
            .expect("legacy pool response");

        assert_eq!(response.status(), StatusCode::OK);
        assert!(to_json(response).await.is_array());
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_returns_bad_gateway_when_upstream_is_unreachable() {
        let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("temporary upstream listener");
        let unreachable_base = format!(
            "http://{}",
            listener.local_addr().expect("temporary upstream address")
        );
        drop(listener);
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(unreachable_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("unreachable upstream response");

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "Scrim upstream failed");
        assert!(body["request_id"].as_str().is_some());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_command_center_forwards_actor_request_id_and_token() {
        let upstream: Value = serde_json::from_str(include_str!(
            "../tests/fixtures/scrim-turnier-command-center.json"
        ))
        .expect("command center fixture");
        let (turnier_base, turnier_requests) = spawn_scrim_upstream(StatusCode::OK, upstream).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center?team_id=7",
                &token,
                None,
            ))
            .await
            .expect("proxy response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            to_json(response).await,
            json!({
                "attention": [{ "kind": "missing_responses", "source": "match_request_batch", "id": "401" }],
                "participants": [{ "id": "201", "display_name": "Missing Vote" }],
                "teams": [{ "id": "101" }],
                "matches": [{ "id": "401", "missing_response_count": 1 }],
                "match_request_batches": [{ "id": "401", "missing_response_count": 1 }],
                "operational_matches": [{ "id": "301", "status": "scheduled" }],
                "timeline": [
                    { "kind": "lagebild_ref", "lagebild_ref": { "id": "501", "team_id": "101" } },
                    { "kind": "operational_match", "match": { "id": "301", "status": "scheduled" } }
                ],
                "lagebild_refs": [{ "id": "501", "team_id": "101" }]
            })
        );
        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, Method::GET);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/turnier/v1/scrims/command-center?team_id=7"
        );
        assert_eq!(requests[0].internal_token.as_deref(), Some("turnier-token"));
        assert!(requests[0]
            .request_id
            .as_deref()
            .is_some_and(|value| value.starts_with("scrim_bff:v1:")));
        assert!(requests[0].idempotency_key.is_none());
        assert_eq!(requests[0].actor_discord_id.as_deref(), Some("940901"));
        assert_eq!(
            requests[0].actor_display_name.as_deref(),
            Some("Scrim BFF Coach")
        );
        assert!(requests[0].browser_actor_header.is_none());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_mutation_rejects_browser_actor_fields_before_upstream() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-request-batches",
                &token,
                Some(json!({
                    "actor": { "id": "evil" },
                    "technical_template_key": "regular_scrim",
                    "slots": [
                        { "day": "fri", "from_minute": 120, "to_minute": 240 },
                        { "day": "sat", "from_minute": 240, "to_minute": 360 }
                    ],
                    "pairings": [{ "team_a_id": "101", "team_b_id": null, "slots": null }]
                })),
            ))
            .await
            .expect("proxy response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_mutation_requires_same_origin_and_rejects_actor_headers() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let mut missing_origin = authenticated_request(
            Method::POST,
            "/api/scrim/match-request-batches",
            &token,
            Some(valid_planning_payload()),
        );
        missing_origin.headers_mut().remove("Origin");
        let response = app
            .clone()
            .oneshot(missing_origin)
            .await
            .expect("missing origin response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let mut evil_origin = authenticated_request(
            Method::POST,
            "/api/scrim/match-request-batches",
            &token,
            Some(valid_planning_payload()),
        );
        evil_origin
            .headers_mut()
            .insert("Origin", HeaderValue::from_static("https://evil.example"));
        let response = app
            .clone()
            .oneshot(evil_origin)
            .await
            .expect("evil origin response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let mut admin_origin = authenticated_request(
            Method::POST,
            "/api/scrim/match-request-batches",
            &token,
            Some(valid_planning_payload()),
        );
        admin_origin.headers_mut().insert(
            "Host",
            HeaderValue::from_static("admin.deutsche-deadlock-community.de"),
        );
        admin_origin.headers_mut().insert(
            "Origin",
            HeaderValue::from_static("https://admin.deutsche-deadlock-community.de"),
        );
        let response = app
            .clone()
            .oneshot(admin_origin)
            .await
            .expect("admin origin response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let mut actor_header = authenticated_request(
            Method::POST,
            "/api/scrim/match-request-batches",
            &token,
            Some(valid_planning_payload()),
        );
        actor_header
            .headers_mut()
            .insert("X-Actor-Discord-Id", HeaderValue::from_static("1"));
        let response = app
            .oneshot(actor_header)
            .await
            .expect("actor header response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_preserves_conflict_and_adds_idempotency_key() {
        let payload = valid_planning_payload();
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-request-batches",
                StatusCode::CONFLICT,
                json!({ "detail": "upstream conflict" }),
            )
            .expect_body(payload.clone())])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let request = authenticated_request(
            Method::POST,
            "/api/scrim/match-request-batches",
            &token,
            Some(payload.clone()),
        );
        let response = router(state)
            .oneshot(request)
            .await
            .expect("proxy response");

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "upstream conflict");
        assert!(body["request_id"].as_str().is_some());
        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, Method::POST);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/turnier/v1/scrims/match-request-batches"
        );
        let key = requests[0]
            .idempotency_key
            .as_deref()
            .expect("idempotency key");
        assert!(key.starts_with("scrim_bff:v1:"));
        assert!(key.len() <= 110);
        assert_ne!(key, "scrim_bff:v1:POST:_match-request-batches:940901:none");
        assert_eq!(requests[0].body, payload);
    }

    #[tokio::test]
    async fn scrim_proxy_planning_forwards_deadline_at_contract_without_deadline() {
        let payload = valid_planning_payload();
        assert!(payload.get("deadline_at").is_some());
        assert!(payload.get("deadline").is_none());
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-request-batches",
                StatusCode::OK,
                json!({ "ok": true }),
            )
            .expect_body(payload.clone())])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-request-batches",
                &token,
                Some(payload.clone()),
            ))
            .await
            .expect("planning response");

        assert_eq!(response.status(), StatusCode::OK);
        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].body, payload);
        assert!(requests[0].body.get("deadline_at").is_some());
        assert!(requests[0].body.get("deadline").is_none());
    }

    #[tokio::test]
    async fn scrim_proxy_planning_rejects_missing_deadline_at_before_upstream() {
        let mut payload = valid_planning_payload();
        payload
            .as_object_mut()
            .expect("planning fixture object")
            .remove("deadline_at");
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-request-batches",
                &token,
                Some(payload),
            ))
            .await
            .expect("missing deadline_at response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_planning_accepts_optional_template_and_pairing_slots() {
        let payload = json!({
            "deadline_at": "2026-08-01T18:00:00Z",
            "pairings": [{
                "team_a_id": "101",
                "team_b_id": "102",
                "slots": [
                    { "day": "fri", "from_minute": 120, "to_minute": 240 },
                    { "day": "sat", "from_minute": 240, "to_minute": 360 }
                ]
            }]
        });
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-request-batches",
                StatusCode::OK,
                json!({ "ok": true }),
            )
            .expect_body(payload.clone())])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-request-batches",
                &token,
                Some(payload.clone()),
            ))
            .await
            .expect("planning response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(turnier_requests.lock().expect("turnier requests").len(), 1);
    }

    #[tokio::test]
    async fn scrim_proxy_idempotency_key_is_unique_per_browser_request() {
        let payload = json!({ "message": "ping" });
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-requests/77/reminders",
                StatusCode::OK,
                json!({ "ok": true }),
            )])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        for _ in 0..2 {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::POST,
                    "/api/scrim/match-requests/77/reminders",
                    &token,
                    Some(payload.clone()),
                ))
                .await
                .expect("reminder response");
            assert_eq!(response.status(), StatusCode::OK);
        }

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 2);
        let first = requests[0].idempotency_key.as_deref().expect("first key");
        let second = requests[1].idempotency_key.as_deref().expect("second key");
        assert_ne!(first, second);
        assert!(first.starts_with("scrim_bff:v1:"));
        assert!(second.starts_with("scrim_bff:v1:"));
    }

    #[tokio::test]
    async fn scrim_proxy_rejects_browser_request_and_idempotency_headers() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        for header in ["X-Request-Id", "Idempotency-Key", "X-Idempotency-Key"] {
            let mut request = authenticated_request(
                Method::POST,
                "/api/scrim/match-request-batches",
                &token,
                Some(valid_planning_payload()),
            );
            request
                .headers_mut()
                .insert(header, HeaderValue::from_static("browser-value"));
            let response = router(state.clone())
                .oneshot(request)
                .await
                .expect("header rejection response");
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            assert!(to_json(response).await["request_id"].as_str().is_some());
        }

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_has_no_wildcard_tunnel_and_preserves_rate_limit_status() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/command-center",
                StatusCode::TOO_MANY_REQUESTS,
                json!({ "detail": "slow down" }),
            )
            .retry_after("30"),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/history",
                StatusCode::NOT_IMPLEMENTED,
                json!({ "message": "history not ready" }),
            ),
        ])
        .await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/not-a-real/route",
                &token,
                None,
            ))
            .await
            .expect("unknown route response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(response.headers().contains_key("X-Request-Id"));
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/matches/88/history",
                &token,
                None,
            ))
            .await
            .expect("removed generic route response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("rate limited response");
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response
                .headers()
                .get("Retry-After")
                .and_then(|value| value.to_str().ok()),
            Some("30")
        );
        let body = to_json(response).await;
        assert_eq!(body["detail"], "slow down");
        assert!(body["request_id"].as_str().is_some());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/history",
                &token,
                None,
            ))
            .await
            .expect("not implemented response");
        assert_eq!(response.status(), StatusCode::NOT_IMPLEMENTED);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "history not ready");
        assert!(body["request_id"].as_str().is_some());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_enforces_timeout_redirect_and_body_caps() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/command-center",
                StatusCode::OK,
                json!({ "teams": [] }),
            )
            .delay_ms(100),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/history",
                StatusCode::FOUND,
                json!({ "detail": "redirect" }),
            ),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/teams",
                StatusCode::OK,
                json!([{ "blob": "x".repeat(300 * 1024) }]),
            ),
        ])
        .await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state_with_timeout(turnier_base, ai_base, ScrimBackendMode::Proxy, 20).await;
        let app = router(state);

        let timeout = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("timeout response");
        assert_eq!(timeout.status(), StatusCode::GATEWAY_TIMEOUT);
        assert!(to_json(timeout).await["request_id"].as_str().is_some());

        let redirect = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/history",
                &token,
                None,
            ))
            .await
            .expect("redirect response");
        assert_eq!(redirect.status(), StatusCode::SERVICE_UNAVAILABLE);

        let response_cap = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams",
                &token,
                None,
            ))
            .await
            .expect("response cap response");
        assert_eq!(response_cap.status(), StatusCode::BAD_GATEWAY);
        assert!(to_json(response_cap).await["request_id"].as_str().is_some());

        let request_cap = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-requests/77/reminders",
                &token,
                Some(json!({ "message": "x".repeat(70 * 1024) })),
            ))
            .await
            .expect("request cap response");
        assert_eq!(request_cap.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert!(to_json(request_cap).await["request_id"].as_str().is_some());

        assert!(ai_requests.lock().expect("ai requests").is_empty());
        assert!(!turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_maps_malformed_success_json_to_bad_gateway() {
        let (turnier_base, _turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/command-center",
                StatusCode::OK,
                json!({}),
            )
            .raw_response("{not json")])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("malformed json response");

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "Scrim upstream failed");
        assert!(body["request_id"].as_str().is_some());
    }

    #[tokio::test]
    async fn scrim_proxy_hides_upstream_internal_auth_failure_as_503_with_request_id() {
        let (turnier_base, _turnier_requests) = spawn_scrim_upstream(
            StatusCode::UNAUTHORIZED,
            json!({ "detail": "bad internal token" }),
        )
        .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("proxy response");
        let request_id = response
            .headers()
            .get("X-Request-Id")
            .and_then(|value| value.to_str().ok())
            .map(str::to_string)
            .expect("request id header");

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = to_json(response).await;
        assert_eq!(body["request_id"], request_id);
        assert_ne!(body["detail"], "bad internal token");
    }

    #[tokio::test]
    async fn scrim_proxy_preserves_upstream_forbidden_as_user_forbidden() {
        let (turnier_base, _turnier_requests) = spawn_scrim_upstream(
            StatusCode::FORBIDDEN,
            json!({ "detail": "coach cannot release this batch" }),
        )
        .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("forbidden response");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "coach cannot release this batch");
        assert!(body["request_id"].as_str().is_some());
    }

    #[tokio::test]
    async fn scrim_proxy_rejects_unknown_force_fields_and_invalid_planning_boundaries() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        for body in [
            json!({
                "technical_template_key": "regular_scrim",
                "deadline_at": "2026-08-01T18:00:00Z",
                "slots": [{ "day": "fri", "from_minute": 120, "to_minute": 240 }],
                "pairings": [{ "team_a_id": "101", "team_b_id": "102", "slots": null }]
            }),
            json!({
                "technical_template_key": "regular_scrim",
                "deadline_at": "2026-08-01T18:00:00Z",
                "slots": [
                    { "day": "fri", "from_minute": 120, "to_minute": 240 },
                    { "day": "sat", "from_minute": 1441, "to_minute": 1441 }
                ],
                "pairings": [{ "team_a_id": "101", "team_b_id": "102", "slots": null }]
            }),
            json!({
                "technical_template_key": "regular_scrim",
                "deadline_at": "2026-08-01T18:00:00Z",
                "slots": [
                    { "day": "fri", "from_minute": 120, "to_minute": 240 },
                    { "day": "sat", "from_minute": 240, "to_minute": 360 }
                ],
                "pairings": [{ "team_a_id": "101", "team_b_id": "102", "slots": null }],
                "force": true
            }),
            json!({
                "technical_template_key": "regular_scrim",
                "deadline_at": "2026-08-01T18:00:00Z",
                "slots": [
                    { "day": "fri", "from_minute": 120, "to_minute": 240 },
                    { "day": "sat", "from_minute": 240, "to_minute": 360 }
                ],
                "pairings": [{ "team_a_id": 101, "team_b_id": "102", "slots": null }]
            }),
            json!({
                "technical_template_key": "regular_scrim",
                "deadline_at": "2026-08-01T18:00:00Z",
                "slots": [
                    { "day": "funday", "from_minute": 120, "to_minute": 240 },
                    { "day": "sat", "from_minute": 240, "to_minute": 360 }
                ],
                "pairings": [{ "team_a_id": "101", "team_b_id": "102", "slots": null }]
            }),
        ] {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::POST,
                    "/api/scrim/match-request-batches",
                    &token,
                    Some(body),
                ))
                .await
                .expect("planning boundary response");
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_accepts_decimal_string_ids_and_maps_canonical_methods() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-requests/77/release",
                StatusCode::OK,
                json!({ "released": true }),
            )
            .expect_body(json!({ "slot_index": 0, "reason": null })),
            MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/matches/88/match-ids",
                StatusCode::OK,
                json!({ "match_ids": true }),
            )
            .expect_body(json!({ "match_ids": ["12345"] })),
            MockScrimRoute::new(
                Method::PATCH,
                "/internal/turnier/v1/scrims/matches/88/result-refs/99",
                StatusCode::OK,
                json!({ "patched": true }),
            )
            .expect_body(json!({ "message": "wrong winner" })),
            MockScrimRoute::new(
                Method::PUT,
                "/internal/turnier/v1/scrims/matches/88/lobby-code",
                StatusCode::OK,
                json!({ "lobby": true }),
            )
            .expect_body(json!({ "lobby_code": "ABC12" })),
        ])
        .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-requests/77/release",
                &token,
                Some(json!({ "slot_index": 0, "reason": null })),
            ))
            .await
            .expect("release response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PUT,
                "/api/scrim/matches/88/lobby-code",
                &token,
                Some(json!({ "lobby_code": "ABC12" })),
            ))
            .await
            .expect("lobby response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/matches/88/result-refs/99",
                &token,
                Some(json!({ "message": "wrong winner" })),
            ))
            .await
            .expect("result ref patch response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/matches/88/match-ids",
                &token,
                Some(json!({ "match_ids": ["12345"] })),
            ))
            .await
            .expect("match ids response");
        assert_eq!(response.status(), StatusCode::OK);

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 4);
        assert_eq!(requests[0].method, Method::POST);
        assert_eq!(requests[1].method, Method::PUT);
        assert_eq!(requests[2].method, Method::PATCH);
        assert_eq!(requests[3].method, Method::POST);
    }

    #[tokio::test]
    async fn scrim_proxy_canonical_match_ids_reject_numeric_json_ids_before_upstream() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/matches/88/match-ids",
                StatusCode::OK,
                json!({ "ok": true }),
            )])
            .await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/matches/88/match-ids",
                &token,
                Some(json!({ "match_ids": [12345] })),
            ))
            .await
            .expect("numeric match ids response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_browser_compat_ids_accept_ui_numbers_and_forward_strings() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/teams/7/substitute",
                StatusCode::OK,
                json!({ "substituted": true }),
            )
            .expect_body(json!({
                "participant_id": "123",
                "window": { "day": "fri", "from": 1200, "to": 1320 }
            })),
            MockScrimRoute::new(
                Method::PATCH,
                "/internal/turnier/v1/scrims/participants/123",
                StatusCode::OK,
                json!({ "patched": true }),
            )
            .expect_body(json!({ "team_id": "7" })),
            MockScrimRoute::new(
                Method::PATCH,
                "/internal/turnier/v1/scrims/participants/124",
                StatusCode::OK,
                json!({ "patched": true }),
            )
            .expect_body(json!({ "team_id": null })),
        ])
        .await;
        let (ai_base, ai_requests) = spawn_scrim_upstream(StatusCode::OK, json!({})).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/substitute",
                &token,
                Some(json!({
                    "participant_id": 123,
                    "window": { "day": "fri", "from": 1200, "to": 1320 }
                })),
            ))
            .await
            .expect("numeric substitute response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/123",
                &token,
                Some(json!({ "team_id": 7 })),
            ))
            .await
            .expect("numeric participant patch response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/124",
                &token,
                Some(json!({ "team_id": null })),
            ))
            .await
            .expect("null participant patch response");
        assert_eq!(response.status(), StatusCode::OK);

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 3);
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_browser_compat_ids_reject_invalid_numbers_and_strings() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/teams/7/substitute",
                StatusCode::OK,
                json!({ "substituted": true }),
            ),
            MockScrimRoute::new(
                Method::PATCH,
                "/internal/turnier/v1/scrims/participants/123",
                StatusCode::OK,
                json!({ "patched": true }),
            ),
        ])
        .await;
        let (ai_base, ai_requests) = spawn_scrim_upstream(StatusCode::OK, json!({})).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);
        let invalid_ids = vec![
            json!(0),
            json!(-1),
            json!(1.5),
            json!(2_147_483_648_i64),
            json!("abc"),
            json!("1.2"),
        ];

        for invalid_id in &invalid_ids {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::POST,
                    "/api/scrim/teams/7/substitute",
                    &token,
                    Some(json!({
                        "participant_id": invalid_id,
                        "window": { "day": "fri", "from": 1200, "to": 1320 }
                    })),
                ))
                .await
                .expect("invalid substitute response");
            assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{invalid_id}");
        }

        for invalid_id in &invalid_ids {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::PATCH,
                    "/api/scrim/participants/123",
                    &token,
                    Some(json!({ "team_id": invalid_id })),
                ))
                .await
                .expect("invalid participant patch response");
            assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{invalid_id}");
        }

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn legacy_scrims_match_ids_still_converts_numeric_ids() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/matches/88/match-ids",
                StatusCode::OK,
                json!({ "ok": true }),
            )
            .expect_body(json!({ "match_ids": ["12345"] }))])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrims/matches/88/match-ids",
                &token,
                Some(json!({ "match_id": 12345 })),
            ))
            .await
            .expect("legacy numeric match id response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(turnier_requests.lock().expect("turnier requests").len(), 1);
    }

    #[tokio::test]
    async fn legacy_scrims_planning_maps_deadline_to_deadline_at_and_requires_it() {
        let expected = valid_planning_payload();
        let legacy_payload = json!({
            "template": "training",
            "deadline": "2026-08-01T18:00:00Z",
            "slots": [
                { "day": "fri", "from": 1170, "to": 1290 },
                { "day": "sat", "from": 960, "to": 1080 }
            ],
            "matches": [
                { "slots": null, "team_a_id": "1", "team_b_id": null },
                {
                    "slots": [
                        { "day": "sun", "from": 1200, "to": 1320 },
                        { "day": "sun", "from": 1350, "to": 1410 }
                    ],
                    "team_a_id": "2",
                    "team_b_id": "3"
                }
            ]
        });
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-request-batches",
                StatusCode::OK,
                json!({ "ok": true }),
            )
            .expect_body(expected.clone())])
            .await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrims/match-requests",
                &token,
                Some(legacy_payload),
            ))
            .await
            .expect("legacy planning response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrims/match-requests",
                &token,
                Some(json!({
                    "template": "training",
                    "slots": [
                        { "day": "fri", "from": 1170, "to": 1290 },
                        { "day": "sat", "from": 960, "to": 1080 }
                    ],
                    "matches": [{ "team_a_id": "1", "team_b_id": null, "slots": null }]
                })),
            ))
            .await
            .expect("legacy missing deadline response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].body, expected);
        assert!(requests[0].body.get("deadline_at").is_some());
        assert!(requests[0].body.get("deadline").is_none());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn legacy_scrims_summary_maps_match_request_id_to_status_preview() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/match-requests/77/status-preview",
                StatusCode::OK,
                json!({ "id": "77", "status": "draft" }),
            )])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrims/match-requests/77/summary",
                &token,
                None,
            ))
            .await
            .expect("legacy summary response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            to_json(response).await,
            json!({ "id": "77", "status": "draft" })
        );
        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, Method::GET);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/turnier/v1/scrims/match-requests/77/status-preview"
        );
    }

    #[tokio::test]
    async fn scrim_proxy_enforces_login_and_active_coach() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ok": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (db, state, _token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        sqlx::query("DELETE FROM coaching.coaches WHERE discord_user_id = 940901")
            .execute(db.pool())
            .await
            .expect("remove coach");
        let app = router(state.clone());

        let response = app
            .clone()
            .oneshot(request(Method::GET, "/api/scrim/command-center", None))
            .await
            .expect("anonymous response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let token = state
            .auth
            .create_session_jwt("940902", "not_coach", "user", Some("Not Coach"), None)
            .expect("user session");
        let response = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("non coach response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let response = router(state)
            .oneshot(admin_request(
                Method::GET,
                "/api/scrim/command-center",
                None,
            ))
            .await
            .expect("caddy admin scrim response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_self_service_allows_non_coach_numeric_user_only() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/me",
                StatusCode::OK,
                json!({ "participant": null, "team": null, "next_match": null }),
            )])
            .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, _coach_token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let token = state
            .auth
            .create_session_jwt("940902", "normal_user", "user", Some("Normal User"), None)
            .expect("user session");

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/me",
                &token,
                None,
            ))
            .await
            .expect("self service response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            to_json(response).await,
            json!({
                "participant": null,
                "team": null,
                "members": [],
                "next_match": null
            })
        );
        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].actor_discord_id.as_deref(), Some("940902"));
    }

    #[tokio::test]
    async fn scrim_proxy_pool_filters_participant_status_from_command_center() {
        let (turnier_base, turnier_requests) = spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
            Method::GET,
            "/internal/turnier/v1/scrims/command-center",
            StatusCode::OK,
            json!({
                "participants": [
                    { "id": "201", "display_name": "New Player", "status": "new", "source": "web_form" },
                    { "id": "202", "display_name": "Assigned Player", "status": "assigned", "source": "web_form" }
                ],
                "teams": [],
                "matches": [],
                "match_request_batches": [],
                "lagebild_refs": []
            }),
        )])
        .await;
        let (ai_base, ai_requests) = spawn_scrim_upstream(StatusCode::OK, json!({})).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool?status=new",
                &token,
                None,
            ))
            .await
            .expect("filtered pool response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body.as_array().map(Vec::len), Some(1));
        assert_eq!(body[0]["id"], 201);
        assert_eq!(body[0]["status"], "new");

        let response = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool?status=new%21",
                &token,
                None,
            ))
            .await
            .expect("invalid pool query response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/turnier/v1/scrims/command-center?status=new"
        );
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_lagebild_routes_use_ai_upstream_with_actor_headers() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "turnier": true })).await;
        let (ai_base, ai_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::POST,
                "/internal/dl-bots/v1/scrim/lagebilder/7/refresh",
                StatusCode::OK,
                json!({ "refreshed": true }),
            )
            .expect_body(json!({})),
            MockScrimRoute::new(
                Method::POST,
                "/internal/dl-bots/v1/scrim/lagebilder/7/corrections",
                StatusCode::OK,
                json!({ "corrected": true }),
            )
            .expect_body(json!({ "message": "Bitte Teamform korrigieren" })),
        ])
        .await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let refresh = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/lagebild/refresh",
                &token,
                Some(json!({})),
            ))
            .await
            .expect("refresh response");
        assert_eq!(refresh.status(), StatusCode::OK);

        let correction = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/lagebild/corrections",
                &token,
                Some(json!({ "message": "Bitte Teamform korrigieren" })),
            ))
            .await
            .expect("correction response");
        assert_eq!(correction.status(), StatusCode::OK);

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        let requests = ai_requests.lock().expect("ai requests");
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].method, Method::POST);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/dl-bots/v1/scrim/lagebilder/7/refresh"
        );
        assert_eq!(
            requests[1].path_and_query,
            "/internal/dl-bots/v1/scrim/lagebilder/7/corrections"
        );
        for request in requests.iter() {
            assert_eq!(request.internal_token.as_deref(), Some("ai-token"));
            assert_eq!(request.actor_discord_id.as_deref(), Some("940901"));
            assert_eq!(
                request.actor_display_name.as_deref(),
                Some("Scrim BFF Coach")
            );
            assert!(request
                .request_id
                .as_deref()
                .is_some_and(|value| value.starts_with("scrim_bff:v1:")));
            assert!(request
                .idempotency_key
                .as_deref()
                .is_some_and(|value| value.starts_with("scrim_bff:v1:")));
        }
    }

    #[tokio::test]
    async fn scrim_proxy_lagebild_security_blocks_spoofing_admin_origin_and_non_coach() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "turnier": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state.clone());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/lagebild/corrections",
                &token,
                Some(json!({ "message": "ok", "extra": true })),
            ))
            .await
            .expect("unknown field response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let mut admin_origin = authenticated_request(
            Method::POST,
            "/api/scrim/teams/7/lagebild/refresh",
            &token,
            Some(json!({})),
        );
        admin_origin.headers_mut().insert(
            "Host",
            HeaderValue::from_static("admin.deutsche-deadlock-community.de"),
        );
        admin_origin.headers_mut().insert(
            "Origin",
            HeaderValue::from_static("https://admin.deutsche-deadlock-community.de"),
        );
        let response = app
            .clone()
            .oneshot(admin_origin)
            .await
            .expect("admin origin ai response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let non_coach_token = state
            .auth
            .create_session_jwt("940912", "viewer", "user", Some("Viewer"), None)
            .expect("non coach session");
        let response = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/lagebild/refresh",
                &non_coach_token,
                Some(json!({})),
            ))
            .await
            .expect("non coach ai response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_lagebild_preserves_ai_501_message_error() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "turnier": true })).await;
        let (ai_base, ai_requests) = spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
            Method::POST,
            "/internal/dl-bots/v1/scrim/lagebilder/7/refresh",
            StatusCode::NOT_IMPLEMENTED,
            json!({ "message": "lagebild refresh disabled" }),
        )])
        .await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams/7/lagebild/refresh",
                &token,
                Some(json!({})),
            ))
            .await
            .expect("ai error response");

        assert_eq!(response.status(), StatusCode::NOT_IMPLEMENTED);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "lagebild refresh disabled");
        assert!(body["request_id"].as_str().is_some());
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert_eq!(ai_requests.lock().expect("ai requests").len(), 1);
    }

    #[tokio::test]
    async fn scrim_proxy_turnier_501_mutation_reaches_upstream_and_preserves_capability() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream_routes(vec![MockScrimRoute::new(
                Method::POST,
                "/internal/turnier/v1/scrims/match-requests/77/release",
                StatusCode::NOT_IMPLEMENTED,
                json!({
                    "detail": "release not available",
                    "available": false,
                    "verified": true
                }),
            )])
            .await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/match-requests/77/release",
                &token,
                Some(json!({ "unexpected_future_field": "kept for upstream" })),
            ))
            .await
            .expect("release 501 response");

        assert_eq!(response.status(), StatusCode::NOT_IMPLEMENTED);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "release not available");
        assert!(body["request_id"].as_str().is_some());
        assert_eq!(body["capability"]["available"], false);
        assert_eq!(body["capability"]["verified"], true);

        let spoofed = authenticated_request(
            Method::POST,
            "/api/scrim/match-requests/77/release",
            &token,
            Some(json!({ "actor": { "id": "evil" } })),
        );
        let response = app
            .clone()
            .oneshot(spoofed)
            .await
            .expect("spoofing response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let mut missing_origin = authenticated_request(
            Method::POST,
            "/api/scrim/match-requests/77/release",
            &token,
            Some(json!({ "reason": "ok" })),
        );
        missing_origin.headers_mut().remove("Origin");
        let response = app
            .oneshot(missing_origin)
            .await
            .expect("missing origin response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let requests = turnier_requests.lock().expect("turnier requests");
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].method, Method::POST);
        assert_eq!(
            requests[0].path_and_query,
            "/internal/turnier/v1/scrims/match-requests/77/release"
        );
        assert_eq!(
            requests[0].body,
            json!({ "unexpected_future_field": "kept for upstream" })
        );
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn scrim_proxy_adapts_website_compatibility_responses() {
        let read_model = turnier_scrim_read_model();
        let me_payload = json!({
            "participant": read_model["participants"][0].clone(),
            "team": read_model["teams"][0].clone(),
            "next_match": read_model["matches"][0].clone()
        });
        let (turnier_base, _turnier_requests) = spawn_scrim_upstream_routes(vec![
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/me",
                StatusCode::OK,
                me_payload,
            ),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/teams",
                StatusCode::OK,
                read_model["teams"].clone(),
            ),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/teams/101/board",
                StatusCode::OK,
                json!({ "team": read_model["teams"][0].clone() }),
            ),
            MockScrimRoute::new(
                Method::GET,
                "/internal/turnier/v1/scrims/command-center",
                StatusCode::OK,
                read_model.clone(),
            ),
        ])
        .await;
        let (ai_base, _ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Proxy).await;
        let app = router(state);

        let me = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/me",
                &token,
                None,
            ))
            .await
            .expect("me response");
        let me = to_json(me).await;
        assert_eq!(me["participant"]["id"], 201);
        assert_eq!(me["participant"]["availability_confirmed"], false);
        assert_eq!(
            me["participant"]["availability_slots"]["mon"]["status"],
            "unknown"
        );
        assert_eq!(me["team"]["id"], 101);
        assert_eq!(me["team"]["coach_discord_id"], "222222222222222222");
        assert_eq!(me["team"]["discord_role_id"], "444444444444444444");
        assert!(me["team"].get("members").is_none());
        assert_eq!(me["members"].as_array().map(Vec::len), Some(3));
        assert_eq!(me["members"][0]["participant_id"], 201);
        assert_eq!(me["members"][0]["role"], "Captain");
        assert_eq!(me["members"][2]["is_bench"], true);
        assert_eq!(me["next_match"]["id"], 301);
        assert_eq!(me["next_match"]["opponent_team_name"], "Team Beta");

        let pool = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool",
                &token,
                None,
            ))
            .await
            .expect("pool response");
        let pool = to_json(pool).await;
        assert!(pool.is_array());
        assert_eq!(pool.as_array().map(Vec::len), Some(3));
        assert_eq!(pool[0]["id"], 201);
        assert_eq!(pool[0]["discord_linked"], true);
        assert_eq!(pool[0]["team"]["id"], 101);
        assert_eq!(pool[0]["role"], "Captain");
        assert_eq!(pool[0]["is_captain"], true);
        assert_eq!(pool[0]["notes"], "Shotcaller");
        assert_eq!(pool[0]["availability_confirmed"], false);
        assert_eq!(pool[0]["availability_slots"]["sun"]["status"], "unknown");
        assert_eq!(pool[1]["id"], 202);
        assert_eq!(pool[1]["discord_linked"], false);
        assert_eq!(pool[1]["availability_confirmed"], true);
        assert_eq!(pool[1]["availability_slots"]["mon"]["from"], 1140);
        assert_eq!(pool[1]["availability_slots"]["wed"]["status"], "unknown");

        let teams = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams",
                &token,
                None,
            ))
            .await
            .expect("teams response");
        let teams = to_json(teams).await;
        assert!(teams.is_array());
        assert_eq!(teams[0]["id"], 101);
        assert_eq!(teams[0]["coach_discord_id"], "222222222222222222");
        assert_eq!(teams[0]["discord_channel_id"], "555555555555555555");
        assert!(teams[0].get("members").is_none());

        let board = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams/101/board",
                &token,
                None,
            ))
            .await
            .expect("board response");
        let board = to_json(board).await;
        assert_eq!(board["team"]["id"], 101);
        assert!(board["team"].get("members").is_none());
        assert_eq!(board["members"].as_array().map(Vec::len), Some(3));
        assert_eq!(board["members"][0]["participant_id"], 201);
        assert_eq!(board["members"][0]["roles"], "Carry");
        assert_eq!(board["members"][0]["discord_linked"], true);
        assert_eq!(board["members"][0]["availability_confirmed"], false);
        assert_eq!(
            board["members"][0]["availability"]["sun"]["status"],
            "unknown"
        );
        assert_eq!(board["members"][0]["notes"], "Shotcaller");
        assert_eq!(board["members"][1]["participant_id"], 202);
        assert_eq!(board["members"][1]["availability_confirmed"], true);
        assert_eq!(
            board["members"][1]["availability"]["wed"]["status"],
            "unknown"
        );
        assert_eq!(board["overlap"]["mon"]["available"], 1);
        assert_eq!(board["overlap"]["mon"]["unknown"], 1);
        assert_eq!(board["overlap"]["mon"]["unknown_ids"], json!([201]));
        assert_eq!(board["overlap"]["mon"]["window_from"], 1140);
        assert_eq!(board["overlap"]["mon"]["window_to"], 1320);
        assert_eq!(board["overlap"]["mon"]["full_squad"], false);
        assert_eq!(board["overlap"]["tue"]["unavailable_ids"], json!([202]));
        assert_eq!(board["overlap"]["tue"]["unknown_ids"], json!([201]));
        assert_eq!(board["overlap"]["wed"]["unknown"], 2);
        assert_eq!(board["overlap"]["wed"]["window_from"], Value::Null);

        let legacy = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrims",
                &token,
                None,
            ))
            .await
            .expect("legacy overview response");
        assert_eq!(
            to_json(legacy).await,
            json!({
                "teams": read_model["teams"].clone(),
                "matches": read_model["matches"].clone(),
                "match_request_summaries": read_model["match_request_batches"].clone(),
                "lagebilder": read_model["lagebild_refs"].clone(),
                "suggested_block": null
            })
        );
    }

    #[tokio::test]
    async fn scrim_maintenance_mode_returns_503_without_upstream_call() {
        let (turnier_base, turnier_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "turnier": true })).await;
        let (ai_base, ai_requests) =
            spawn_scrim_upstream(StatusCode::OK, json!({ "ai": true })).await;
        let (_db, state, token) =
            proxy_test_state(turnier_base, ai_base, ScrimBackendMode::Maintenance).await;
        let app = router(state);

        let response = app
            .clone()
            .oneshot(request(Method::GET, "/api/scrim/command-center", None))
            .await
            .expect("anonymous maintenance response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let response = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/command-center",
                &token,
                None,
            ))
            .await
            .expect("maintenance response");

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert!(turnier_requests
            .lock()
            .expect("turnier requests")
            .is_empty());
        assert!(ai_requests.lock().expect("ai requests").is_empty());
    }

    #[tokio::test]
    async fn legacy_scrim_mutations_share_origin_and_json_protection() {
        let (_db, state) = test_state().await;
        let token = state
            .auth
            .create_session_jwt("940910", "legacy_user", "user", Some("Legacy User"), None)
            .expect("session");
        let app = router(state);

        let mut missing_origin = authenticated_request(
            Method::POST,
            "/api/scrim/signup",
            &token,
            Some(json!({ "rank": "Initiate" })),
        );
        missing_origin.headers_mut().remove("Origin");
        let response = app
            .clone()
            .oneshot(missing_origin)
            .await
            .expect("missing origin legacy response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let mut wrong_content_type = authenticated_request(
            Method::POST,
            "/api/scrim/signup",
            &token,
            Some(json!({ "rank": "Initiate" })),
        );
        wrong_content_type
            .headers_mut()
            .insert("content-type", HeaderValue::from_static("text/plain"));
        let response = app
            .oneshot(wrong_content_type)
            .await
            .expect("content type legacy response");
        assert_eq!(response.status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }

    #[test]
    fn scrim_proxy_config_fails_closed_for_unknown_mode_public_base_or_missing_token() {
        assert!(ScrimBackendMode::from_env_value(Some("mystery".into())).is_err());

        let mut cfg = crate::config::Config::from_env();
        cfg.scrim_backend_mode = ScrimBackendMode::Proxy;
        cfg.scrim_turnier_base = "https://turnier.example".into();
        cfg.scrim_turnier_token = Some("turnier-token".into());
        cfg.scrim_ai_base = "http://127.0.0.1:8770".into();
        cfg.scrim_ai_token = Some("ai-token".into());
        assert!(cfg.validate_startup().is_err());

        cfg.scrim_turnier_base = "http://127.0.0.1:8900".into();
        cfg.scrim_ai_base = "https://ai.example".into();
        assert!(cfg.validate_startup().is_err());

        cfg.scrim_ai_base = "http://127.0.0.1:8770".into();
        cfg.scrim_turnier_token = None;
        assert!(cfg.validate_startup().is_err());

        cfg.scrim_turnier_token = Some("turnier-token".into());
        cfg.scrim_ai_token = None;
        assert!(cfg.validate_startup().is_err());

        cfg.scrim_ai_token = Some("ai-token".into());
        assert!(cfg.validate_startup().is_ok());
    }

    #[test]
    fn scrim_proxy_modules_do_not_depend_on_legacy_sql_or_discord_effects() {
        for (path, source) in [
            (
                "src/routes/scrim_proxy.rs",
                include_str!("routes/scrim_proxy.rs"),
            ),
            ("src/scrim_upstream.rs", include_str!("scrim_upstream.rs")),
        ] {
            for banned in [
                "sqlx::",
                "scrim.",
                "discord_broker",
                "DiscordRoleBroker",
                "send_rich_message",
                "create_role",
            ] {
                assert!(
                    !source.contains(banned),
                    "{path} must not contain legacy side-effect dependency {banned}"
                );
            }
        }
    }

    struct DeadlockTags;
    impl crate::video::YoutubeClient for DeadlockTags {
        fn resolve_channel<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, crate::video::YoutubeChannel> {
            Box::pin(async { unreachable!() })
        }
        fn channel_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async { unreachable!() })
        }
        fn playlist_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async { unreachable!() })
        }
        fn video_tags<'a>(&'a self, ids: &'a [String]) -> crate::video::TagFuture<'a> {
            Box::pin(async move {
                Ok(ids
                    .iter()
                    .map(|id| (id.clone(), vec!["Deadlock".into()]))
                    .collect())
            })
        }
        fn backfill<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, Vec<crate::video::FeedVideo>> {
            Box::pin(async { unreachable!() })
        }
    }

    struct NoDeadlockTags;
    impl crate::video::YoutubeClient for NoDeadlockTags {
        fn resolve_channel<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, crate::video::YoutubeChannel> {
            Box::pin(async { unreachable!() })
        }
        fn channel_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async { unreachable!() })
        }
        fn playlist_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async { unreachable!() })
        }
        fn video_tags<'a>(&'a self, ids: &'a [String]) -> crate::video::TagFuture<'a> {
            Box::pin(async move { Ok(ids.iter().map(|id| (id.clone(), Vec::new())).collect()) })
        }
        fn backfill<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, Vec<crate::video::FeedVideo>> {
            Box::pin(async { unreachable!() })
        }
    }

    struct PlaylistFeed(&'static str);
    impl crate::video::YoutubeClient for PlaylistFeed {
        fn resolve_channel<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, crate::video::YoutubeChannel> {
            Box::pin(async { unreachable!() })
        }
        fn channel_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async { unreachable!() })
        }
        fn playlist_feed<'a>(&'a self, _: &'a str) -> crate::video::YoutubeFuture<'a, String> {
            Box::pin(async move { Ok(self.0.to_string()) })
        }
        fn video_tags<'a>(&'a self, _: &'a [String]) -> crate::video::TagFuture<'a> {
            Box::pin(async { unreachable!() })
        }
        fn backfill<'a>(
            &'a self,
            _: &'a str,
        ) -> crate::video::YoutubeFuture<'a, Vec<crate::video::FeedVideo>> {
            Box::pin(async { unreachable!() })
        }
    }

    #[tokio::test]
    async fn rss_fixture_decision_appears_in_public_feed() {
        let (_db, state) = test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCfixture','https://youtube.test/fixture') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let videos = crate::video::parse_feed(include_str!("../tests/fixtures/youtube-feed.xml"))
            .expect("fixture");
        crate::video::ingest_videos(&state, Some(channel_id), videos, "rss", &DeadlockTags)
            .await
            .expect("ingest");

        let response = router(state.clone())
            .oneshot(request(Method::GET, "/api/videos", None))
            .await
            .expect("feed");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body.as_array().map(Vec::len), Some(2));
        assert_eq!(body[0]["status"], "live");
        let decisions: i64 = sqlx::query_scalar("SELECT count(*) FROM video_library.decision_log")
            .fetch_one(&state.pool)
            .await
            .expect("decisions");
        assert_eq!(decisions, 2);
    }

    #[tokio::test]
    async fn video_creator_and_admin_routes_enforce_401_and_403() {
        let (_db, state) = test_state().await;
        let app = router(state.clone());

        let response = app
            .clone()
            .oneshot(request(
                Method::POST,
                "/api/videos/channels",
                Some(json!({ "channel": "UC123" })),
            ))
            .await
            .expect("anonymous creator response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let token = state
            .auth
            .create_session_jwt("940009", "viewer", "user", Some("Viewer"), None)
            .expect("session");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/channels",
                &token,
                Some(json!({ "channel": "UC123" })),
            ))
            .await
            .expect("non-creator response");
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let response = app
            .oneshot(request(
                Method::DELETE,
                "/api/admin/videos/channels/1",
                None,
            ))
            .await
            .expect("anonymous admin response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn cors_allows_only_configured_same_site_origins() {
        let (_db, state) = test_state().await;
        let app = router(state);

        let allowed = Request::builder()
            .method(Method::OPTIONS)
            .uri("/api/scrim/command-center")
            .header("Host", "deutsche-deadlock-community.de")
            .header("Origin", "https://deutsche-deadlock-community.de")
            .header("Access-Control-Request-Method", "GET")
            .body(Body::empty())
            .expect("allowed cors request");
        let response = app
            .clone()
            .oneshot(allowed)
            .await
            .expect("allowed cors response");
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .and_then(|value| value.to_str().ok()),
            Some("https://deutsche-deadlock-community.de")
        );

        let evil = Request::builder()
            .method(Method::OPTIONS)
            .uri("/api/scrim/command-center")
            .header("Host", "deutsche-deadlock-community.de")
            .header("Origin", "https://evil.example")
            .header("Access-Control-Request-Method", "GET")
            .body(Body::empty())
            .expect("evil cors request");
        let response = app.clone().oneshot(evil).await.expect("evil cors response");
        assert!(response
            .headers()
            .get("access-control-allow-origin")
            .is_none());

        let admin = Request::builder()
            .method(Method::OPTIONS)
            .uri("/api/admin/videos/channels/1")
            .header("Host", "admin.deutsche-deadlock-community.de")
            .header("Origin", "https://admin.deutsche-deadlock-community.de")
            .header("Access-Control-Request-Method", "DELETE")
            .body(Body::empty())
            .expect("admin cors request");
        let response = app.oneshot(admin).await.expect("admin cors response");
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .and_then(|value| value.to_str().ok()),
            Some("https://admin.deutsche-deadlock-community.de")
        );
    }

    #[tokio::test]
    async fn creator_cannot_take_over_another_creators_active_channel() {
        let (_db, state) = creator_test_state().await;
        let channel_id = "UCabcdefghijklmnopqrstuv";
        sqlx::query("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES($1,$2,$3)")
            .bind(940_010_i64)
            .bind(channel_id)
            .bind(format!("https://youtube.test/{channel_id}"))
            .execute(&state.pool)
            .await
            .expect("existing channel");
        let token = state
            .auth
            .create_session_jwt("940011", "creator-b", "user", Some("Creator B"), None)
            .expect("session");

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/channels",
                &token,
                Some(json!({ "channel": channel_id })),
            ))
            .await
            .expect("register response");

        assert_eq!(response.status(), StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn poller_preserves_manual_video_approval() {
        let (_db, state) = creator_test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCmanualapproval0000000','https://youtube.test/manual') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video = crate::video::parse_feed(include_str!("../tests/fixtures/youtube-feed.xml"))
            .expect("fixture")
            .into_iter()
            .next()
            .expect("video");
        crate::video::ingest_videos(
            &state,
            Some(channel_id),
            vec![video.clone()],
            "rss",
            &NoDeadlockTags,
        )
        .await
        .expect("first ingest");
        let id: i64 =
            sqlx::query_scalar("SELECT id FROM video_library.videos WHERE yt_video_id=$1")
                .bind(&video.yt_video_id)
                .fetch_one(&state.pool)
                .await
                .expect("video id");
        let token = state
            .auth
            .create_session_jwt("940010", "creator-a", "user", Some("Creator A"), None)
            .expect("session");
        let response = router(state.clone())
            .oneshot(authenticated_request(
                Method::POST,
                &format!("/api/videos/{id}/approve"),
                &token,
                None,
            ))
            .await
            .expect("approve response");
        assert_eq!(response.status(), StatusCode::OK);

        crate::video::ingest_videos(
            &state,
            Some(channel_id),
            vec![video],
            "rss",
            &NoDeadlockTags,
        )
        .await
        .expect("second ingest");

        let status: String =
            sqlx::query_scalar("SELECT status FROM video_library.videos WHERE id=$1")
                .bind(id)
                .fetch_one(&state.pool)
                .await
                .expect("video status");
        assert_eq!(status, "live");
    }

    #[tokio::test]
    async fn identical_ingest_logs_only_the_initial_decision() {
        let (_db, state) = test_state().await;
        let video = crate::video::parse_feed(include_str!("../tests/fixtures/youtube-feed.xml"))
            .expect("fixture")
            .into_iter()
            .next()
            .expect("video");

        for _ in 0..2 {
            crate::video::ingest_videos(&state, None, vec![video.clone()], "rss", &NoDeadlockTags)
                .await
                .expect("ingest");
        }

        let decisions: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM video_library.decision_log WHERE yt_video_id=$1",
        )
        .bind(video.yt_video_id)
        .fetch_one(&state.pool)
        .await
        .expect("decision count");
        assert_eq!(decisions, 1);
    }

    #[tokio::test]
    async fn playlist_sync_links_only_existing_registered_channel_videos() {
        let (_db, state) = test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCplaylistsync000000000','https://youtube.test/sync') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,'video-001','Known',now(),'','live','rss') RETURNING id")
            .bind(channel_id).fetch_one(&state.pool).await.expect("video");
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source,yt_playlist_id) VALUES('sync-list',940010,'Sync','yt','PLfixture')")
            .execute(&state.pool).await.expect("playlist");

        crate::video::sync_playlist_with_client(
            &state,
            "sync-list",
            "PLfixture",
            &PlaylistFeed(include_str!("../tests/fixtures/youtube-feed.xml")),
        )
        .await
        .expect("sync");

        let videos: i64 = sqlx::query_scalar("SELECT count(*) FROM video_library.videos")
            .fetch_one(&state.pool)
            .await
            .expect("video count");
        let items: Vec<i64> = sqlx::query_scalar(
            "SELECT video_id FROM video_library.playlist_items WHERE playlist_id='sync-list' ORDER BY position",
        )
        .fetch_all(&state.pool)
        .await
        .expect("playlist items");
        assert_eq!(videos, 1);
        assert_eq!(items, vec![video_id]);
    }

    #[tokio::test]
    async fn failed_playlist_sync_preserves_existing_items() {
        let (_db, state) = test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCsyncfailure0000000000','https://youtube.test/sync') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,'existing-video','Existing',now(),'','live','rss') RETURNING id")
            .bind(channel_id).fetch_one(&state.pool).await.expect("video");
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source,yt_playlist_id) VALUES('stable-list',940010,'Stable','yt','PLfixture')")
            .execute(&state.pool).await.expect("playlist");
        sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) VALUES('stable-list',$1,0)")
            .bind(video_id).execute(&state.pool).await.expect("item");

        let result = crate::video::sync_playlist_with_client(
            &state,
            "stable-list",
            "PLfixture",
            &PlaylistFeed("<invalid"),
        )
        .await;

        assert!(result.is_err());
        let items: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM video_library.playlist_items WHERE playlist_id='stable-list' AND video_id=$1",
        )
        .bind(video_id)
        .fetch_one(&state.pool)
        .await
        .expect("item count");
        assert_eq!(items, 1);
    }

    #[tokio::test]
    async fn playlist_mutation_failed_sync_returns_success_after_create_and_keeps_one_row() {
        let (_db, state, token) = playlist_mutation_test_state().await;

        let response = router(state.clone())
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/playlists",
                &token,
                Some(json!({
                    "title": "Create sync failure",
                    "source": "yt",
                    "yt_playlist_id": "PLcreate-failure"
                })),
            ))
            .await
            .expect("playlist create response");
        let status = response.status();
        let body = to_json(response).await;
        let playlists: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM video_library.playlists WHERE title='Create sync failure'",
        )
        .fetch_one(&state.pool)
        .await
        .expect("playlist count");

        assert_eq!(playlists, 1);
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["sync_failed"], true);
        assert_eq!(
            body["sync_error"],
            "Die YouTube-Playlist konnte nicht geladen werden"
        );
    }

    #[tokio::test]
    async fn playlist_mutation_successful_create_prevents_error_driven_retry_duplicate() {
        let (_db, state, token) = playlist_mutation_test_state().await;
        let app = router(state.clone());
        let payload = json!({
            "title": "Retry sync failure",
            "source": "yt",
            "yt_playlist_id": "PLretry-failure"
        });

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/playlists",
                &token,
                Some(payload.clone()),
            ))
            .await
            .expect("first playlist create response");
        let first_status = response.status();
        let attempts = if first_status.is_success() {
            1
        } else {
            app.oneshot(authenticated_request(
                Method::POST,
                "/api/videos/playlists",
                &token,
                Some(payload),
            ))
            .await
            .expect("retried playlist create response");
            2
        };
        let playlists: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM video_library.playlists WHERE title='Retry sync failure'",
        )
        .fetch_one(&state.pool)
        .await
        .expect("playlist count");

        assert_eq!(first_status, StatusCode::OK);
        assert_eq!(attempts, 1);
        assert_eq!(playlists, 1);
    }

    #[tokio::test]
    async fn playlist_mutation_failed_sync_returns_success_after_update_and_keeps_changes() {
        let (_db, state, token) = playlist_mutation_test_state().await;
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source) VALUES('update-sync-failure',940010,'Before update','manual')")
            .execute(&state.pool)
            .await
            .expect("playlist");

        let response = router(state.clone())
            .oneshot(authenticated_request(
                Method::PUT,
                "/api/videos/playlists/update-sync-failure",
                &token,
                Some(json!({
                    "title": "After update",
                    "description": "Committed despite sync failure",
                    "source": "yt",
                    "yt_playlist_id": "PLupdate-failure"
                })),
            ))
            .await
            .expect("playlist update response");
        let status = response.status();
        let body = to_json(response).await;
        let playlist = sqlx::query(
            "SELECT title,description,source,yt_playlist_id FROM video_library.playlists WHERE id='update-sync-failure'",
        )
        .fetch_one(&state.pool)
        .await
        .expect("updated playlist");

        assert_eq!(rows::required_string(&playlist, "title"), "After update");
        assert_eq!(
            rows::required_string(&playlist, "description"),
            "Committed despite sync failure"
        );
        assert_eq!(rows::required_string(&playlist, "source"), "yt");
        assert_eq!(
            rows::string(&playlist, "yt_playlist_id").as_deref(),
            Some("PLupdate-failure")
        );
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["sync_failed"], true);
        assert_eq!(
            body["sync_error"],
            "Die YouTube-Playlist konnte nicht geladen werden"
        );
    }

    #[tokio::test]
    async fn playlist_mutation_manual_create_reports_sync_not_failed() {
        let (_db, state, token) = playlist_mutation_test_state().await;

        let response = router(state)
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/playlists",
                &token,
                Some(json!({"title": "Manual playlist", "source": "manual"})),
            ))
            .await
            .expect("manual playlist create response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(to_json(response).await["sync_failed"], false);
    }

    #[tokio::test]
    async fn mutating_video_handlers_write_action_audit() {
        let (_db, state) = creator_test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCactionaudit0000000000','https://youtube.test/audit') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,'audit-video','Audit',now(),'','pending','rss') RETURNING id")
            .bind(channel_id).fetch_one(&state.pool).await.expect("video");
        let taxonomy_id: i64 = sqlx::query_scalar(
            "SELECT id FROM video_library.taxonomy WHERE dimension='type' ORDER BY id LIMIT 1",
        )
        .fetch_one(&state.pool)
        .await
        .expect("taxonomy");
        let token = state
            .auth
            .create_session_jwt("940010", "creator-a", "user", Some("Creator A"), None)
            .expect("session");
        let app = router(state.clone());

        for action in ["approve", "hide"] {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::POST,
                    &format!("/api/videos/{video_id}/{action}"),
                    &token,
                    None,
                ))
                .await
                .expect("video mutation");
            assert_eq!(response.status(), StatusCode::OK);
        }
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PUT,
                &format!("/api/videos/{video_id}/tags"),
                &token,
                Some(json!({"taxonomy_ids":[taxonomy_id],"free_tags":["audit"]})),
            ))
            .await
            .expect("tag response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/videos/playlists",
                &token,
                Some(json!({"title":"Audit","source":"manual","video_ids":[video_id]})),
            ))
            .await
            .expect("playlist create");
        assert_eq!(response.status(), StatusCode::OK);
        let playlist_id = to_json(response).await["id"]
            .as_str()
            .expect("playlist id")
            .to_string();
        let response = app
            .clone()
            .oneshot(admin_request(
                Method::PUT,
                &format!("/api/videos/playlists/{playlist_id}"),
                Some(json!({"title":"Audit","source":"manual","video_ids":[video_id],"featured":true})),
            ))
            .await
            .expect("playlist update");
        assert_eq!(response.status(), StatusCode::OK);
        let response = app
            .clone()
            .oneshot(admin_request(
                Method::DELETE,
                &format!("/api/videos/playlists/{playlist_id}"),
                None,
            ))
            .await
            .expect("playlist delete");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .clone()
            .oneshot(admin_request(
                Method::POST,
                "/api/admin/videos/taxonomy",
                Some(json!({"dimension":"type","name":"Audit","slug":"audit"})),
            ))
            .await
            .expect("taxonomy create");
        assert_eq!(response.status(), StatusCode::OK);
        let created_taxonomy_id = to_json(response).await["id"].as_i64().expect("taxonomy id");
        for method in [Method::PUT, Method::DELETE] {
            let body = (method == Method::PUT)
                .then(|| json!({"dimension":"type","name":"Audit 2","slug":"audit-2"}));
            let response = app
                .clone()
                .oneshot(admin_request(
                    method,
                    &format!("/api/admin/videos/taxonomy/{created_taxonomy_id}"),
                    body,
                ))
                .await
                .expect("taxonomy mutation");
            assert_eq!(response.status(), StatusCode::OK);
        }

        let actions: Vec<String> =
            sqlx::query_scalar("SELECT action FROM video_library.action_audit_log ORDER BY id")
                .fetch_all(&state.pool)
                .await
                .expect("audit actions");
        assert_eq!(
            actions,
            vec![
                "video_approved",
                "video_hidden",
                "video_tagged",
                "playlist_created",
                "playlist_updated",
                "playlist_featured",
                "playlist_deleted",
                "taxonomy_created",
                "taxonomy_updated",
                "taxonomy_deactivated",
            ]
        );
    }

    #[tokio::test]
    async fn creator_cannot_mutate_another_creators_video_or_playlist() {
        let (_db, state) = creator_test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940011,'UCidorowner000000000000','https://youtube.test/idor') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,'idor-video','IDOR',now(),'','pending','rss') RETURNING id")
            .bind(channel_id).fetch_one(&state.pool).await.expect("video");
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source) VALUES('idor-list',940011,'IDOR','manual')")
            .execute(&state.pool).await.expect("playlist");
        let token = state
            .auth
            .create_session_jwt("940010", "creator-a", "user", Some("Creator A"), None)
            .expect("session");
        let app = router(state);
        let cases = [
            (
                Method::POST,
                format!("/api/videos/{video_id}/approve"),
                None,
            ),
            (Method::POST, format!("/api/videos/{video_id}/hide"), None),
            (
                Method::PUT,
                format!("/api/videos/{video_id}/tags"),
                Some(json!({"taxonomy_ids":[],"free_tags":[]})),
            ),
            (
                Method::PUT,
                "/api/videos/playlists/idor-list".into(),
                Some(json!({"title":"IDOR","source":"manual","video_ids":[]})),
            ),
            (
                Method::DELETE,
                "/api/videos/playlists/idor-list".into(),
                None,
            ),
        ];
        for (method, uri, body) in cases {
            let response = app
                .clone()
                .oneshot(authenticated_request(method, &uri, &token, body))
                .await
                .expect("IDOR response");
            assert_eq!(response.status(), StatusCode::FORBIDDEN, "{uri}");
        }
    }

    #[tokio::test]
    async fn non_live_videos_never_leak_from_public_views() {
        let (_db, state) = test_state().await;
        sqlx::query("INSERT INTO core.meta_users(id,username,display_name,role) VALUES(940010,'creator','Creator','user')")
            .execute(&state.pool).await.expect("creator");
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCstatusleak0000000000','https://youtube.test/status') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let mut ids = Vec::new();
        for status in ["live", "pending", "hidden"] {
            let id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,description,published_at,thumbnail_url,status,source) VALUES($1,$2,$3,'Secret',now(),'',$4,'rss') RETURNING id")
                .bind(channel_id)
                .bind(format!("status-{status}"))
                .bind(format!("Secret {status}"))
                .bind(status)
                .fetch_one(&state.pool)
                .await
                .expect("video");
            ids.push(id);
        }
        let taxonomy_id: i64 = sqlx::query_scalar(
            "SELECT id FROM video_library.taxonomy WHERE dimension='type' AND slug='guide'",
        )
        .fetch_one(&state.pool)
        .await
        .expect("taxonomy");
        for id in &ids {
            sqlx::query(
                "INSERT INTO video_library.video_taxonomy(video_id,taxonomy_id) VALUES($1,$2)",
            )
            .bind(id)
            .bind(taxonomy_id)
            .execute(&state.pool)
            .await
            .expect("video taxonomy");
        }
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source) VALUES('status-list',940010,'Status','manual')")
            .execute(&state.pool).await.expect("playlist");
        for (position, id) in ids.iter().enumerate() {
            sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) VALUES('status-list',$1,$2)")
                .bind(id).bind(position as i32).execute(&state.pool).await.expect("playlist item");
        }
        let app = router(state);
        for uri in [
            "/api/videos?q=Secret&type=guide",
            "/api/videos/playlists/status-list",
            "/api/videos/creators/940010",
        ] {
            let response = app
                .clone()
                .oneshot(request(Method::GET, uri, None))
                .await
                .expect("public response");
            assert_eq!(response.status(), StatusCode::OK, "{uri}");
            let body = to_json(response).await;
            let videos = body
                .as_array()
                .or_else(|| body["videos"].as_array())
                .expect("videos");
            assert_eq!(videos.len(), 1, "{uri}");
            assert_eq!(videos[0]["yt_video_id"], "status-live", "{uri}");
        }
    }

    #[tokio::test]
    async fn playlist_reorder_handler_persists_requested_order() {
        let (_db, state) = creator_test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCreorder00000000000000','https://youtube.test/reorder') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let mut ids = Vec::new();
        for name in ["a", "b", "c"] {
            let id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,$2,$2,now(),'','live','rss') RETURNING id")
                .bind(channel_id).bind(name).fetch_one(&state.pool).await.expect("video");
            ids.push(id);
        }
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source) VALUES('reorder-list',940010,'Reorder','manual')")
            .execute(&state.pool).await.expect("playlist");
        let token = state
            .auth
            .create_session_jwt("940010", "creator-a", "user", Some("Creator A"), None)
            .expect("session");
        let app = router(state);
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PUT,
                "/api/videos/playlists/reorder-list",
                &token,
                Some(
                    json!({"title":"Reorder","source":"manual","video_ids":[ids[2],ids[0],ids[1]]}),
                ),
            ))
            .await
            .expect("reorder response");
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .oneshot(request(
                Method::GET,
                "/api/videos/playlists/reorder-list",
                None,
            ))
            .await
            .expect("playlist response");
        let body = to_json(response).await;
        let order = body["videos"]
            .as_array()
            .expect("videos")
            .iter()
            .map(|video| video["yt_video_id"].as_str().expect("video id"))
            .collect::<Vec<_>>();
        assert_eq!(order, vec!["c", "a", "b"]);
    }

    #[tokio::test]
    async fn creator_lists_only_own_channels() {
        let (_db, state) = creator_test_state().await;
        for (owner, channel) in [
            (940_010_i64, "UCownchannel00000000000"),
            (940_011_i64, "UCforeignchannel0000000"),
        ] {
            sqlx::query("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES($1,$2,$3)")
                .bind(owner).bind(channel).bind(format!("https://youtube.test/{channel}"))
                .execute(&state.pool).await.expect("channel");
        }
        let token = state
            .auth
            .create_session_jwt("940010", "creator-a", "user", Some("Creator A"), None)
            .expect("session");

        let response = router(state)
            .oneshot(authenticated_request(
                Method::GET,
                "/api/videos/channels",
                &token,
                None,
            ))
            .await
            .expect("channels response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body.as_array().map(Vec::len), Some(1));
        assert_eq!(body[0]["youtube_channel_id"], "UCownchannel00000000000");
    }

    #[tokio::test]
    async fn admin_featured_toggle_without_video_ids_preserves_playlist_items() {
        let (_db, state) = test_state().await;
        let channel_id: i64 = sqlx::query_scalar("INSERT INTO video_library.channels(owner_discord_id,youtube_channel_id,youtube_url) VALUES(940010,'UCfeatured0000000000000','https://youtube.test/featured') RETURNING id")
            .fetch_one(&state.pool).await.expect("channel");
        let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos(channel_id,yt_video_id,title,published_at,thumbnail_url,status,source) VALUES($1,'featured-video','Featured',now(),'','live','rss') RETURNING id")
            .bind(channel_id).fetch_one(&state.pool).await.expect("video");
        sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,source) VALUES('featured-list',940010,'Featured','manual')")
            .execute(&state.pool).await.expect("playlist");
        sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) VALUES('featured-list',$1,0)")
            .bind(video_id).execute(&state.pool).await.expect("item");

        let response = router(state.clone())
            .oneshot(admin_request(
                Method::PUT,
                "/api/videos/playlists/featured-list",
                Some(json!({"title":"Featured","source":"manual","featured":true})),
            ))
            .await
            .expect("featured response");

        assert_eq!(response.status(), StatusCode::OK);
        let item_count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM video_library.playlist_items WHERE playlist_id='featured-list'",
        )
        .fetch_one(&state.pool)
        .await
        .expect("item count");
        assert_eq!(item_count, 1);
    }

    #[tokio::test]
    async fn auth_upsert_erhaelt_existing_role() {
        let (_db, state) = test_state().await;
        let user_id = 940001_i64;

        sqlx::query(
            "INSERT INTO core.meta_users (id, username, display_name, avatar_url, role) \
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(user_id)
        .bind("old_name")
        .bind("Old Name")
        .bind(Option::<&str>::None)
        .bind("admin")
        .execute(&state.pool)
        .await
        .expect("seed meta user");

        let role = auth::upsert_meta_user(
            &state,
            user_id,
            "new_name",
            "New Name",
            Some("https://example.invalid/avatar.png"),
        )
        .await
        .expect("upsert meta user");

        assert_eq!(role, "admin");
        let row =
            sqlx::query("SELECT username, display_name, role FROM core.meta_users WHERE id=$1")
                .bind(user_id)
                .fetch_one(&state.pool)
                .await
                .expect("meta user row");
        assert_eq!(rows::required_string(&row, "username"), "new_name");
        assert_eq!(rows::required_string(&row, "display_name"), "New Name");
        assert_eq!(rows::required_string(&row, "role"), "admin");
    }

    #[tokio::test]
    async fn hero_build_jsonb_roundtrip_postgres() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let hero = request(
            Method::POST,
            "/api/heroes",
            Some(json!({
                "name": "Json Hero",
                "tier": "A",
                "role": "Flex",
                "abilities": [{"slot": 1, "name": "Dash"}],
                "stats": {"hp": 650, "tags": ["mobile", "test"]}
            })),
        );
        let response = app.clone().oneshot(hero).await.expect("hero response");
        assert_eq!(response.status(), StatusCode::OK);
        let hero_body = to_json(response).await;
        let hero_id = hero_body["id"].as_str().expect("hero id").to_string();
        assert_eq!(hero_body["abilities_json"][0]["name"], "Dash");
        assert_eq!(hero_body["stats_json"]["hp"], 650);

        let build = request(
            Method::POST,
            "/api/builds",
            Some(json!({
                "hero_id": hero_id,
                "name": "Json Build",
                "description": "jsonb test",
                "ability_order": [1, 3, 2, 4],
                "items": [{"id": "item-a", "phase": "early"}]
            })),
        );
        let response = app.oneshot(build).await.expect("build response");
        assert_eq!(response.status(), StatusCode::OK);
        let build_body = to_json(response).await;
        let build_id = build_body["id"].as_str().expect("build id").to_string();
        assert_eq!(build_body["ability_order_json"], json!([1, 3, 2, 4]));
        assert_eq!(build_body["items_json"][0]["id"], "item-a");

        let abilities: Value =
            sqlx::query_scalar("SELECT abilities FROM tierlist.meta_heroes WHERE id=$1")
                .bind(&hero_id)
                .fetch_one(&pool)
                .await
                .expect("hero abilities jsonb");
        let items: Value = sqlx::query_scalar("SELECT items FROM tierlist.meta_builds WHERE id=$1")
            .bind(&build_id)
            .fetch_one(&pool)
            .await
            .expect("build items jsonb");
        assert_eq!(abilities[0]["slot"], 1);
        assert_eq!(items[0]["phase"], "early");
    }

    #[tokio::test]
    async fn website_coaching_request_erzeugt_request_uid_und_website_request_id() {
        let ban_api = spawn_ban_api().await;
        std::env::set_var("DASHBOARD_INTERNAL_API_BASE", ban_api);
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let token = state
            .auth
            .create_session_jwt("940201", "website_user", "user", Some("Website User"), None)
            .expect("session jwt");
        let app = router(state);

        let create = authenticated_request(
            Method::POST,
            "/api/coaching/requests",
            &token,
            Some(json!({
                "id": "website-request-t8",
                "rank": "Archon",
                "subrank": "4",
                "hero": "Haze",
                "availability": "abends"
            })),
        );
        let response = app.oneshot(create).await.expect("website request response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["id"], "website-request-t8");

        let row = sqlx::query(
            "SELECT request_uid, website_request_id, bot_request_id, discord_user_id, discord_username \
             FROM coaching.requests WHERE website_request_id=$1",
        )
        .bind("website-request-t8")
        .fetch_one(&pool)
        .await
        .expect("request row");
        assert_eq!(
            rows::required_string(&row, "request_uid"),
            "website-request-t8"
        );
        assert_eq!(
            rows::required_string(&row, "website_request_id"),
            "website-request-t8"
        );
        assert!(rows::i64(&row, "bot_request_id").is_none());
        assert_eq!(rows::i64(&row, "discord_user_id"), Some(940201));
        assert_eq!(
            rows::required_string(&row, "discord_username"),
            "website_user"
        );
    }

    #[tokio::test]
    async fn website_request_erscheint_bot_request_nicht_in_notification_queue() {
        let (_db, state) = test_state().await;
        let app = router(state);

        let create = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "id": "req-notify-1",
                "discord_user_id": 424242,
                "discord_username": "queue_user",
                "rank": "Archon",
                "subrank": "3",
                "hero": "Haze",
                "games_played": "123",
                "hours_played": "456",
                "availability": "werktags abends",
                "current_problems": "Laning und Teamfights",
                "preferred_coach_id": "coach-pref-1"
            })),
        );
        let response = app.clone().oneshot(create).await.expect("create response");
        assert_eq!(response.status(), StatusCode::OK);

        let create_bot_request = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "bot_request_id": 9001,
                "discord_user_id": 525252,
                "discord_username": "bot_queue_user",
                "rank": "Oracle",
                "subrank": "1",
                "hero": "Pocket",
                "games_played": "321",
                "hours_played": "654",
                "availability": "wochenends",
                "current_problems": "Rotations"
            })),
        );
        let response = app
            .clone()
            .oneshot(create_bot_request)
            .await
            .expect("create bot response");
        assert_eq!(response.status(), StatusCode::OK);

        let due = request(
            Method::GET,
            "/api/coaching/platform/notifications/due",
            None,
        );
        let response = app.oneshot(due).await.expect("due response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        let notifications = body["notifications"].as_array().expect("notifications");
        let request_notification = notifications
            .iter()
            .find(|item| item["type"] == "request_created")
            .expect("request_created");
        assert_eq!(request_notification["request_id"], "req-notify-1");
        assert_eq!(request_notification["discord_user_id"], 424242);
        assert_eq!(request_notification["preferred_coach_id"], "coach-pref-1");

        let bot_request_notification = notifications
            .iter()
            .find(|item| item["type"] == "request_created" && item["request_id"] == "9001")
            .or_else(|| {
                notifications.iter().find(|item| {
                    item["type"] == "request_created" && item["discord_user_id"] == 525252
                })
            });
        assert!(
            bot_request_notification.is_none(),
            "bot-only requests must not be mirrored back as website request_created notifications"
        );
    }

    #[tokio::test]
    async fn request_created_ack_matcht_nur_website_request_id() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let create_website_request = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "id": "9001",
                "discord_user_id": 626262,
                "discord_username": "website_collision_user",
                "rank": "Archon",
                "subrank": "2"
            })),
        );
        let response = app
            .clone()
            .oneshot(create_website_request)
            .await
            .expect("create website response");
        assert_eq!(response.status(), StatusCode::OK);

        let create_bot_request = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "bot_request_id": 9001,
                "discord_user_id": 727272,
                "discord_username": "bot_collision_user",
                "rank": "Oracle",
                "subrank": "1"
            })),
        );
        let response = app
            .clone()
            .oneshot(create_bot_request)
            .await
            .expect("create bot response");
        assert_eq!(response.status(), StatusCode::OK);

        let ack = request(
            Method::POST,
            "/api/coaching/platform/notifications/ack",
            Some(json!({ "request_ids": ["9001"] })),
        );
        let response = app.oneshot(ack).await.expect("ack response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["acked"], 1);

        let website_notify: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
            "SELECT notify_discord_at FROM coaching.requests WHERE website_request_id=$1",
        )
        .bind("9001")
        .fetch_one(&pool)
        .await
        .expect("website notify");
        assert!(website_notify.is_some());

        let bot_notify: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
            "SELECT notify_discord_at FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(9001_i32)
        .fetch_one(&pool)
        .await
        .expect("bot notify");
        assert!(bot_notify.is_none());
    }

    #[tokio::test]
    async fn platform_sync_legt_bot_request_kollisionsfrei_an_und_aktualisiert() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let create = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7101,
                "discord_user_id": 810101,
                "discord_username": "sync_bot_user",
                "rank": "Oracle",
                "subrank": "1",
                "hero": "Pocket",
                "status": "analyzed",
                "reserved_until": 1_800_000_000_i64
            })),
        );
        let response = app.clone().oneshot(create).await.expect("sync create");
        assert_eq!(response.status(), StatusCode::OK);

        let update = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7101,
                "discord_user_id": 810101,
                "discord_username": "sync_bot_user_updated",
                "rank": "Phantom",
                "subrank": "4",
                "hero": "Haze",
                "status": "matched",
                "reserved_until": "2027-01-15T10:30:00Z"
            })),
        );
        let response = app.oneshot(update).await.expect("sync update");
        assert_eq!(response.status(), StatusCode::OK);

        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM coaching.requests WHERE bot_request_id=$1")
                .bind(7101_i32)
                .fetch_one(&pool)
                .await
                .expect("request count");
        assert_eq!(count, 1);

        let row = sqlx::query(
            "SELECT request_uid, website_request_id, discord_username, rank, status, reserved_until \
             FROM coaching.requests \
             WHERE bot_request_id=$1",
        )
        .bind(7101_i32)
        .fetch_one(&pool)
        .await
        .expect("request row");
        assert_eq!(rows::required_string(&row, "request_uid"), "bot:7101");
        assert!(rows::string(&row, "website_request_id").is_none());
        assert_eq!(
            rows::required_string(&row, "discord_username"),
            "sync_bot_user_updated"
        );
        assert_eq!(rows::required_string(&row, "rank"), "Phantom");
        assert_eq!(rows::required_string(&row, "status"), "matched");
        assert_eq!(
            rows::i64(&row, "reserved_until"),
            Some(
                Utc.with_ymd_and_hms(2027, 1, 15, 10, 30, 0)
                    .single()
                    .expect("timestamp")
                    .timestamp()
            )
        );
    }

    #[tokio::test]
    async fn platform_sync_verknuepft_website_zeile_mit_neuer_bot_id() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let website = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "id": "sync-union",
                "discord_user_id": 815050,
                "discord_username": "sync_union_website",
                "rank": "Archon",
                "subrank": "3"
            })),
        );
        let response = app.clone().oneshot(website).await.expect("website create");
        assert_eq!(response.status(), StatusCode::OK);

        let sync = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "website_request_id": "sync-union",
                "bot_request_id": 7150,
                "discord_user_id": 815050,
                "discord_username": "sync_union_updated",
                "rank": "Phantom",
                "subrank": "5",
                "status": "matched"
            })),
        );
        let response = app.oneshot(sync).await.expect("union sync");
        assert_eq!(response.status(), StatusCode::OK);

        let request_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM coaching.requests WHERE bot_request_id=$1")
                .bind(7150_i32)
                .fetch_one(&pool)
                .await
                .expect("bot id count");
        assert_eq!(request_count, 1);

        let row = sqlx::query(
            "SELECT request_uid, bot_request_id, discord_username, rank, status \
             FROM coaching.requests WHERE website_request_id=$1",
        )
        .bind("sync-union")
        .fetch_one(&pool)
        .await
        .expect("website request row");
        assert_eq!(rows::required_string(&row, "request_uid"), "sync-union");
        assert_eq!(rows::i64(&row, "bot_request_id"), Some(7150));
        assert_eq!(
            rows::required_string(&row, "discord_username"),
            "sync_union_updated"
        );
        assert_eq!(rows::required_string(&row, "rank"), "Phantom");
        assert_eq!(rows::required_string(&row, "status"), "matched");
    }

    #[tokio::test]
    async fn platform_sync_lehnt_mehrdeutige_request_referenzen_ab() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let website = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "id": "sync-collision",
                "discord_user_id": 815151,
                "discord_username": "sync_collision_website",
                "rank": "Archon",
                "subrank": "3"
            })),
        );
        let response = app.clone().oneshot(website).await.expect("website create");
        assert_eq!(response.status(), StatusCode::OK);

        let bot = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "bot_request_id": 7151,
                "discord_user_id": 825151,
                "discord_username": "sync_collision_bot",
                "rank": "Oracle",
                "subrank": "1"
            })),
        );
        let response = app.clone().oneshot(bot).await.expect("bot create");
        assert_eq!(response.status(), StatusCode::OK);

        let sync = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "website_request_id": "sync-collision",
                "bot_request_id": 7151,
                "discord_user_id": 815151,
                "discord_username": "sync_collision_website",
                "rank": "Phantom",
                "subrank": "5",
                "status": "matched"
            })),
        );
        let response = app.oneshot(sync).await.expect("collision sync");
        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "conflicting request references");

        let request_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM coaching.requests \
             WHERE website_request_id=$1 OR bot_request_id=$2",
        )
        .bind("sync-collision")
        .bind(7151_i32)
        .fetch_one(&pool)
        .await
        .expect("request count");
        assert_eq!(request_count, 2);

        let website_bot_id: Option<i32> = sqlx::query_scalar(
            "SELECT bot_request_id FROM coaching.requests WHERE website_request_id=$1",
        )
        .bind("sync-collision")
        .fetch_one(&pool)
        .await
        .expect("website bot id");
        assert!(website_bot_id.is_none());

        let website_status: String =
            sqlx::query_scalar("SELECT status FROM coaching.requests WHERE website_request_id=$1")
                .bind("sync-collision")
                .fetch_one(&pool)
                .await
                .expect("website status");
        assert_eq!(website_status, "pending");

        let bot_username: String = sqlx::query_scalar(
            "SELECT discord_username FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(7151_i32)
        .fetch_one(&pool)
        .await
        .expect("bot username");
        assert_eq!(bot_username, "sync_collision_bot");
    }

    #[tokio::test]
    async fn platform_sync_schuetzt_explizite_request_uid_und_bot_prefixe() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let create_bot = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7301,
                "discord_user_id": 830101,
                "discord_username": "uid_guard_bot",
                "rank": "Oracle",
                "subrank": "1",
                "status": "analyzed"
            })),
        );
        let response = app.clone().oneshot(create_bot).await.expect("bot create");
        assert_eq!(response.status(), StatusCode::OK);

        let explicit_uid_collision = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "website_request_id": "explicit-uid-guard",
                "request_uid": "bot:7301",
                "discord_user_id": 830202,
                "discord_username": "uid_guard_website",
                "rank": "Phantom",
                "subrank": "2",
                "status": "pending"
            })),
        );
        let response = app
            .clone()
            .oneshot(explicit_uid_collision)
            .await
            .expect("explicit uid collision sync");
        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body = to_json(response).await;
        assert_eq!(body["detail"], "conflicting request references");

        let bot_prefix_sync = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "website_request_id": "bot:7302",
                "discord_user_id": 830303,
                "discord_username": "bad_prefix",
                "rank": "Oracle",
                "subrank": "3"
            })),
        );
        let response = app
            .clone()
            .oneshot(bot_prefix_sync)
            .await
            .expect("bot prefix sync");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = to_json(response).await;
        assert_eq!(
            body["detail"],
            "website_request_id must not start with bot:"
        );

        let bot_prefix_create = request(
            Method::POST,
            "/api/coaching/requests",
            Some(json!({
                "id": "bot:public-prefix",
                "discord_user_id": 830404,
                "discord_username": "bad_public_prefix",
                "rank": "Oracle",
                "subrank": "4"
            })),
        );
        let response = app
            .oneshot(bot_prefix_create)
            .await
            .expect("bot prefix public create");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let request_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM coaching.requests \
             WHERE bot_request_id=$1 OR website_request_id=$2",
        )
        .bind(7301_i32)
        .bind("explicit-uid-guard")
        .fetch_one(&pool)
        .await
        .expect("request count");
        assert_eq!(request_count, 1);

        let bot_row = sqlx::query(
            "SELECT website_request_id, discord_username \
             FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(7301_i32)
        .fetch_one(&pool)
        .await
        .expect("bot row");
        assert!(rows::string(&bot_row, "website_request_id").is_none());
        assert_eq!(
            rows::required_string(&bot_row, "discord_username"),
            "uid_guard_bot"
        );

        let website_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM coaching.requests WHERE website_request_id=$1",
        )
        .bind("explicit-uid-guard")
        .fetch_one(&pool)
        .await
        .expect("website row count");
        assert_eq!(website_count, 0);
    }

    #[tokio::test]
    async fn platform_sync_erstellt_session_mit_epoch_und_rfc3339_reserved_until() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let create = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7201,
                "discord_user_id": 820101,
                "discord_username": "session_sync_user",
                "rank": "Archon",
                "subrank": "2",
                "status": "matched",
                "reserved_until": 1_800_100_000_i64,
                "coach_discord_id": 830101,
                "coach_username": "session_coach",
                "session_status": "active",
                "bot_session_id": "bot-session-7201"
            })),
        );
        let response = app.clone().oneshot(create).await.expect("session create");
        assert_eq!(response.status(), StatusCode::OK);

        let epoch_reserved: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT reserved_until FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(7201_i32)
        .fetch_one(&pool)
        .await
        .expect("epoch reserved");
        assert_eq!(epoch_reserved.map(|dt| dt.timestamp()), Some(1_800_100_000));

        let update = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7201,
                "discord_user_id": 820101,
                "discord_username": "session_sync_user",
                "rank": "Archon",
                "subrank": "2",
                "status": "matched",
                "reserved_until": "2027-02-01T12:00:00Z",
                "coach_discord_id": 830101,
                "coach_username": "session_coach",
                "session_status": "completed",
                "bot_session_id": "bot-session-7201"
            })),
        );
        let response = app.oneshot(update).await.expect("session update");
        assert_eq!(response.status(), StatusCode::OK);

        let session_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM coaching.sessions WHERE bot_request_id=$1")
                .bind(7201_i32)
                .fetch_one(&pool)
                .await
                .expect("session count");
        assert_eq!(session_count, 1);

        let session = sqlx::query(
            "SELECT request_uid, bot_request_id, website_request_id, bot_session_id, status, completed_at \
             FROM coaching.sessions \
             WHERE bot_request_id=$1",
        )
        .bind(7201_i32)
        .fetch_one(&pool)
        .await
        .expect("session row");
        assert_eq!(rows::required_string(&session, "request_uid"), "bot:7201");
        assert_eq!(rows::i64(&session, "bot_request_id"), Some(7201));
        assert!(rows::string(&session, "website_request_id").is_none());
        assert_eq!(
            rows::required_string(&session, "bot_session_id"),
            "bot-session-7201"
        );
        assert_eq!(rows::required_string(&session, "status"), "completed");
        assert!(rows::string(&session, "completed_at").is_some());

        let rfc3339_reserved: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT reserved_until FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(7201_i32)
        .fetch_one(&pool)
        .await
        .expect("rfc3339 reserved");
        assert_eq!(
            rfc3339_reserved.map(|dt| dt.timestamp()),
            Some(
                Utc.with_ymd_and_hms(2027, 2, 1, 12, 0, 0)
                    .single()
                    .expect("timestamp")
                    .timestamp()
            )
        );
    }

    #[tokio::test]
    async fn platform_goals_milestones_notes_appointments_smoke_postgres() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);
        let coachee_id = "coachee-platform-smoke";

        sqlx::query(
            "INSERT INTO coaching.coachees \
             (id, discord_user_id, discord_username, display_name, rank, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, now(), now())",
        )
        .bind(coachee_id)
        .bind(930101_i64)
        .bind("platform_smoke_user")
        .bind("Platform Smoke")
        .bind("Oracle")
        .execute(&pool)
        .await
        .expect("seed coachee");

        let goal = admin_request(
            Method::POST,
            &format!("/api/coaching/platform/coachees/{coachee_id}/goals"),
            Some(json!({
                "title": "Wave management",
                "description": "Review first 10 minutes",
                "target_date": "2027-03-01"
            })),
        );
        let response = app.clone().oneshot(goal).await.expect("goal response");
        assert_eq!(response.status(), StatusCode::OK);
        let goal_id = to_json(response).await["id"]
            .as_str()
            .expect("goal id")
            .to_string();

        let milestone = admin_request(
            Method::POST,
            &format!("/api/coaching/platform/goals/{goal_id}/milestones"),
            Some(json!({ "title": "Replay reviewed", "description": "Clip key deaths" })),
        );
        let response = app
            .clone()
            .oneshot(milestone)
            .await
            .expect("milestone response");
        assert_eq!(response.status(), StatusCode::OK);

        let note = admin_request(
            Method::POST,
            &format!("/api/coaching/platform/coachees/{coachee_id}/notes"),
            Some(json!({ "content": "Shared homework", "visibility": "shared_with_user" })),
        );
        let response = app.clone().oneshot(note).await.expect("note response");
        assert_eq!(response.status(), StatusCode::OK);

        let appointment = admin_request(
            Method::POST,
            "/api/coaching/platform/appointments",
            Some(json!({
                "coachee_id": coachee_id,
                "scheduled_at": "2027-03-02T18:00:00Z",
                "duration_minutes": 75,
                "title": "Follow-up",
                "note": "Bring replay code"
            })),
        );
        let response = app
            .clone()
            .oneshot(appointment)
            .await
            .expect("appointment response");
        assert_eq!(response.status(), StatusCode::OK);

        let coachee = admin_request(
            Method::GET,
            &format!("/api/coaching/platform/coachees/{coachee_id}"),
            None,
        );
        let response = app.oneshot(coachee).await.expect("coachee response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["goals"].as_array().expect("goals").len(), 1);
        assert_eq!(body["notes"].as_array().expect("notes").len(), 1);
        assert_eq!(
            body["appointments"].as_array().expect("appointments").len(),
            1
        );
    }

    #[tokio::test]
    async fn appointment_notification_due_ack_roundtrip_postgres() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);
        let coach_id = "appt-notify-coach";
        let coachee_id = "appt-notify-coachee";
        let appointment_id = "appt-notify-t8";
        let scheduled_at = Utc
            .with_ymd_and_hms(2027, 4, 1, 18, 30, 0)
            .single()
            .expect("scheduled timestamp");

        sqlx::query(
            "INSERT INTO coaching.coaches \
             (id, discord_user_id, discord_username, display_name, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, 'active', now(), now())",
        )
        .bind(coach_id)
        .bind(940301_i64)
        .bind("appt_notify_coach")
        .bind("Appt Coach")
        .execute(&pool)
        .await
        .expect("seed coach");
        sqlx::query(
            "INSERT INTO coaching.coachees \
             (id, discord_user_id, discord_username, display_name, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, now(), now())",
        )
        .bind(coachee_id)
        .bind(940302_i64)
        .bind("appt_notify_user")
        .bind("Appt User")
        .execute(&pool)
        .await
        .expect("seed coachee");
        sqlx::query(
            "INSERT INTO coaching.appointments \
             (id, coach_id, coachee_id, scheduled_at, duration_minutes, title, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, 60, $5, 'scheduled', now(), now())",
        )
        .bind(appointment_id)
        .bind(coach_id)
        .bind(coachee_id)
        .bind(scheduled_at)
        .bind("T8 Appointment")
        .execute(&pool)
        .await
        .expect("seed appointment");

        let due = request(
            Method::GET,
            "/api/coaching/platform/notifications/due",
            None,
        );
        let response = app.clone().oneshot(due).await.expect("due response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        let notification = body["notifications"]
            .as_array()
            .expect("notifications")
            .iter()
            .find(|item| item["type"] == "created" && item["appointment_id"] == appointment_id)
            .expect("created notification");
        assert_eq!(notification["discord_user_id"], 940302);
        let expected_scheduled_at = scheduled_at.to_rfc3339();
        assert_eq!(
            notification["scheduled_at"].as_str(),
            Some(expected_scheduled_at.as_str())
        );

        let ack = request(
            Method::POST,
            "/api/coaching/platform/notifications/ack",
            Some(json!({ "items": [{ "type": "created", "appointment_id": appointment_id }] })),
        );
        let response = app.oneshot(ack).await.expect("ack response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["acked"], 1);

        let notify_created_at: Option<chrono::DateTime<Utc>> =
            sqlx::query_scalar("SELECT notify_created_at FROM coaching.appointments WHERE id=$1")
                .bind(appointment_id)
                .fetch_one(&pool)
                .await
                .expect("notify created at");
        assert!(notify_created_at.is_some());
    }

    #[tokio::test]
    async fn boolean_felder_roundtrippen_postgres_typkonform() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);

        let tierlist = request(
            Method::POST,
            "/api/tierlists",
            Some(json!({
                "name": "Public T8",
                "is_public": true,
                "tiers": {"S": ["hero-a"]}
            })),
        );
        let response = app
            .clone()
            .oneshot(tierlist)
            .await
            .expect("tierlist response");
        assert_eq!(response.status(), StatusCode::OK);
        let tierlist_body = to_json(response).await;
        let tierlist_id = tierlist_body["id"]
            .as_str()
            .expect("tierlist id")
            .to_string();
        assert_eq!(tierlist_body["is_public"], true);

        let coach_id = "bool-coach-t8";
        let session_id = "bool-session-t8";
        sqlx::query(
            "INSERT INTO coaching.coaches \
             (id, discord_user_id, discord_username, display_name, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, 'active', now(), now())",
        )
        .bind(coach_id)
        .bind(940401_i64)
        .bind("bool_coach")
        .bind("Bool Coach")
        .execute(&pool)
        .await
        .expect("seed bool coach");
        sqlx::query(
            "INSERT INTO coaching.sessions \
             (id, coach_id, discord_user_id, discord_username, status, created_at) \
             VALUES ($1, $2, $3, $4, 'active', now())",
        )
        .bind(session_id)
        .bind(coach_id)
        .bind(940402_i64)
        .bind("bool_user")
        .execute(&pool)
        .await
        .expect("seed bool session");

        let survey = request(
            Method::POST,
            "/api/coaching/surveys",
            Some(json!({
                "session_id": session_id,
                "rating": 5,
                "feedback_text": "gut",
                "would_recommend": true
            })),
        );
        let response = app.clone().oneshot(survey).await.expect("survey response");
        assert_eq!(response.status(), StatusCode::OK);

        let coachee_id = "bool-coachee-t8";
        sqlx::query(
            "INSERT INTO coaching.coachees \
             (id, discord_user_id, discord_username, display_name, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, now(), now())",
        )
        .bind(coachee_id)
        .bind(940403_i64)
        .bind("bool_coachee")
        .bind("Bool Coachee")
        .execute(&pool)
        .await
        .expect("seed bool coachee");
        let goal = admin_request(
            Method::POST,
            &format!("/api/coaching/platform/coachees/{coachee_id}/goals"),
            Some(json!({ "title": "Bool Goal" })),
        );
        let response = app.clone().oneshot(goal).await.expect("goal response");
        assert_eq!(response.status(), StatusCode::OK);
        let goal_id = to_json(response).await["id"]
            .as_str()
            .expect("goal id")
            .to_string();
        let milestone = admin_request(
            Method::POST,
            &format!("/api/coaching/platform/goals/{goal_id}/milestones"),
            Some(json!({ "title": "Bool Milestone" })),
        );
        let response = app
            .clone()
            .oneshot(milestone)
            .await
            .expect("milestone response");
        assert_eq!(response.status(), StatusCode::OK);
        let milestone_id = to_json(response).await["id"]
            .as_str()
            .expect("milestone id")
            .to_string();
        let update = admin_request(
            Method::PATCH,
            &format!("/api/coaching/platform/milestones/{milestone_id}"),
            Some(json!({ "achieved": true })),
        );
        let response = app.oneshot(update).await.expect("milestone update");
        assert_eq!(response.status(), StatusCode::OK);

        let is_public: bool =
            sqlx::query_scalar("SELECT is_public FROM tierlist.meta_tier_lists WHERE id=$1")
                .bind(&tierlist_id)
                .fetch_one(&pool)
                .await
                .expect("is_public");
        let would_recommend: bool =
            sqlx::query_scalar("SELECT would_recommend FROM coaching.surveys WHERE session_id=$1")
                .bind(session_id)
                .fetch_one(&pool)
                .await
                .expect("would recommend");
        let achieved: bool =
            sqlx::query_scalar("SELECT achieved FROM coaching.milestones WHERE id=$1")
                .bind(&milestone_id)
                .fetch_one(&pool)
                .await
                .expect("achieved");
        assert!(is_public);
        assert!(would_recommend);
        assert!(achieved);
    }

    #[tokio::test]
    async fn reserved_until_und_scheduled_at_sind_echte_zeittypen() {
        let (_db, state) = test_state().await;
        let pool = state.pool.clone();
        let app = router(state);
        let scheduled_at = "2027-05-01T16:45:00Z";

        let sync = request(
            Method::POST,
            "/api/coaching/platform/sync",
            Some(json!({
                "bot_request_id": 7501,
                "discord_user_id": 950501,
                "discord_username": "time_type_user",
                "rank": "Oracle",
                "subrank": "2",
                "reserved_until": "2027-05-01T15:00:00Z"
            })),
        );
        let response = app.clone().oneshot(sync).await.expect("sync response");
        assert_eq!(response.status(), StatusCode::OK);

        let coachee_id = "time-type-coachee";
        sqlx::query(
            "INSERT INTO coaching.coachees \
             (id, discord_user_id, discord_username, display_name, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, now(), now()) \
             ON CONFLICT (discord_user_id) DO UPDATE SET id=EXCLUDED.id, updated_at=now()",
        )
        .bind(coachee_id)
        .bind(950501_i64)
        .bind("time_type_user")
        .bind("Time Type User")
        .execute(&pool)
        .await
        .expect("seed time coachee");
        let appointment = admin_request(
            Method::POST,
            "/api/coaching/platform/appointments",
            Some(json!({
                "coachee_id": coachee_id,
                "scheduled_at": scheduled_at,
                "duration_minutes": 45,
                "title": "Time Type"
            })),
        );
        let response = app
            .oneshot(appointment)
            .await
            .expect("appointment response");
        assert_eq!(response.status(), StatusCode::OK);
        let appointment_id = to_json(response).await["id"]
            .as_str()
            .expect("appointment id")
            .to_string();

        let reserved_until: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
            "SELECT reserved_until FROM coaching.requests WHERE bot_request_id=$1",
        )
        .bind(7501_i32)
        .fetch_one(&pool)
        .await
        .expect("reserved_until");
        let scheduled_at_db: chrono::DateTime<Utc> =
            sqlx::query_scalar("SELECT scheduled_at FROM coaching.appointments WHERE id=$1")
                .bind(&appointment_id)
                .fetch_one(&pool)
                .await
                .expect("scheduled_at");
        assert_eq!(
            reserved_until.map(|dt| dt.timestamp()),
            Some(
                Utc.with_ymd_and_hms(2027, 5, 1, 15, 0, 0)
                    .single()
                    .expect("reserved timestamp")
                    .timestamp()
            )
        );
        assert_eq!(
            scheduled_at_db.timestamp(),
            Utc.with_ymd_and_hms(2027, 5, 1, 16, 45, 0)
                .single()
                .expect("scheduled timestamp")
                .timestamp()
        );
    }

    async fn test_state() -> (dl_central_db::TestDb, AppState) {
        test_state_with(|_| {}, std::time::Duration::from_secs(20)).await
    }

    #[tokio::test]
    async fn twitch_pool_gibt_verbindungen_heraus_und_ist_nur_lesend() {
        // Der after_connect-Hook laeuft nur bei einer echten Verbindung, und der
        // Pool ist lazy: ein Fehler darin faellt beim Start nirgends auf, macht aber
        // jede Verbindung unbrauchbar und damit den ganzen Creator-Provider tot.
        // Deshalb hier eine echte Query gegen die Test-Postgres, statt den Pool nur
        // anzulegen. Die uebrigen Creator-Tests injizieren den Pool direkt und
        // umgehen connect_twitch_pool komplett.
        // Keine Wegwerf-DB: dieser Test schreibt nichts, er stellt nur eine
        // Verbindung her und liest zwei Session-Einstellungen.
        let dsn = std::env::var("CENTRAL_TEST_DSN")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .expect("CENTRAL_TEST_DSN oder DATABASE_URL muss auf die Test-Postgres zeigen");
        // Derselbe Schutz, den test_pool() mitbringt: nie gegen die
        // Produktionsdatenbank verbinden, auch nicht lesend.
        assert!(
            !dsn.trim_end_matches('/').ends_with("/deadlock"),
            "der Test-DSN zeigt auf die Produktionsdatenbank"
        );
        let mut cfg = Config::from_env();
        cfg.twitch_analytics_dsn = Some(dsn);
        let pool = connect_twitch_pool(&cfg).expect("twitch pool");

        let eins: i32 = sqlx::query_scalar("SELECT 1")
            .fetch_one(&pool)
            .await
            .expect("der after_connect-Hook muss durchlaufen, sonst gibt der Pool nichts heraus");
        assert_eq!(eins, 1);

        let read_only: String = sqlx::query_scalar("SHOW transaction_read_only")
            .fetch_one(&pool)
            .await
            .expect("read-only-Schalter");
        assert_eq!(read_only, "on", "der Pool darf nicht schreiben duerfen");

        let timeout: String = sqlx::query_scalar("SHOW statement_timeout")
            .fetch_one(&pool)
            .await
            .expect("statement_timeout");
        assert_eq!(
            timeout, "5s",
            "ohne Timeout kann eine haengende Fremd-DB die zentrale Lock halten"
        );
    }

    async fn creator_test_state() -> (dl_central_db::TestDb, AppState) {
        let discord_api_base = spawn_creator_role_api().await;
        test_state_with(
            move |cfg| {
                cfg.ddl_creator_role_id = Some(777);
                cfg.discord_bot_token = Some("test-bot-token".into());
                cfg.discord_api_base = discord_api_base;
            },
            std::time::Duration::from_millis(100),
        )
        .await
    }

    async fn playlist_mutation_test_state() -> (dl_central_db::TestDb, AppState, String) {
        let (db, state) = test_state_with(|_| {}, std::time::Duration::from_nanos(1)).await;
        sqlx::query("INSERT INTO core.meta_users(id,username,display_name,role) VALUES(940010,'playlist-admin','Playlist Admin','admin')")
            .execute(&state.pool)
            .await
            .expect("playlist admin");
        let token = state
            .auth
            .create_session_jwt(
                "940010",
                "playlist-admin",
                "admin",
                Some("Playlist Admin"),
                None,
            )
            .expect("playlist admin session");
        (db, state, token)
    }

    async fn test_state_with(
        configure: impl FnOnce(&mut Config),
        timeout: std::time::Duration,
    ) -> (dl_central_db::TestDb, AppState) {
        std::env::set_var("TWITCH_INTERNAL_API_TOKEN", "test-secret-xyz");
        std::env::set_var("AUTH_SESSION_SECRET", "test-session-secret");

        let db = dl_central_db::testing::test_pool()
            .await
            .expect("central test pool");
        db::init(db.pool()).await.expect("website migrations");
        let mut cfg = Config::from_env();
        configure(&mut cfg);
        let http = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .expect("http client");
        cfg.validate_startup().expect("test config validation");
        let scrim_http = scrim_http_client(&cfg).expect("scrim http client");
        let discord_role_broker =
            Arc::new(ReqwestDiscordRoleBroker::from_config(&cfg).expect("broker client"));
        let discord_role_connections =
            Arc::new(ReqwestDiscordRoleConnectionClient::from_config(&cfg).expect("role client"));
        let auth = Auth::new(cfg.clone());
        let state = AppState {
            inner: Arc::new(AppInner {
                cfg,
                pool: db.pool().clone(),
                http,
                scrim_http,
                discord_role_broker,
                discord_role_connections,
                twitch_pool: None,
                auth,
            }),
        };
        (db, state)
    }

    async fn spawn_creator_role_api() -> String {
        let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("creator role api listener");
        let addr = listener.local_addr().expect("creator role api addr");
        let app = axum::Router::new().route(
            "/guilds/{guild_id}/members/{user_id}",
            axum::routing::get(|| async { axum::Json(json!({ "roles": ["777"] })) }),
        );
        tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("creator role api server");
        });
        format!("http://{addr}")
    }

    fn request(method: Method, uri: &str, body: Option<Value>) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("X-Internal-Token", "test-secret-xyz")
            .header("Host", "deutsche-deadlock-community.de")
            .header("content-type", "application/json");
        let bytes = body.map(|v| v.to_string()).unwrap_or_default();
        let mut req = builder.body(Body::from(bytes)).expect("request");
        req.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        req
    }

    fn admin_request(method: Method, uri: &str, body: Option<Value>) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("X-Admin-Validated", "1")
            .header("X-Admin-User", "platform-admin")
            .header("Host", "admin.deutsche-deadlock-community.de")
            .header("content-type", "application/json");
        let bytes = body.map(|v| v.to_string()).unwrap_or_default();
        let mut req = builder.body(Body::from(bytes)).expect("request");
        req.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        req
    }

    fn authenticated_request(
        method: Method,
        uri: &str,
        token: &str,
        body: Option<Value>,
    ) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("Cookie", format!("ddc_session={token}"))
            .header("Host", "deutsche-deadlock-community.de")
            .header("Origin", "https://deutsche-deadlock-community.de")
            .header("content-type", "application/json");
        let bytes = body.map(|v| v.to_string()).unwrap_or_default();
        let mut req = builder.body(Body::from(bytes)).expect("request");
        req.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        req
    }

    async fn spawn_ban_api() -> String {
        let listener = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("ban api listener");
        let addr = listener.local_addr().expect("ban api addr");
        let app = axum::Router::new().route(
            "/internal/coaching/v1/no-show-ban",
            axum::routing::post(|| async { axum::Json(json!({ "banned": false })) }),
        );
        tokio::spawn(async move {
            axum::serve(listener, app).await.expect("ban api server");
        });
        format!("http://{addr}")
    }

    async fn to_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        serde_json::from_slice(&bytes).expect("json")
    }
}
