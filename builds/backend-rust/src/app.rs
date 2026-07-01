use std::sync::Arc;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use reqwest::Client;
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

use crate::{auth::Auth, config::Config, db, routes};

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppInner>,
}

pub struct AppInner {
    pub cfg: Config,
    pub pool: PgPool,
    pub http: Client,
    pub auth: Auth,
}

impl AppState {
    pub async fn new(cfg: Config) -> anyhow::Result<Self> {
        let pool = db::connect().await?;
        db::init(&pool).await?;
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()?;
        let auth = Auth::new(cfg.clone());
        Ok(Self {
            inner: Arc::new(AppInner {
                cfg,
                pool,
                http,
                auth,
            }),
        })
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
        .route("/api/health", get(routes::health))
        .route("/api/auth/discord/login", get(routes::auth::discord_login))
        .route(
            "/api/auth/discord/callback",
            get(routes::auth::discord_callback),
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
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use std::{
        net::{IpAddr, Ipv4Addr, SocketAddr},
        sync::Arc,
    };

    use axum::{
        body::{to_bytes, Body},
        extract::connect_info::ConnectInfo,
        http::{Method, Request, StatusCode},
    };
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use super::*;

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

    async fn test_state() -> (dl_central_db::TestDb, AppState) {
        std::env::set_var("TWITCH_INTERNAL_API_TOKEN", "test-secret-xyz");
        std::env::set_var("AUTH_SESSION_SECRET", "test-session-secret");

        let db = dl_central_db::testing::test_pool()
            .await
            .expect("central test pool");
        let cfg = Config::from_env();
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("http client");
        let auth = Auth::new(cfg.clone());
        let state = AppState {
            inner: Arc::new(AppInner {
                cfg,
                pool: db.pool().clone(),
                http,
                auth,
            }),
        };
        (db, state)
    }

    fn request(method: Method, uri: &str, body: Option<Value>) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("X-Internal-Token", "test-secret-xyz")
            .header("content-type", "application/json");
        let bytes = body.map(|v| v.to_string()).unwrap_or_default();
        let mut req = builder.body(Body::from(bytes)).expect("request");
        req.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        req
    }

    async fn to_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        serde_json::from_slice(&bytes).expect("json")
    }
}
