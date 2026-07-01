use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::Utc;
use constant_time_eq::constant_time_eq;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::{
    app::AppState,
    auth, config,
    error::{AppError, AppResult},
    ids, rows,
};

pub const COACHING_NO_SHOW_BAN_MESSAGE: &str =
    "Du bist aktuell für Coaching-Anfragen gesperrt und kannst derzeit keine neue Anfrage stellen.";
pub const COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE: &str =
    "Coaching-Anfragen sind gerade nicht verfügbar. Bitte später erneut versuchen.";

#[derive(Deserialize)]
pub struct CoachListQuery {
    specialty: Option<String>,
    min_rating: Option<f64>,
}

#[derive(Deserialize)]
pub struct RequestsQuery {
    status: Option<String>,
}

#[derive(Deserialize)]
pub struct MatchQuery {
    coach_id: String,
    discord_channel_id: Option<i64>,
}

#[derive(Deserialize)]
pub struct ApplicationReviewQuery {
    status: String,
}

const COACH_SELECT: &str = "\
    SELECT id, discord_user_id, discord_username, display_name, avatar_url, bio, \
           specialties_json, availability_json, status, avg_rating, total_reviews, \
           total_sessions, twitch_url, created_at, updated_at \
    FROM coaching.coaches";

const REQUEST_SELECT: &str = "\
    SELECT COALESCE(website_request_id, bot_request_id::text, request_uid) AS id, \
           request_uid, bot_request_id, website_request_id, discord_user_id, \
           discord_username, rank, subrank, hero, games_played, hours_played, \
           availability, current_problems, ai_summary, ai_insights_json, status, \
           preferred_coach_id, created_at, updated_at \
    FROM coaching.requests";

pub async fn list_coaches(
    State(state): State<AppState>,
    Query(query): Query<CoachListQuery>,
) -> AppResult<Json<Value>> {
    let rows = match (query.specialty, query.min_rating) {
        (Some(specialty), Some(min_rating)) => {
            let sql = format!(
                "{COACH_SELECT} WHERE status='active' AND specialties_json::text ILIKE $1 \
                 AND avg_rating >= $2 ORDER BY avg_rating DESC, total_sessions DESC"
            );
            sqlx::query(&sql)
                .bind(format!("%{specialty}%"))
                .bind(min_rating)
                .fetch_all(&state.pool)
                .await?
        }
        (Some(specialty), None) => {
            let sql = format!(
                "{COACH_SELECT} WHERE status='active' AND specialties_json::text ILIKE $1 \
                 ORDER BY avg_rating DESC, total_sessions DESC"
            );
            sqlx::query(&sql)
                .bind(format!("%{specialty}%"))
                .fetch_all(&state.pool)
                .await?
        }
        (None, Some(min_rating)) => {
            let sql = format!(
                "{COACH_SELECT} WHERE status='active' AND avg_rating >= $1 \
                 ORDER BY avg_rating DESC, total_sessions DESC"
            );
            sqlx::query(&sql)
                .bind(min_rating)
                .fetch_all(&state.pool)
                .await?
        }
        (None, None) => {
            let sql =
                format!("{COACH_SELECT} WHERE status='active' ORDER BY avg_rating DESC, total_sessions DESC");
            sqlx::query(&sql).fetch_all(&state.pool).await?
        }
    };
    Ok(Json(Value::Array(
        rows.iter().map(coach_from_row).collect(),
    )))
}

pub async fn get_coach(
    State(state): State<AppState>,
    Path(coach_id): Path<String>,
) -> AppResult<Json<Value>> {
    let sql = format!("{COACH_SELECT} WHERE id=$1");
    let row = sqlx::query(&sql)
        .bind(coach_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Coach not found"))?;
    Ok(Json(coach_from_row(&row)))
}

pub async fn get_coach_reviews(
    State(state): State<AppState>,
    Path(coach_id): Path<String>,
) -> AppResult<Json<Value>> {
    let rows = sqlx::query(
        "SELECT * FROM coaching.coach_reviews WHERE coach_id=$1 ORDER BY created_at DESC",
    )
    .bind(coach_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Value::Array(
        rows.iter().map(review_from_row).collect(),
    )))
}

