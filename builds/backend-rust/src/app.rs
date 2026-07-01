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
    use chrono::{TimeZone, Utc};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use super::*;
    use crate::rows;

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

    fn admin_request(method: Method, uri: &str, body: Option<Value>) -> Request<Body> {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header("X-Admin-Validated", "1")
            .header("X-Admin-User", "platform-admin")
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
