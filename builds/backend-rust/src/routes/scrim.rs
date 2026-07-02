use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgRow, Row};

use crate::{
    app::AppState,
    auth::{self, User},
    error::{AppError, AppResult},
};

#[derive(Debug, Serialize)]
pub struct ScrimParticipant {
    pub id: i32,
    pub display_name: String,
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub status: String,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct ScrimTeam {
    pub id: i32,
    pub name: String,
    pub coach: Option<String>,
    pub discord_channel_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ScrimTeamMember {
    pub participant_id: i32,
    pub display_name: String,
    pub role: Option<String>,
    pub is_captain: bool,
    pub is_bench: bool,
}

#[derive(Debug, Serialize)]
pub struct ScrimNextMatch {
    pub id: i32,
    pub opponent_team_name: Option<String>,
    pub when_text: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ScrimMeResponse {
    pub participant: Option<ScrimParticipant>,
    pub team: Option<ScrimTeam>,
    pub members: Vec<ScrimTeamMember>,
    pub next_match: Option<ScrimNextMatch>,
}

#[derive(Debug, Serialize)]
pub struct ScrimPoolParticipant {
    pub id: i32,
    pub display_name: String,
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub status: String,
    pub source: String,
    pub team: Option<ScrimTeam>,
    pub role: Option<String>,
    pub is_captain: bool,
    pub is_bench: bool,
}

#[derive(Debug, Deserialize)]
pub struct ScrimSignupRequest {
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScrimPoolQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScrimParticipantPatch {
    pub status: Option<String>,
    pub team_id: Option<i32>,
    pub is_bench: Option<bool>,
    pub is_captain: Option<bool>,
}

pub async fn get_me(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<ScrimMeResponse>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let discord_id = parse_required_discord_id(&user)?;

    let participant_row = sqlx::query(PARTICIPANT_SELECT_BY_DISCORD)
        .bind(discord_id)
        .fetch_optional(&state.pool)
        .await?;

    let Some(participant_row) = participant_row else {
        return Ok(Json(ScrimMeResponse {
            participant: None,
            team: None,
            members: Vec::new(),
            next_match: None,
        }));
    };

    let participant = participant_from_row(&participant_row);
    let team_row = sqlx::query(
        "SELECT t.id, t.name, t.coach, t.discord_channel_id \
         FROM scrim.team_members tm \
         JOIN scrim.teams t ON t.id = tm.team_id \
         WHERE tm.participant_id=$1 \
         ORDER BY tm.team_id ASC \
         LIMIT 1",
    )
    .bind(participant.id)
    .fetch_optional(&state.pool)
    .await?;

    let (team, members, next_match) = if let Some(team_row) = team_row {
        let team = team_from_row(&team_row);
        let member_rows = sqlx::query(
            "SELECT tm.participant_id, p.display_name, tm.role, tm.is_captain, tm.is_bench \
             FROM scrim.team_members tm \
             JOIN scrim.participants p ON p.id = tm.participant_id \
             WHERE tm.team_id=$1 \
             ORDER BY tm.is_bench ASC, tm.is_captain DESC, p.display_name ASC, tm.participant_id ASC",
        )
        .bind(team.id)
        .fetch_all(&state.pool)
        .await?;
        let members = member_rows.iter().map(member_from_row).collect();
        let next_match = sqlx::query(
            "SELECT m.id, \
                    CASE WHEN m.team_a_id=$1 THEN tb.name ELSE ta.name END AS opponent_team_name, \
                    m.when_text, m.scheduled_at, m.status \
             FROM scrim.matches m \
             LEFT JOIN scrim.teams ta ON ta.id = m.team_a_id \
             LEFT JOIN scrim.teams tb ON tb.id = m.team_b_id \
             WHERE m.status='planned' AND (m.team_a_id=$1 OR m.team_b_id=$1) \
             ORDER BY m.scheduled_at ASC NULLS LAST, m.id ASC \
             LIMIT 1",
        )
        .bind(team.id)
        .fetch_optional(&state.pool)
        .await?
        .map(|row| ScrimNextMatch {
            id: row.get("id"),
            opponent_team_name: row.get("opponent_team_name"),
            when_text: row.get("when_text"),
            scheduled_at: row.get("scheduled_at"),
            status: row.get("status"),
        });
        (Some(team), members, next_match)
    } else {
        (None, Vec::new(), None)
    };

    Ok(Json(ScrimMeResponse {
        participant: Some(participant),
        team,
        members,
        next_match,
    }))
}

pub async fn signup(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ScrimSignupRequest>,
) -> AppResult<Json<ScrimParticipant>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let discord_id = parse_required_discord_id(&user)?;
    let mut tx = state.pool.begin().await?;

    // Gleicher Advisory-Key wie der Live-Reaktions-Hook (dl-community/reaction_roles.rs:475) — serialisiert Web-Signup gegen Discord-Reaktion. store.rs nutzt abweichend 42060004001 (Reconcile = separater Bot-Task).
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(0x4451_0008_0004_0001i64)
        .execute(&mut *tx)
        .await?;

    let participant_id: Option<i32> = sqlx::query_scalar(
        "SELECT id \
         FROM scrim.participants \
         WHERE discord_id=$1 \
         ORDER BY id ASC \
         LIMIT 1",
    )
    .bind(discord_id)
    .fetch_optional(&mut *tx)
    .await?;

    let participant_id = if let Some(participant_id) = participant_id {
        sqlx::query(
            "UPDATE scrim.participants \
             SET display_name=$2, rank=$3, roles=$4, availability=$5, updated_at=now() \
             WHERE id=$1",
        )
        .bind(participant_id)
        .bind(&user.display_name)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(body.availability.as_deref())
        .execute(&mut *tx)
        .await?;
        participant_id
    } else if let Some(participant_id) = sqlx::query_scalar(
        "SELECT id \
         FROM scrim.participants \
         WHERE display_name=$1 AND discord_id IS NULL \
         ORDER BY id ASC \
         LIMIT 1",
    )
    .bind(&user.display_name)
    .fetch_optional(&mut *tx)
    .await?
    {
        sqlx::query(
            "UPDATE scrim.participants \
             SET discord_id=$2, rank=$3, roles=$4, availability=$5, updated_at=now() \
             WHERE id=$1",
        )
        .bind(participant_id)
        .bind(discord_id)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(body.availability.as_deref())
        .execute(&mut *tx)
        .await?;
        participant_id
    } else {
        sqlx::query_scalar(
            "INSERT INTO scrim.participants( \
                 id, discord_id, display_name, rank, rank_source, rank_verified, roles, availability, \
                 status, source, created_at, updated_at \
             ) \
             VALUES( \
                 (SELECT COALESCE(MAX(id), 0) + 1 FROM scrim.participants), \
                 $1, $2, $3, 'self', false, $4, $5, 'new', 'web_form', now(), now() \
             ) \
             RETURNING id",
        )
        .bind(discord_id)
        .bind(&user.display_name)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(body.availability.as_deref())
        .fetch_one(&mut *tx)
        .await?
    };

    let row = sqlx::query(PARTICIPANT_SELECT_BY_ID)
        .bind(participant_id)
        .fetch_one(&mut *tx)
        .await?;
    let participant = participant_from_row(&row);
    tx.commit().await?;

    Ok(Json(participant))
}

pub async fn pool(
    State(state): State<AppState>,
    Query(query): Query<ScrimPoolQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Vec<ScrimPoolParticipant>>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let rows = sqlx::query(POOL_SELECT)
        .bind(query.status.as_deref())
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(rows.iter().map(pool_participant_from_row).collect()))
}

pub async fn patch_participant(
    State(state): State<AppState>,
    Path(participant_id): Path<i32>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ScrimParticipantPatch>,
) -> AppResult<Json<ScrimPoolParticipant>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let mut tx = state.pool.begin().await?;
    let participant_exists: Option<i32> =
        sqlx::query_scalar("SELECT 1 FROM scrim.participants WHERE id=$1")
            .bind(participant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if participant_exists.is_none() {
        return Err(AppError::not_found("Platzhalter"));
    }

    if let Some(status) = body.status.as_deref() {
        sqlx::query("UPDATE scrim.participants SET status=$2, updated_at=now() WHERE id=$1")
            .bind(participant_id)
            .bind(status)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(team_id) = body.team_id {
        let team_exists: Option<i32> = sqlx::query_scalar("SELECT 1 FROM scrim.teams WHERE id=$1")
            .bind(team_id)
            .fetch_optional(&mut *tx)
            .await?;
        if team_exists.is_none() {
            return Err(AppError::not_found("Platzhalter"));
        }

        sqlx::query("DELETE FROM scrim.team_members WHERE participant_id=$1 AND team_id<>$2")
            .bind(participant_id)
            .bind(team_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO scrim.team_members(team_id, participant_id, role, is_captain, is_bench) \
             VALUES($1, $2, NULL, COALESCE($3, false), COALESCE($4, false)) \
             ON CONFLICT (team_id, participant_id) DO UPDATE SET \
                 is_captain=COALESCE($3, scrim.team_members.is_captain), \
                 is_bench=COALESCE($4, scrim.team_members.is_bench)",
        )
        .bind(team_id)
        .bind(participant_id)
        .bind(body.is_captain)
        .bind(body.is_bench)
        .execute(&mut *tx)
        .await?;
    } else if body.is_bench.is_some() || body.is_captain.is_some() {
        sqlx::query(
            "UPDATE scrim.team_members \
             SET is_captain=COALESCE($2, is_captain), is_bench=COALESCE($3, is_bench) \
             WHERE participant_id=$1",
        )
        .bind(participant_id)
        .bind(body.is_captain)
        .bind(body.is_bench)
        .execute(&mut *tx)
        .await?;
    }

    let row = sqlx::query(POOL_SELECT_BY_ID)
        .bind(participant_id)
        .fetch_one(&mut *tx)
        .await?;
    let participant = pool_participant_from_row(&row);
    tx.commit().await?;

    Ok(Json(participant))
}

const PARTICIPANT_SELECT_BY_ID: &str = "\
    SELECT id, display_name, rank, roles, availability, status, source \
    FROM scrim.participants \
    WHERE id=$1";

const PARTICIPANT_SELECT_BY_DISCORD: &str = "\
    SELECT id, display_name, rank, roles, availability, status, source \
    FROM scrim.participants \
    WHERE discord_id=$1 \
    ORDER BY id ASC \
    LIMIT 1";

const POOL_SELECT: &str = "\
    SELECT p.id, p.display_name, p.rank, p.roles, p.availability, p.status, p.source, \
           t.id AS team_id, t.name AS team_name, t.coach AS team_coach, \
           t.discord_channel_id AS team_discord_channel_id, \
           tm.role AS team_member_role, \
           COALESCE(tm.is_captain, false) AS is_captain, \
           COALESCE(tm.is_bench, false) AS is_bench \
    FROM scrim.participants p \
    LEFT JOIN LATERAL ( \
        SELECT team_id, role, is_captain, is_bench \
        FROM scrim.team_members \
        WHERE participant_id=p.id \
        ORDER BY team_id ASC \
        LIMIT 1 \
    ) tm ON true \
    LEFT JOIN scrim.teams t ON t.id = tm.team_id \
    WHERE ($1::text IS NULL OR p.status=$1) \
    ORDER BY p.created_at DESC, p.id DESC";

const POOL_SELECT_BY_ID: &str = "\
    SELECT p.id, p.display_name, p.rank, p.roles, p.availability, p.status, p.source, \
           t.id AS team_id, t.name AS team_name, t.coach AS team_coach, \
           t.discord_channel_id AS team_discord_channel_id, \
           tm.role AS team_member_role, \
           COALESCE(tm.is_captain, false) AS is_captain, \
           COALESCE(tm.is_bench, false) AS is_bench \
    FROM scrim.participants p \
    LEFT JOIN LATERAL ( \
        SELECT team_id, role, is_captain, is_bench \
        FROM scrim.team_members \
        WHERE participant_id=p.id \
        ORDER BY team_id ASC \
        LIMIT 1 \
    ) tm ON true \
    LEFT JOIN scrim.teams t ON t.id = tm.team_id \
    WHERE p.id=$1";

async fn require_scrim_coach(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<User> {
    let user = auth::require_authenticated_user(state, headers, peer).await?;
    if is_coach(state, &user).await? {
        return Ok(user);
    }
    Err(AppError::http(StatusCode::FORBIDDEN, "Platzhalter"))
}

async fn is_coach(state: &AppState, user: &User) -> AppResult<bool> {
    if user.role == "admin" {
        return Ok(true);
    }
    let Ok(discord_id) = parse_discord_id(&user.id) else {
        return Ok(false);
    };
    let exists: Option<i32> = sqlx::query_scalar(
        "SELECT 1 FROM coaching.coaches WHERE discord_user_id=$1 AND status='active'",
    )
    .bind(discord_id)
    .fetch_optional(&state.pool)
    .await?;
    Ok(exists.is_some())
}

fn parse_required_discord_id(user: &User) -> AppResult<i64> {
    parse_discord_id(&user.id).map_err(|_| AppError::bad_request("Platzhalter"))
}

fn parse_discord_id(value: &str) -> Result<i64, std::num::ParseIntError> {
    value.trim().parse::<i64>()
}

fn participant_from_row(row: &PgRow) -> ScrimParticipant {
    ScrimParticipant {
        id: row.get("id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        availability: row.get("availability"),
        status: row.get("status"),
        source: row.get("source"),
    }
}

fn team_from_row(row: &PgRow) -> ScrimTeam {
    ScrimTeam {
        id: row.get("id"),
        name: row.get("name"),
        coach: row.get("coach"),
        discord_channel_id: row.get("discord_channel_id"),
    }
}

fn member_from_row(row: &PgRow) -> ScrimTeamMember {
    ScrimTeamMember {
        participant_id: row.get("participant_id"),
        display_name: row.get("display_name"),
        role: row.get("role"),
        is_captain: row.get("is_captain"),
        is_bench: row.get("is_bench"),
    }
}

fn pool_participant_from_row(row: &PgRow) -> ScrimPoolParticipant {
    let team_id: Option<i32> = row.get("team_id");
    ScrimPoolParticipant {
        id: row.get("id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        availability: row.get("availability"),
        status: row.get("status"),
        source: row.get("source"),
        team: team_id.map(|id| ScrimTeam {
            id,
            name: row.get("team_name"),
            coach: row.get("team_coach"),
            discord_channel_id: row.get("team_discord_channel_id"),
        }),
        role: row.get("team_member_role"),
        is_captain: row.get("is_captain"),
        is_bench: row.get("is_bench"),
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeSet,
        net::{IpAddr, Ipv4Addr, SocketAddr},
    };

    use axum::{
        body::{to_bytes, Body},
        extract::connect_info::ConnectInfo,
        http::{Method, Request, StatusCode},
    };
    use serde_json::{json, Value};
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::*;
    use crate::{app::router, config::Config};

    #[test]
    fn scrim_me_response_json_shape_is_stable() {
        let response = ScrimMeResponse {
            participant: Some(ScrimParticipant {
                id: 1,
                display_name: "Participant One".to_string(),
                rank: Some("Oracle".to_string()),
                roles: Some("Flex".to_string()),
                availability: None,
                status: "assigned".to_string(),
                source: "web_form".to_string(),
            }),
            team: Some(ScrimTeam {
                id: 10,
                name: "Team One".to_string(),
                coach: Some("Coach".to_string()),
                discord_channel_id: Some(123),
            }),
            members: vec![ScrimTeamMember {
                participant_id: 1,
                display_name: "Participant One".to_string(),
                role: Some("Flex".to_string()),
                is_captain: true,
                is_bench: false,
            }],
            next_match: Some(ScrimNextMatch {
                id: 77,
                opponent_team_name: Some("Team Two".to_string()),
                when_text: Some("Freitag".to_string()),
                scheduled_at: Some("2027-01-01T18:00:00Z".parse().expect("datetime")),
                status: "planned".to_string(),
            }),
        };

        let value = serde_json::to_value(response).expect("serialize response");
        assert_exact_keys(&value, &["participant", "team", "members", "next_match"]);
        assert_exact_keys(
            &value["participant"],
            &[
                "id",
                "display_name",
                "rank",
                "roles",
                "availability",
                "status",
                "source",
            ],
        );
        assert_exact_keys(
            &value["team"],
            &["id", "name", "coach", "discord_channel_id"],
        );
        assert_exact_keys(
            &value["members"][0],
            &[
                "participant_id",
                "display_name",
                "role",
                "is_captain",
                "is_bench",
            ],
        );
        assert_exact_keys(
            &value["next_match"],
            &[
                "id",
                "opponent_team_name",
                "when_text",
                "scheduled_at",
                "status",
            ],
        );
        assert!(value["participant"]["id"].is_number());
        assert!(value["participant"]["availability"].is_null());
        assert!(value["members"][0]["is_captain"].is_boolean());
        assert!(value["next_match"]["scheduled_at"].is_string());
    }

    #[test]
    fn scrim_pool_response_json_shape_is_stable() {
        let participant = ScrimPoolParticipant {
            id: 2,
            display_name: "Pool Participant".to_string(),
            rank: None,
            roles: Some("Duo".to_string()),
            availability: Some("Abends".to_string()),
            status: "new".to_string(),
            source: "discord_reaction".to_string(),
            team: None,
            role: None,
            is_captain: false,
            is_bench: false,
        };

        let value = serde_json::to_value(participant).expect("serialize participant");
        assert_exact_keys(
            &value,
            &[
                "id",
                "display_name",
                "rank",
                "roles",
                "availability",
                "status",
                "source",
                "team",
                "role",
                "is_captain",
                "is_bench",
            ],
        );
        assert!(value["id"].is_number());
        assert!(value["rank"].is_null());
        assert!(value["team"].is_null());
        assert!(value["is_bench"].is_boolean());
    }

    #[tokio::test]
    async fn scrim_handlers_execute_real_sql_and_signup_is_idempotent() {
        let Some(state) = test_state().await else {
            return;
        };
        let app = router(state.clone());

        let user_token = state
            .auth
            .create_session_jwt("1111", "scrim_user", "user", Some("Scrim User"), None)
            .expect("user token");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/me",
                &user_token,
                None,
            ))
            .await
            .expect("me response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["participant"]["id"], 1);
        assert_eq!(body["team"]["name"], "Alpha");
        assert_eq!(body["members"].as_array().expect("members").len(), 2);
        assert_eq!(body["next_match"]["opponent_team_name"], "Beta");

        let signup_token = state
            .auth
            .create_session_jwt("3333", "signup_user", "user", Some("Signup User"), None)
            .expect("signup token");
        for rank in ["Oracle", "Phantom"] {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::POST,
                    "/api/scrim/signup",
                    &signup_token,
                    Some(json!({
                        "rank": rank,
                        "roles": "Flex",
                        "availability": "Abends"
                    })),
                ))
                .await
                .expect("signup response");
            assert_eq!(response.status(), StatusCode::OK);
            let body = to_json(response).await;
            assert_eq!(body["display_name"], "Signup User");
            assert_eq!(body["rank"], rank);
        }
        let signup_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM scrim.participants WHERE discord_id=$1")
                .bind(3333_i64)
                .fetch_one(&state.pool)
                .await
                .expect("signup count");
        assert_eq!(signup_count, 1);

        let regular_response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool",
                &user_token,
                None,
            ))
            .await
            .expect("regular pool response");
        assert_eq!(regular_response.status(), StatusCode::FORBIDDEN);

        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool?status=new",
                &coach_token,
                None,
            ))
            .await
            .expect("pool response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        let pool = body.as_array().expect("pool array");
        assert!(pool
            .iter()
            .any(|participant| participant["display_name"] == "Signup User"));

        let signup_id: i32 =
            sqlx::query_scalar("SELECT id FROM scrim.participants WHERE discord_id=$1")
                .bind(3333_i64)
                .fetch_one(&state.pool)
                .await
                .expect("signup id");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PATCH,
                &format!("/api/scrim/participants/{signup_id}"),
                &coach_token,
                Some(json!({
                    "status": "assigned",
                    "team_id": 1,
                    "is_bench": true,
                    "is_captain": false
                })),
            ))
            .await
            .expect("patch response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["status"], "assigned");
        assert_eq!(body["team"]["id"], 1);
        assert_eq!(body["is_bench"], true);
        assert_eq!(body["is_captain"], false);

        sqlx::query("ALTER TABLE scrim.participants DROP COLUMN source")
            .execute(&state.pool)
            .await
            .expect("drop drift column");
        let response = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/me",
                &user_token,
                None,
            ))
            .await
            .expect("drift response");
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    async fn test_state() -> Option<AppState> {
        let database_url = match std::env::var("DATABASE_URL_TEST") {
            Ok(value) if !value.trim().is_empty() => value,
            _ => {
                eprintln!("DATABASE_URL_TEST nicht gesetzt; Scrim-DB-Test wird uebersprungen");
                return None;
            }
        };

        assert_throwaway_database_url(&database_url);
        std::env::set_var("AUTH_SESSION_SECRET", "scrim-test-session-secret");
        let pool = PgPoolOptions::new()
            .max_connections(4)
            .connect(&database_url)
            .await
            .expect("connect DATABASE_URL_TEST");
        reset_database(&pool).await;
        seed_database(&pool).await;
        Some(AppState::for_test_pool(pool, Config::from_env()))
    }

    fn assert_throwaway_database_url(database_url: &str) {
        let parsed = url::Url::parse(database_url)
            .unwrap_or_else(|err| panic!("DATABASE_URL_TEST konnte nicht geparst werden: {err}"));
        let database_name = parsed
            .path_segments()
            .and_then(|mut segments| segments.next_back())
            .unwrap_or("");
        assert!(
            database_name.to_ascii_lowercase().contains("test"),
            "DATABASE_URL_TEST zeigt nicht auf eine Wegwerf-Test-DB (Name muss 'test' enthalten) — Abbruch, um Datenverlust zu verhindern"
        );
    }

    async fn reset_database(pool: &sqlx::PgPool) {
        for statement in SCRIM_TEST_DDL {
            sqlx::query(statement)
                .execute(pool)
                .await
                .unwrap_or_else(|err| panic!("DDL failed: {statement}: {err}"));
        }
    }

    async fn seed_database(pool: &sqlx::PgPool) {
        sqlx::query(
            "INSERT INTO coaching.coaches \
             (id, discord_user_id, discord_username, display_name, status, created_at, updated_at) \
             VALUES ('coach-9000', 9000, 'coach_user', 'Coach User', 'active', now(), now())",
        )
        .execute(pool)
        .await
        .expect("seed coach");
        sqlx::query(
            "INSERT INTO scrim.participants \
             (id, discord_id, display_name, rank, rank_source, rank_verified, roles, availability, status, source, created_at, updated_at) \
             VALUES \
             (1, 1111, 'Scrim User', 'Oracle', 'self', false, 'Flex', 'Abends', 'assigned', 'seed', now(), now()), \
             (2, NULL, 'Team Mate', NULL, 'self', false, NULL, NULL, 'assigned', 'seed', now(), now()), \
             (3, 2222, 'Free Agent', NULL, 'self', false, NULL, NULL, 'new', 'seed', now(), now())",
        )
        .execute(pool)
        .await
        .expect("seed participants");
        sqlx::query(
            "INSERT INTO scrim.teams(id, name, coach, discord_role_id, discord_channel_id, created_at) \
             VALUES \
             (1, 'Alpha', 'Coach A', 101, 201, now()), \
             (2, 'Beta', 'Coach B', 102, 202, now())",
        )
        .execute(pool)
        .await
        .expect("seed teams");
        sqlx::query(
            "INSERT INTO scrim.team_members(team_id, participant_id, role, is_captain, is_bench) \
             VALUES (1, 1, 'Flex', true, false), (1, 2, NULL, false, false)",
        )
        .execute(pool)
        .await
        .expect("seed team members");
        sqlx::query(
            "INSERT INTO scrim.matches(id, team_a_id, team_b_id, when_text, scheduled_at, status, created_at) \
             VALUES \
             (10, 1, 2, 'Morgen', '2027-01-01T18:00:00Z', 'planned', now()), \
             (11, 1, NULL, 'Spaeter', '2027-01-02T18:00:00Z', 'planned', now())",
        )
        .execute(pool)
        .await
        .expect("seed matches");
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
            .header("content-type", "application/json");
        let bytes = body.map(|value| value.to_string()).unwrap_or_default();
        let mut request = builder.body(Body::from(bytes)).expect("request");
        request.extensions_mut().insert(ConnectInfo(SocketAddr::new(
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            12345,
        )));
        request
    }

    async fn to_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        serde_json::from_slice(&bytes).expect("json")
    }

    fn assert_exact_keys(value: &Value, expected: &[&str]) {
        let actual = value
            .as_object()
            .expect("object")
            .keys()
            .map(String::as_str)
            .collect::<BTreeSet<_>>();
        let expected = expected.iter().copied().collect::<BTreeSet<_>>();
        assert_eq!(actual, expected);
    }

    const SCRIM_TEST_DDL: &[&str] = &[
        "DROP SCHEMA IF EXISTS scrim CASCADE",
        "DROP SCHEMA IF EXISTS coaching CASCADE",
        "DROP SCHEMA IF EXISTS core CASCADE",
        "CREATE SCHEMA core",
        "CREATE TABLE core.meta_users (\
             id BIGINT PRIMARY KEY, \
             username TEXT, \
             display_name TEXT, \
             avatar_url TEXT, \
             role TEXT, \
             created_at TIMESTAMPTZ NOT NULL DEFAULT now(), \
             updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\
         )",
        "CREATE SCHEMA coaching",
        "CREATE TABLE coaching.coaches (\
             id TEXT PRIMARY KEY, \
             discord_user_id BIGINT UNIQUE, \
             discord_username TEXT, \
             display_name TEXT, \
             avatar_url TEXT, \
             bio TEXT, \
             specialties_json JSONB, \
             availability_json JSONB, \
             status TEXT, \
             avg_rating DOUBLE PRECISION, \
             total_reviews INTEGER, \
             total_sessions INTEGER, \
             twitch_url TEXT, \
             website_coach_id TEXT, \
             created_at TIMESTAMPTZ, \
             updated_at TIMESTAMPTZ\
         )",
        "CREATE INDEX coaches_status_idx ON coaching.coaches (status)",
        "CREATE SCHEMA scrim",
        "CREATE TABLE scrim.participants (\
             id INTEGER PRIMARY KEY, \
             discord_id BIGINT, \
             display_name TEXT NOT NULL, \
             rank TEXT, \
             rank_source TEXT NOT NULL, \
             rank_verified BOOLEAN NOT NULL DEFAULT false, \
             roles TEXT, \
             availability TEXT, \
             status TEXT NOT NULL, \
             source TEXT NOT NULL, \
             created_at TIMESTAMPTZ NOT NULL, \
             updated_at TIMESTAMPTZ NOT NULL\
         )",
        "CREATE INDEX participants_discord_id_idx ON scrim.participants (discord_id)",
        "CREATE TABLE scrim.teams (\
             id INTEGER PRIMARY KEY, \
             name TEXT NOT NULL, \
             coach TEXT, \
             discord_role_id BIGINT, \
             discord_channel_id BIGINT, \
             created_at TIMESTAMPTZ NOT NULL\
         )",
        "CREATE TABLE scrim.team_members (\
             team_id INTEGER NOT NULL, \
             participant_id INTEGER NOT NULL, \
             role TEXT, \
             is_captain BOOLEAN NOT NULL DEFAULT false, \
             is_bench BOOLEAN NOT NULL DEFAULT false, \
             PRIMARY KEY (team_id, participant_id)\
         )",
        "CREATE INDEX team_members_participant_id_idx ON scrim.team_members (participant_id)",
        "CREATE TABLE scrim.matches (\
             id INTEGER PRIMARY KEY, \
             team_a_id INTEGER, \
             team_b_id INTEGER, \
             when_text TEXT, \
             scheduled_at TIMESTAMPTZ, \
             status TEXT NOT NULL, \
             created_at TIMESTAMPTZ NOT NULL\
         )",
        "CREATE INDEX matches_team_a_id_idx ON scrim.matches (team_a_id)",
        "CREATE INDEX matches_team_b_id_idx ON scrim.matches (team_b_id)",
    ];
}