pub async fn create_or_update_coach_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let discord_user_id = body
        .get("discord_user_id")
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::bad_request("discord_user_id is required"))?;
    if user.sub != discord_user_id.to_string() {
        return Err(AppError::forbidden(
            "Cannot create profile for another user",
        ));
    }
    let new_id = ids::id16();
    let row = sqlx::query(
        "INSERT INTO coaching.coaches \
         (id, discord_user_id, discord_username, display_name, avatar_url, bio, \
          specialties_json, availability_json, status, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', now(), now()) \
         ON CONFLICT (discord_user_id) DO UPDATE SET \
             discord_username=COALESCE(NULLIF(EXCLUDED.discord_username, ''), coaching.coaches.discord_username), \
             display_name=EXCLUDED.display_name, avatar_url=EXCLUDED.avatar_url, bio=EXCLUDED.bio, \
             specialties_json=EXCLUDED.specialties_json, availability_json=EXCLUDED.availability_json, \
             updated_at=now() \
         RETURNING id",
    )
    .bind(&new_id)
    .bind(discord_user_id)
    .bind(
        body.get("discord_username")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .bind(
        body.get("display_name")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .bind(body.get("avatar_url").and_then(Value::as_str))
    .bind(body.get("bio").and_then(Value::as_str))
    .bind(json_body_value(
        &body,
        &["specialties_json", "specialties"],
        json!([]),
    ))
    .bind(json_body_value(
        &body,
        &["availability_json", "availability"],
        json!({}),
    ))
    .fetch_one(&state.pool)
    .await?;
    let coach_id = rows::required_string(&row, "id");
    get_coach(State(state), Path(coach_id)).await
}

pub async fn apply_to_be_coach(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let discord_user_id = body
        .get("discord_user_id")
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::bad_request("discord_user_id is required"))?;
    if user.sub != discord_user_id.to_string() {
        return Err(AppError::forbidden(
            "Cannot submit application for another user",
        ));
    }

    let existing =
        sqlx::query("SELECT id, status FROM coaching.coach_applications WHERE discord_user_id=$1")
            .bind(discord_user_id)
            .fetch_optional(&state.pool)
            .await?;
    let app_id = if let Some(row) = existing {
        let status = rows::required_string(&row, "status");
        let id = rows::required_string(&row, "id");
        if matches!(status.as_str(), "approved" | "pending") {
            return Ok(Json(
                json!({ "id": id, "status": status, "message": "Application already submitted" }),
            ));
        }
        sqlx::query(
            "UPDATE coaching.coach_applications \
             SET application_text=$1, experience_text=$2, rank=$3, specialties_json=$4, \
                 availability_json=$5, status='pending', updated_at=now() \
             WHERE id=$6",
        )
        .bind(
            body.get("application_text")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .bind(
            body.get("experience_text")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .bind(body.get("rank").and_then(Value::as_str).unwrap_or_default())
        .bind(json_body_value(
            &body,
            &["specialties_json", "specialties"],
            json!([]),
        ))
        .bind(json_body_value(
            &body,
            &["availability_json", "availability"],
            json!({}),
        ))
        .bind(&id)
        .execute(&state.pool)
        .await?;
        id
    } else {
        let id = ids::id16();
        sqlx::query(
            "INSERT INTO coaching.coach_applications \
             (id, discord_user_id, discord_username, display_name, application_text, \
              experience_text, rank, specialties_json, availability_json, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', now(), now())",
        )
        .bind(&id)
        .bind(discord_user_id)
        .bind(body.get("discord_username").and_then(Value::as_str).unwrap_or_default())
        .bind(body.get("display_name").and_then(Value::as_str).unwrap_or_default())
        .bind(body.get("application_text").and_then(Value::as_str).unwrap_or_default())
        .bind(body.get("experience_text").and_then(Value::as_str).unwrap_or_default())
        .bind(body.get("rank").and_then(Value::as_str).unwrap_or_default())
        .bind(json_body_value(
            &body,
            &["specialties_json", "specialties"],
            json!([]),
        ))
        .bind(json_body_value(
            &body,
            &["availability_json", "availability"],
            json!({}),
        ))
        .execute(&state.pool)
        .await?;
        id
    };
    Ok(Json(
        json!({ "id": app_id, "status": "pending", "message": "Application submitted" }),
    ))
}

pub async fn create_coaching_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let (discord_user_id, discord_username) = if has_bot_token_header(&headers) {
        require_bot_token(&headers)?;
        let id = body
            .get("discord_user_id")
            .and_then(Value::as_i64)
            .ok_or_else(|| {
                AppError::http(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "discord_user_id and discord_username are required for bot requests",
                )
            })?;
        let username = body
            .get("discord_username")
            .and_then(Value::as_str)
            .filter(|v| !v.is_empty())
            .ok_or_else(|| {
                AppError::http(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    "discord_user_id and discord_username are required for bot requests",
                )
            })?;
        (id, username.to_string())
    } else {
        let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
        let id = user
            .sub
            .parse::<i64>()
            .map_err(|_| AppError::bad_request("Authenticated Discord user id is invalid"))?;
        let username = if user.username.trim().is_empty() {
            user.display_name
        } else {
            user.username
        };
        let ban_status = fetch_no_show_ban_status(&state, id).await?;
        if ban_status.get("banned").and_then(Value::as_bool) == Some(true) {
            return Err(AppError::forbidden(COACHING_NO_SHOW_BAN_MESSAGE));
        }
        (id, username)
    };

    let provided_request_id = body_string(&body, "id").map(str::to_string);
    let provided_website_request_id = body_string(&body, "website_request_id").map(str::to_string);
    let bot_request_id = optional_i32_body(&body, "bot_request_id")?;
    let website_request_id = provided_website_request_id
        .or(provided_request_id)
        .or_else(|| {
            if bot_request_id.is_none() {
                Some(ids::id16())
            } else {
                None
            }
        });
    validate_website_request_id(website_request_id.as_deref())?;
    let request_uid = website_request_id
        .clone()
        .unwrap_or_else(|| format!("bot:{}", bot_request_id.expect("bot request id present")));
    let response_id = website_request_id
        .clone()
        .or_else(|| bot_request_id.map(|id| id.to_string()))
        .unwrap_or_else(|| request_uid.clone());
    let rank = body.get("rank").and_then(Value::as_str).unwrap_or_default();
    let subrank = body
        .get("subrank")
        .and_then(Value::as_str)
        .unwrap_or_default();

    sqlx::query(
        "INSERT INTO coaching.requests \
         (request_uid, bot_request_id, website_request_id, discord_user_id, discord_username, \
          rank, subrank, hero, games_played, hours_played, availability, current_problems, \
          ai_summary, ai_insights_json, status, preferred_coach_id, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, \
                 'pending', $15, now(), now())",
    )
    .bind(&request_uid)
    .bind(bot_request_id)
    .bind(website_request_id.as_deref())
    .bind(discord_user_id)
    .bind(&discord_username)
    .bind(rank)
    .bind(subrank)
    .bind(body.get("hero").and_then(Value::as_str))
    .bind(body.get("games_played").and_then(Value::as_str))
    .bind(body.get("hours_played").and_then(Value::as_str))
    .bind(body.get("availability").and_then(Value::as_str))
    .bind(body.get("current_problems").and_then(Value::as_str))
    .bind(body.get("ai_summary").and_then(Value::as_str))
    .bind(json_body_value_opt(
        &body,
        &["ai_insights_json", "ai_insights"],
    ))
    .bind(body.get("preferred_coach_id").and_then(Value::as_str))
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({
        "id": response_id,
        "discord_username": discord_username,
        "rank": rank,
        "subrank": subrank,
        "hero": body.get("hero").cloned().unwrap_or(Value::Null),
        "games_played": body.get("games_played").cloned().unwrap_or(Value::Null),
        "hours_played": body.get("hours_played").cloned().unwrap_or(Value::Null),
        "availability": body.get("availability").cloned().unwrap_or(Value::Null),
        "current_problems": body.get("current_problems").cloned().unwrap_or(Value::Null),
        "ai_summary": body.get("ai_summary").cloned().unwrap_or(Value::Null),
        "status": "pending",
        "created_at": iso_now(),
    })))
}

pub async fn list_coaching_requests(
    State(state): State<AppState>,
    Query(query): Query<RequestsQuery>,
) -> AppResult<Json<Value>> {
    let rows = if let Some(status) = query.status {
        let sql = format!("{REQUEST_SELECT} WHERE status=$1 ORDER BY created_at DESC NULLS LAST");
        sqlx::query(&sql)
            .bind(status)
            .fetch_all(&state.pool)
            .await?
    } else {
        let sql = format!("{REQUEST_SELECT} ORDER BY created_at DESC NULLS LAST");
        sqlx::query(&sql).fetch_all(&state.pool).await?
    };
    Ok(Json(Value::Array(
        rows.iter().map(request_from_row).collect(),
    )))
}

pub async fn match_coach_to_request(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(request_id): Path<String>,
    Query(query): Query<MatchQuery>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let sql = format!(
        "{REQUEST_SELECT} \
         WHERE website_request_id=$1 OR bot_request_id::text=$1 OR request_uid=$1 \
         ORDER BY CASE \
             WHEN website_request_id=$1 THEN 0 \
             WHEN bot_request_id::text=$1 THEN 1 \
             ELSE 2 \
         END \
         LIMIT 1"
    );
    let row = sqlx::query(&sql)
        .bind(&request_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Request not found"))?;
    let session_id = ids::id16();
    let request_uid = rows::required_string(&row, "request_uid");
    let website_request_id = rows::string(&row, "website_request_id");
    let bot_request_id =
        rows::i64(&row, "bot_request_id").and_then(|value| i32::try_from(value).ok());
    sqlx::query(
        "INSERT INTO coaching.sessions \
         (id, request_uid, bot_request_id, website_request_id, coach_id, discord_user_id, \
          discord_username, discord_channel_id, status, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', now())",
    )
    .bind(&session_id)
    .bind(&request_uid)
    .bind(bot_request_id)
    .bind(website_request_id.as_deref())
    .bind(&query.coach_id)
    .bind(rows::i64(&row, "discord_user_id"))
    .bind(rows::string(&row, "discord_username"))
    .bind(query.discord_channel_id)
    .execute(&state.pool)
    .await?;
    sqlx::query(
        "UPDATE coaching.requests SET status='matched', updated_at=now() WHERE request_uid=$1",
    )
    .bind(request_uid)
    .execute(&state.pool)
    .await?;
    Ok(Json(
        json!({ "status": "matched", "session_id": session_id }),
    ))
}

pub async fn submit_survey(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let session_id = body
        .get("session_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let session = sqlx::query("SELECT * FROM coaching.sessions WHERE id=$1")
        .bind(&session_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Session not found"))?;
    let coach_id = rows::required_string(&session, "coach_id");
    let survey_id = ids::id16();
    let rating = i32_body_or_default(&body, "rating", 0)?;
    let would_recommend = body.get("would_recommend").and_then(Value::as_bool);
    sqlx::query(
        "INSERT INTO coaching.surveys \
         (id, session_id, rating, feedback_text, improved_areas, unresolved_items, \
          would_recommend, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())",
    )
    .bind(&survey_id)
    .bind(&session_id)
    .bind(rating)
    .bind(body.get("feedback_text").and_then(Value::as_str))
    .bind(body.get("improved_areas").and_then(Value::as_str))
    .bind(body.get("unresolved_items").and_then(Value::as_str))
    .bind(would_recommend)
    .execute(&state.pool)
    .await?;
    sqlx::query("UPDATE coaching.sessions SET status='completed', completed_at=now() WHERE id=$1")
        .bind(&session_id)
        .execute(&state.pool)
        .await?;
    let stats = sqlx::query(
        "SELECT AVG(rating)::float8 AS avg, COUNT(*)::bigint AS cnt \
         FROM coaching.surveys \
         WHERE session_id IN (SELECT id FROM coaching.sessions WHERE coach_id=$1)",
    )
    .bind(&coach_id)
    .fetch_one(&state.pool)
    .await?;
    let review_id = ids::id16();
    sqlx::query(
        "INSERT INTO coaching.coach_reviews \
         (id, coach_id, session_id, user_display_name, rating, feedback_text, improved_areas, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())",
    )
        .bind(&review_id)
        .bind(&coach_id)
        .bind(&session_id)
        .bind(anonymous_review_label(rows::i64(&session, "discord_user_id"), &coach_id))
        .bind(rating)
        .bind(body.get("feedback_text").and_then(Value::as_str))
        .bind(body.get("improved_areas").and_then(Value::as_str))
        .execute(&state.pool)
        .await?;
    if let Some(avg) = rows::f64(&stats, "avg") {
        sqlx::query(
            "UPDATE coaching.coaches \
             SET avg_rating=$1, total_reviews=$2, total_sessions=COALESCE(total_sessions, 0)+1, \
                 updated_at=now() \
             WHERE id=$3",
        )
        .bind(avg)
        .bind(
            rows::i64(&stats, "cnt")
                .and_then(|value| i32::try_from(value).ok())
                .unwrap_or(0),
        )
        .bind(coach_id)
        .execute(&state.pool)
        .await?;
    }
    Ok(Json(json!({ "status": "stored", "survey_id": survey_id })))
}

pub async fn get_coach_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let sql = format!("{COACH_SELECT} WHERE discord_user_id=$1");
    let coach = sqlx::query(&sql)
        .bind(user.sub.parse::<i64>().unwrap_or(0))
        .fetch_optional(&state.pool)
        .await?;
    let Some(coach) = coach else {
        return Ok(Json(
            json!({ "profile": null, "sessions": [], "reviews": [], "applications": [] }),
        ));
    };
    let coach_id = rows::required_string(&coach, "id");
    let sessions = sqlx::query(
        "SELECT * FROM coaching.sessions WHERE coach_id=$1 ORDER BY created_at DESC NULLS LAST LIMIT 10",
    )
    .bind(&coach_id)
    .fetch_all(&state.pool)
    .await?;
    let reviews = sqlx::query(
        "SELECT * FROM coaching.coach_reviews WHERE coach_id=$1 ORDER BY created_at DESC NULLS LAST LIMIT 5",
    )
    .bind(&coach_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({
        "profile": coach_from_row(&coach),
        "sessions": sessions.iter().map(rows::row_json).collect::<Vec<_>>(),
        "reviews": reviews.iter().map(review_from_row).collect::<Vec<_>>(),
    })))
}

pub async fn end_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    sqlx::query("UPDATE coaching.sessions SET status='completed', completed_at=now() WHERE id=$1")
        .bind(session_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "status": "completed" })))
}

pub async fn review_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(application_id): Path<String>,
    Query(query): Query<ApplicationReviewQuery>,
) -> AppResult<Json<Value>> {
    let user = auth::require_admin_user(&state, &headers, Some(peer)).await?;
    if !matches!(query.status.as_str(), "approved" | "rejected") {
        return Err(AppError::bad_request("Status must be approved or rejected"));
    }
    let app = sqlx::query("SELECT * FROM coaching.coach_applications WHERE id=$1")
        .bind(&application_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Application not found"))?;
    if query.status == "approved" {
        sqlx::query(
            "INSERT INTO coaching.coaches \
             (id, discord_user_id, discord_username, display_name, specialties_json, \
              availability_json, status, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, 'active', now(), now()) \
             ON CONFLICT (discord_user_id) DO UPDATE SET \
                 discord_username=EXCLUDED.discord_username, display_name=EXCLUDED.display_name, \
                 specialties_json=EXCLUDED.specialties_json, availability_json=EXCLUDED.availability_json, \
                 status='active', updated_at=now()",
        )
            .bind(ids::id16())
            .bind(rows::i64(&app, "discord_user_id"))
            .bind(rows::string(&app, "discord_username"))
            .bind(rows::string(&app, "display_name"))
            .bind(rows::json_or(&app, &["specialties_json"], json!([])))
            .bind(rows::json_or(&app, &["availability_json"], json!({})))
            .execute(&state.pool)
            .await?;
    }
    sqlx::query(
        "UPDATE coaching.coach_applications SET status=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3",
    )
        .bind(&query.status)
        .bind(user.sub)
        .bind(application_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "status": query.status })))
}

pub fn require_bot_token(headers: &HeaderMap) -> AppResult<()> {
    let secret = config::first_env(&[
        "TWITCH_INTERNAL_API_TOKEN",
        "MASTER_BROKER_TOKEN",
        "COACHING_BOT_TOKEN",
    ])
    .ok_or_else(|| AppError::service_unavailable("Internal API token is not configured"))?;
    let provided = headers
        .get("X-Internal-Token")
        .or_else(|| headers.get("X-Bot-Token"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !constant_time_eq(provided.as_bytes(), secret.as_bytes()) {
        return Err(AppError::unauthorized("Invalid internal token"));
    }
    Ok(())
}

pub fn has_bot_token_header(headers: &HeaderMap) -> bool {
    headers.contains_key("X-Internal-Token") || headers.contains_key("X-Bot-Token")
}

async fn fetch_no_show_ban_status(state: &AppState, discord_user_id: i64) -> AppResult<Value> {
    let token = config::first_env(&[
        "TURNIER_INTERNAL_API_TOKEN",
        "MAIN_BOT_INTERNAL_TOKEN",
        "TWITCH_INTERNAL_API_TOKEN",
        "MASTER_BROKER_TOKEN",
    ])
    .ok_or_else(|| AppError::service_unavailable(COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE))?;
    let url = format!(
        "{}/internal/coaching/v1/no-show-ban",
        state.cfg.dashboard_internal_api_base.trim_end_matches('/')
    );
    let response = state
        .http
        .post(url)
        .header("X-Internal-Token", token)
        .json(&json!({ "discord_user_id": discord_user_id }))
        .send()
        .await
        .map_err(|_| AppError::service_unavailable(COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE))?;
    if response.status() != StatusCode::OK {
        return Err(AppError::service_unavailable(
            COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE,
        ));
    }
    let data = response
        .json::<Value>()
        .await
        .map_err(|_| AppError::service_unavailable(COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE))?;
    if !data.get("banned").is_some_and(Value::is_boolean) {
        return Err(AppError::service_unavailable(
            COACHING_BAN_CHECK_UNAVAILABLE_MESSAGE,
        ));
    }
    Ok(data)
}

fn coach_from_row(row: &rows::DbRow) -> Value {
    json!({
        "id": rows::required_string(row, "id"),
        "display_name": rows::string(row, "display_name").or_else(|| rows::string(row, "discord_username")).unwrap_or_default(),
        "discord_username": rows::required_string(row, "discord_username"),
        "avatar_url": rows::value_from_row(row, "avatar_url"),
        "bio": rows::value_from_row(row, "bio"),
        "specialties": rows::json_or(row, &["specialties_json"], json!([])),
        "availability": rows::json_or(row, &["availability_json"], json!({})),
        "status": rows::required_string(row, "status"),
        "avg_rating": rows::f64(row, "avg_rating").unwrap_or(0.0),
        "total_reviews": rows::i64(row, "total_reviews").unwrap_or(0),
        "total_sessions": rows::i64(row, "total_sessions").unwrap_or(0),
        "twitch_url": rows::value_from_row(row, "twitch_url"),
    })
}

fn review_from_row(row: &rows::DbRow) -> Value {
    json!({
        "id": rows::required_string(row, "id"),
        "coach_id": rows::required_string(row, "coach_id"),
        "user_display_name": rows::string(row, "user_display_name").unwrap_or_else(|| "Anonymous".to_string()),
        "rating": rows::i64(row, "rating").unwrap_or(0),
        "feedback_text": rows::value_from_row(row, "feedback_text"),
        "improved_areas": rows::value_from_row(row, "improved_areas"),
        "created_at": rows::required_string(row, "created_at"),
    })
}

fn request_from_row(row: &rows::DbRow) -> Value {
    json!({
        "id": request_external_id(row),
        "discord_username": rows::required_string(row, "discord_username"),
        "rank": rows::required_string(row, "rank"),
        "subrank": rows::required_string(row, "subrank"),
        "hero": rows::value_from_row(row, "hero"),
        "games_played": rows::value_from_row(row, "games_played"),
        "hours_played": rows::value_from_row(row, "hours_played"),
        "availability": rows::value_from_row(row, "availability"),
        "current_problems": rows::value_from_row(row, "current_problems"),
        "ai_summary": rows::value_from_row(row, "ai_summary"),
        "status": rows::required_string(row, "status"),
        "created_at": rows::required_string(row, "created_at"),
    })
}

fn anonymous_review_label(discord_user_id: Option<i64>, coach_id: &str) -> String {
    let Some(discord_user_id) = discord_user_id else {
        return "Anonym".to_string();
    };
    let mut hasher = Sha256::new();
    hasher.update(format!("{discord_user_id}{coach_id}").as_bytes());
    let digest = hasher.finalize();
    format!(
        "Coachee #{:02x}{:02x}{:02x}",
        digest[0], digest[1], digest[2]
    )
}

fn json_body_value(body: &Value, names: &[&str], fallback: Value) -> Value {
    json_body_value_opt(body, names).unwrap_or(fallback)
}

fn json_body_value_opt(body: &Value, names: &[&str]) -> Option<Value> {
    for name in names {
        if let Some(value) = body.get(*name) {
            match value {
                Value::Null => {}
                Value::String(raw) if raw.trim().is_empty() => {}
                Value::String(raw) => {
                    return Some(
                        serde_json::from_str::<Value>(raw)
                            .unwrap_or_else(|_| Value::String(raw.clone())),
                    );
                }
                other => return Some(other.clone()),
            }
        }
    }
    None
}

fn body_string<'a>(body: &'a Value, name: &str) -> Option<&'a str> {
    body.get(name)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn validate_website_request_id(website_request_id: Option<&str>) -> AppResult<()> {
    if website_request_id.is_some_and(|value| value.starts_with("bot:")) {
        return Err(AppError::bad_request(
            "website_request_id must not start with bot:",
        ));
    }
    Ok(())
}

fn optional_i32_body(body: &Value, name: &str) -> AppResult<Option<i32>> {
    let Some(raw) = body.get(name) else {
        return Ok(None);
    };
    if raw.is_null() {
        return Ok(None);
    }
    let value = if let Some(value) = raw.as_i64() {
        value
    } else if let Some(value) = raw.as_str().and_then(|value| value.parse::<i64>().ok()) {
        value
    } else {
        return Err(AppError::bad_request(format!("{name} must be an integer")));
    };
    i32::try_from(value)
        .map(Some)
        .map_err(|_| AppError::bad_request(format!("{name} is out of range")))
}

fn i32_body_or_default(body: &Value, name: &str, default: i32) -> AppResult<i32> {
    optional_i32_body(body, name).map(|value| value.unwrap_or(default))
}

fn request_external_id(row: &rows::DbRow) -> String {
    rows::string(row, "id")
        .or_else(|| rows::string(row, "website_request_id"))
        .or_else(|| rows::string(row, "bot_request_id"))
        .or_else(|| rows::string(row, "request_uid"))
        .unwrap_or_default()
}

fn iso_now() -> String {
    Utc::now().to_rfc3339()
}
