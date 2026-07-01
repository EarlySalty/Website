use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{postgres::PgArguments, Postgres};

use crate::{
    app::AppState,
    auth::{self, User},
    error::{AppError, AppResult},
    ids,
    routes::coaching::require_bot_token,
    rows,
};

#[derive(Deserialize)]
pub struct AppointmentQuery {
    scope: Option<String>,
}

pub async fn platform_sync(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let bot_request_id = optional_i32_body(&body, "bot_request_id")?;
    let website_request_id = body_string(&body, "website_request_id").map(str::to_string);
    validate_website_request_id(website_request_id.as_deref())?;
    let explicit_request_uid = body_string(&body, "request_uid").map(str::to_string);
    if bot_request_id.is_none() && website_request_id.is_none() && explicit_request_uid.is_none() {
        return Err(AppError::bad_request(
            "website_request_id, bot_request_id or request_uid is required",
        ));
    }
    let discord_user_id = body
        .get("discord_user_id")
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::bad_request("discord_user_id is required"))?;
    let discord_username = body.get("discord_username").and_then(Value::as_str);
    let assigned_id = body
        .get("assigned_coach_discord_id")
        .and_then(Value::as_i64)
        .map(|id| id.to_string())
        .or_else(|| {
            body.get("assigned_coach_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
    let status = body
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("analyzed");
    let reserved_until = optional_datetime_body(&body, "reserved_until")?;
    let coachee_id = upsert_coachee(&state, discord_user_id, discord_username).await?;
    let existing_request = find_request_by_references(
        &state,
        website_request_id.as_deref(),
        bot_request_id,
        explicit_request_uid.as_deref(),
    )
    .await?;
    let request_uid_for_insert = if website_request_id.is_none() && bot_request_id.is_none() {
        explicit_request_uid.as_deref()
    } else {
        None
    };
    let request_uid = existing_request
        .as_ref()
        .map(|row| rows::required_string(row, "request_uid"))
        .unwrap_or_else(|| {
            new_request_uid(
                website_request_id.as_deref(),
                bot_request_id,
                request_uid_for_insert,
            )
        });
    let stored_website_request_id = existing_request
        .as_ref()
        .and_then(|row| rows::string(row, "website_request_id"))
        .or_else(|| website_request_id.clone());
    let stored_bot_request_id = existing_request
        .as_ref()
        .and_then(|row| rows::i64(row, "bot_request_id"))
        .and_then(|value| i32::try_from(value).ok())
        .or(bot_request_id);
    let ai_insights = json_body_value_opt(&body, &["ai_insights_json", "ai_insights"]);

    if existing_request.is_some() {
        sqlx::query(
            "UPDATE coaching.requests \
             SET bot_request_id=COALESCE( \
                     bot_request_id, \
                     CASE WHEN $1 IS NOT NULL AND NOT EXISTS ( \
                         SELECT 1 FROM coaching.requests other \
                         WHERE other.bot_request_id=$1 \
                           AND other.request_uid<>coaching.requests.request_uid \
                     ) THEN $1 ELSE NULL END \
                 ), \
                 website_request_id=COALESCE( \
                     website_request_id, \
                     CASE WHEN $2 IS NOT NULL AND NOT EXISTS ( \
                         SELECT 1 FROM coaching.requests other \
                         WHERE other.website_request_id=$2 \
                           AND other.request_uid<>coaching.requests.request_uid \
                     ) THEN $2 ELSE NULL END \
                 ), \
                 discord_user_id=$3, discord_username=$4, rank=$5, subrank=$6, hero=$7, \
                 games_played=$8, hours_played=$9, availability=$10, current_problems=$11, \
                 ai_summary=$12, ai_insights_json=COALESCE($13, ai_insights_json), \
                 status=$14, assigned_coach_id=$15, assigned_coach_username=$16, \
                 reserved_until=$17, coachee_id=$18, updated_at=now() \
             WHERE request_uid=$19",
        )
        .bind(stored_bot_request_id)
        .bind(stored_website_request_id.as_deref())
        .bind(discord_user_id)
        .bind(discord_username)
        .bind(body.get("rank").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("subrank").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("hero").and_then(Value::as_str))
        .bind(body.get("games_played").and_then(Value::as_str))
        .bind(body.get("hours_played").and_then(Value::as_str))
        .bind(body.get("availability").and_then(Value::as_str))
        .bind(body.get("current_problems").and_then(Value::as_str))
        .bind(body.get("ai_summary").and_then(Value::as_str))
        .bind(ai_insights.clone())
        .bind(status)
        .bind(assigned_id.as_deref())
        .bind(body.get("assigned_coach_username").and_then(Value::as_str))
        .bind(reserved_until)
        .bind(&coachee_id)
        .bind(&request_uid)
        .execute(&state.pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO coaching.requests \
             (request_uid, bot_request_id, website_request_id, discord_user_id, discord_username, \
              rank, subrank, hero, games_played, hours_played, availability, current_problems, \
              ai_summary, ai_insights_json, status, assigned_coach_id, assigned_coach_username, \
              reserved_until, coachee_id, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, \
                     $15, $16, $17, $18, $19, now(), now())",
        )
        .bind(&request_uid)
        .bind(stored_bot_request_id)
        .bind(stored_website_request_id.as_deref())
        .bind(discord_user_id)
        .bind(discord_username)
        .bind(body.get("rank").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("subrank").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("hero").and_then(Value::as_str))
        .bind(body.get("games_played").and_then(Value::as_str))
        .bind(body.get("hours_played").and_then(Value::as_str))
        .bind(body.get("availability").and_then(Value::as_str))
        .bind(body.get("current_problems").and_then(Value::as_str))
        .bind(body.get("ai_summary").and_then(Value::as_str))
        .bind(ai_insights)
        .bind(status)
        .bind(assigned_id.as_deref())
        .bind(body.get("assigned_coach_username").and_then(Value::as_str))
        .bind(reserved_until)
        .bind(&coachee_id)
        .execute(&state.pool)
        .await?;
    }

    let canonical_request = sqlx::query(
        "SELECT request_uid, website_request_id, bot_request_id \
         FROM coaching.requests \
         WHERE request_uid=$1",
    )
    .bind(&request_uid)
    .fetch_one(&state.pool)
    .await?;
    let stored_website_request_id = rows::string(&canonical_request, "website_request_id");
    let stored_bot_request_id =
        rows::i64(&canonical_request, "bot_request_id").and_then(|value| i32::try_from(value).ok());

    if let (Some(coach_discord_id), Some(session_status)) = (
        body.get("coach_discord_id").and_then(Value::as_i64),
        body.get("session_status").and_then(Value::as_str),
    ) {
        let coach_id = upsert_coach(
            &state,
            coach_discord_id,
            body.get("coach_username").and_then(Value::as_str),
        )
        .await?;
        let completed = if matches!(session_status, "completed" | "cancelled") {
            Some(Utc::now())
        } else {
            None
        };
        let bot_session_id = body.get("bot_session_id").and_then(Value::as_str);
        let existing = find_session_by_references(
            &state,
            stored_website_request_id.as_deref(),
            stored_bot_request_id,
            Some(&request_uid),
            bot_session_id,
        )
        .await?;
        if let Some(row) = existing {
            sqlx::query(
                "UPDATE coaching.sessions \
                 SET request_uid=$1, bot_request_id=$2, website_request_id=$3, \
                     bot_session_id=COALESCE($4, bot_session_id), coach_id=$5, \
                     coachee_id=$6, discord_user_id=$7, discord_username=$8, status=$9, \
                     completed_at=COALESCE($10, completed_at) \
                 WHERE id=$11",
            )
            .bind(&request_uid)
            .bind(stored_bot_request_id)
            .bind(stored_website_request_id.as_deref())
            .bind(bot_session_id)
            .bind(&coach_id)
            .bind(&coachee_id)
            .bind(discord_user_id)
            .bind(discord_username)
            .bind(session_status)
            .bind(completed)
            .bind(rows::required_string(&row, "id"))
            .execute(&state.pool)
            .await?;
        } else {
            sqlx::query(
                "INSERT INTO coaching.sessions \
                 (id, request_uid, bot_request_id, website_request_id, bot_session_id, coach_id, \
                  coachee_id, discord_user_id, discord_username, status, started_at, completed_at, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11, now())",
            )
                .bind(ids::id12())
                .bind(&request_uid)
                .bind(stored_bot_request_id)
                .bind(stored_website_request_id.as_deref())
                .bind(bot_session_id)
                .bind(&coach_id)
                .bind(&coachee_id)
                .bind(discord_user_id)
                .bind(discord_username)
                .bind(session_status)
                .bind(completed)
                .execute(&state.pool)
                .await?;
        }
    }

    Ok(Json(json!({ "ok": true, "coachee_id": coachee_id })))
}

pub async fn platform_overview(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let coaches = sqlx::query(
        "SELECT c.id, c.display_name, c.discord_username, \
                SUM(CASE WHEN s.status='active' THEN 1 ELSE 0 END) AS active, \
                SUM(CASE WHEN s.status='completed' THEN 1 ELSE 0 END) AS completed, \
                COUNT(s.id) AS total \
         FROM coaching.coaches c \
         LEFT JOIN coaching.sessions s ON s.coach_id=c.id \
         WHERE c.status='active' \
         GROUP BY c.id \
         ORDER BY total DESC, c.display_name",
    )
    .fetch_all(&state.pool)
    .await?;
    let recent = sqlx::query(
        "SELECT s.id, s.status, s.started_at, s.completed_at, s.discord_username, \
                co.id AS coachee_id, co.display_name AS coachee_display, \
                c.display_name AS coach_display \
         FROM coaching.sessions s \
         LEFT JOIN coaching.coaches c ON s.coach_id=c.id \
         LEFT JOIN coaching.coachees co ON s.coachee_id=co.id \
         ORDER BY s.started_at DESC NULLS LAST, s.created_at DESC NULLS LAST \
         LIMIT 40",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({
        "coaches": coaches.iter().map(rows::row_json).collect::<Vec<_>>(),
        "recent_sessions": recent.iter().map(rows::row_json).collect::<Vec<_>>(),
    })))
}

pub async fn platform_queue(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let queue = sqlx::query(
        "SELECT COALESCE(website_request_id, bot_request_id::text, request_uid) AS id, r.* \
         FROM coaching.requests r \
         WHERE status='analyzed' \
           AND (assigned_coach_id IS NULL OR assigned_coach_id=$1) \
         ORDER BY created_at DESC NULLS LAST \
         LIMIT 50",
    )
    .bind(&user.sub)
    .fetch_all(&state.pool)
    .await?;
    let now = Utc::now().timestamp();
    let mut requests = Vec::new();
    for row in &queue {
        let mut obj = rows::row_json(row).as_object().cloned().unwrap_or_default();
        let assigned = rows::string(row, "assigned_coach_id");
        let reserved_until = rows::i64(row, "reserved_until");
        obj.insert(
            "reserved_for_me".to_string(),
            json!(assigned.as_deref() == Some(user.sub.as_str())),
        );
        obj.insert(
            "is_open".to_string(),
            json!(assigned.is_none() || reserved_until.is_some_and(|v| v <= now)),
        );
        obj.insert("reserved_until".to_string(), json!(reserved_until));
        requests.push(Value::Object(obj));
    }
    Ok(Json(json!({ "requests": requests })))
}

pub async fn list_coachees(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let rows = sqlx::query(
        "SELECT co.id, co.discord_username, co.display_name, co.rank, co.current_focus, \
                (SELECT COUNT(*) FROM coaching.goals g \
                 WHERE g.coachee_id=co.id AND g.status IN ('open','active')) AS open_goals, \
                (SELECT COUNT(*) FROM coaching.sessions s WHERE s.coachee_id=co.id) AS sessions \
         FROM coaching.coachees co \
         ORDER BY co.updated_at DESC NULLS LAST \
         LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(
        json!({ "coachees": rows.iter().map(rows::row_json).collect::<Vec<_>>() }),
    ))
}

pub async fn get_coachee(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(coachee_id): Path<String>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let coachee = sqlx::query("SELECT * FROM coaching.coachees WHERE id=$1")
        .bind(&coachee_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Coachee nicht gefunden"))?;
    let goals = goals_with_milestones(&state, &coachee_id).await?;
    let notes = sqlx::query(
        "SELECT * FROM coaching.session_notes \
             WHERE coachee_id=$1 \
             ORDER BY created_at DESC NULLS LAST",
    )
    .bind(&coachee_id)
    .fetch_all(&state.pool)
    .await?;
    let sessions = sqlx::query(
        "SELECT s.*, c.display_name AS coach_display \
         FROM coaching.sessions s \
         LEFT JOIN coaching.coaches c ON s.coach_id=c.id \
         WHERE s.coachee_id=$1 \
         ORDER BY s.started_at DESC NULLS LAST, s.created_at DESC NULLS LAST",
    )
    .bind(&coachee_id)
    .fetch_all(&state.pool)
    .await?;
    let appointments = sqlx::query(
        "SELECT a.id, a.scheduled_at, a.duration_minutes, a.title, a.note, a.status, \
                a.created_at, COALESCE(c.display_name, c.discord_username) AS coach_display \
         FROM coaching.appointments a \
         LEFT JOIN coaching.coaches c ON a.coach_id=c.id \
         WHERE a.coachee_id=$1 \
         ORDER BY a.scheduled_at DESC",
    )
    .bind(&coachee_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(json!({
        "profile": rows::row_json(&coachee),
        "goals": goals,
        "notes": notes.iter().map(rows::row_json).collect::<Vec<_>>(),
        "sessions": sessions.iter().map(rows::row_json).collect::<Vec<_>>(),
        "appointments": appointments.iter().map(rows::row_json).collect::<Vec<_>>(),
    })))
}

pub async fn update_coachee(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(coachee_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    update_known_fields(
        &state,
        "coaching.coachees",
        "id",
        &coachee_id,
        &body,
        &[
            "display_name",
            "rank",
            "main_heroes_json",
            "current_focus",
            "notes",
        ],
        true,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn create_goal(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(coachee_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let coach_id = acting_coach_id(&state, &user).await?;
    let id = ids::id12();
    let target_date = optional_date_body(&body, "target_date")?;
    sqlx::query(
        "INSERT INTO coaching.goals \
         (id, coachee_id, coach_id, session_id, title, description, target_date, status, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', now(), now())",
    )
        .bind(&id)
        .bind(coachee_id)
        .bind(coach_id)
        .bind(body.get("session_id").and_then(Value::as_str))
        .bind(body.get("title").and_then(Value::as_str).unwrap_or_default())
        .bind(body.get("description").and_then(Value::as_str))
        .bind(target_date)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "id": id })))
}

pub async fn update_goal(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(goal_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let mut sets = Vec::new();
    let mut values: Vec<(String, Value)> = Vec::new();
    for key in [
        "title",
        "description",
        "status",
        "sort_order",
        "target_date",
    ] {
        if let Some(value) = body.get(key).filter(|v| !v.is_null()) {
            push_set(&mut sets, &mut values, key, value.clone());
        }
    }
    if sets.is_empty() {
        return Ok(Json(json!({ "ok": true })));
    }
    push_set(
        &mut sets,
        &mut values,
        "completed_at".to_string(),
        if body.get("status").and_then(Value::as_str) == Some("done") {
            json!(iso_now())
        } else {
            Value::Null
        },
    );
    push_set(&mut sets, &mut values, "updated_at", json!(iso_now()));
    let id_placeholder = values.len() + 1;
    run_update(
        &state,
        &format!(
            "UPDATE coaching.goals SET {} WHERE id=${id_placeholder}",
            sets.join(", ")
        ),
        values,
        &goal_id,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_goal(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(goal_id): Path<String>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    sqlx::query("DELETE FROM coaching.milestones WHERE goal_id=$1")
        .bind(&goal_id)
        .execute(&state.pool)
        .await?;
    sqlx::query("DELETE FROM coaching.goals WHERE id=$1")
        .bind(goal_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn create_milestone(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(goal_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let id = ids::id12();
    sqlx::query(
        "INSERT INTO coaching.milestones \
         (id, goal_id, title, description, achieved, created_at) \
         VALUES ($1, $2, $3, $4, false, now())",
    )
    .bind(&id)
    .bind(goal_id)
    .bind(
        body.get("title")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .bind(body.get("description").and_then(Value::as_str))
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({ "id": id })))
}

pub async fn update_milestone(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(milestone_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let mut sets = Vec::new();
    let mut values: Vec<(String, Value)> = Vec::new();
    if let Some(value) = body.get("title").filter(|v| !v.is_null()) {
        push_set(&mut sets, &mut values, "title", value.clone());
    }
    if let Some(value) = body.get("sort_order").filter(|v| !v.is_null()) {
        push_set(&mut sets, &mut values, "sort_order", value.clone());
    }
    if let Some(achieved) = body.get("achieved").and_then(Value::as_bool) {
        push_set(&mut sets, &mut values, "achieved", json!(achieved));
        push_set(
            &mut sets,
            &mut values,
            "achieved_at".to_string(),
            if achieved {
                json!(iso_now())
            } else {
                Value::Null
            },
        );
    }
    if sets.is_empty() {
        return Ok(Json(json!({ "ok": true })));
    }
    let id_placeholder = values.len() + 1;
    run_update(
        &state,
        &format!(
            "UPDATE coaching.milestones SET {} WHERE id=${id_placeholder}",
            sets.join(", ")
        ),
        values,
        &milestone_id,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_milestone(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(milestone_id): Path<String>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    sqlx::query("DELETE FROM coaching.milestones WHERE id=$1")
        .bind(milestone_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn create_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(coachee_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let coach_id = acting_coach_id(&state, &user).await?;
    let id = ids::id12();
    let visibility = match body.get("visibility").and_then(Value::as_str) {
        Some("shared_with_user") => "shared_with_user",
        _ => "coach_only",
    };
    sqlx::query(
        "INSERT INTO coaching.session_notes \
         (id, session_id, coachee_id, coach_id, content, visibility, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())",
    )
    .bind(&id)
    .bind(body.get("session_id").and_then(Value::as_str))
    .bind(coachee_id)
    .bind(coach_id)
    .bind(
        body.get("content")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .bind(visibility)
    .execute(&state.pool)
    .await?;
    Ok(Json(json!({ "id": id })))
}

pub async fn update_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(note_id): Path<String>,
    Json(mut body): Json<Value>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    if !matches!(
        body.get("visibility").and_then(Value::as_str),
        Some("coach_only" | "shared_with_user") | None
    ) {
        if let Some(obj) = body.as_object_mut() {
            obj.remove("visibility");
        }
    }
    update_known_fields(
        &state,
        "coaching.session_notes",
        "id",
        &note_id,
        &body,
        &["content", "visibility"],
        true,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_note(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(note_id): Path<String>,
) -> AppResult<Json<Value>> {
    auth::require_coach_user(&state, &headers, Some(peer)).await?;
    sqlx::query("DELETE FROM coaching.session_notes WHERE id=$1")
        .bind(note_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn my_coaching(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let Ok(discord_id) = user.sub.parse::<i64>() else {
        return Ok(Json(empty_my_coaching()));
    };
    let coachee = sqlx::query(
        "SELECT id, discord_user_id, discord_username, display_name, rank, main_heroes_json, \
                current_focus, created_at, updated_at \
         FROM coaching.coachees \
         WHERE discord_user_id=$1",
    )
    .bind(discord_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some(coachee) = coachee else {
        return Ok(Json(empty_my_coaching()));
    };
    let coachee_id = rows::required_string(&coachee, "id");
    let goals = goals_with_milestones(&state, &coachee_id).await?;
    let notes = sqlx::query(
        "SELECT * FROM coaching.session_notes \
         WHERE coachee_id=$1 AND visibility='shared_with_user' \
         ORDER BY created_at DESC NULLS LAST",
    )
    .bind(&coachee_id)
    .fetch_all(&state.pool)
    .await?;
    let sessions = sqlx::query(
        "SELECT s.status, s.started_at, s.completed_at, c.display_name AS coach_display \
         FROM coaching.sessions s \
         LEFT JOIN coaching.coaches c ON s.coach_id=c.id \
         WHERE s.discord_user_id=$1 \
         ORDER BY s.started_at DESC NULLS LAST, s.created_at DESC NULLS LAST",
    )
    .bind(discord_id)
    .fetch_all(&state.pool)
    .await?;
    let cutoff = Utc::now() - Duration::hours(6);
    let appts = sqlx::query(
        "SELECT a.id, a.scheduled_at, a.duration_minutes, a.title, a.status, \
                c.display_name AS coach_display \
         FROM coaching.appointments a \
         LEFT JOIN coaching.coaches c ON a.coach_id=c.id \
         WHERE a.coachee_id=$1 \
           AND ((a.status='scheduled' AND a.scheduled_at >= $2) OR a.status IN ('done','cancelled')) \
         ORDER BY CASE WHEN a.status='scheduled' THEN 0 ELSE 1 END, a.scheduled_at ASC \
         LIMIT 50",
    )
        .bind(&coachee_id)
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await?;
    let all: Vec<Value> = appts.iter().map(rows::row_json).collect();
    let mut scheduled: Vec<Value> = all
        .iter()
        .filter(|v| v.get("status").and_then(Value::as_str) == Some("scheduled"))
        .cloned()
        .collect();
    let mut closed: Vec<Value> = all
        .into_iter()
        .filter(|v| {
            matches!(
                v.get("status").and_then(Value::as_str),
                Some("done" | "cancelled")
            )
        })
        .collect();
    if closed.len() > 5 {
        closed = closed.split_off(closed.len() - 5);
    }
    scheduled.extend(closed);
    Ok(Json(json!({
        "profile": rows::row_json(&coachee),
        "goals": goals,
        "notes": notes.iter().map(rows::row_json).collect::<Vec<_>>(),
        "sessions": sessions.iter().map(rows::row_json).collect::<Vec<_>>(),
        "appointments": scheduled,
    })))
}

pub async fn coaches_sync(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let coaches = body
        .get("coaches")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if coaches.is_empty() {
        return Ok(Json(json!({ "ok": true, "skipped": true })));
    }
    let mut incoming = Vec::new();
    for entry in coaches {
        let Some(discord_id) = entry.get("discord_user_id").and_then(Value::as_i64) else {
            continue;
        };
        incoming.push(discord_id);
        let row = sqlx::query("SELECT id FROM coaching.coaches WHERE discord_user_id=$1")
            .bind(discord_id)
            .fetch_optional(&state.pool)
            .await?;
        if row.is_some() {
            sqlx::query(
                "UPDATE coaching.coaches \
                 SET discord_username=COALESCE($1, discord_username), \
                     display_name=COALESCE($2, display_name), \
                     avatar_url=COALESCE($3, avatar_url), \
                     status='active', updated_at=now() \
                 WHERE discord_user_id=$4",
            )
            .bind(entry.get("discord_username").and_then(Value::as_str))
            .bind(entry.get("display_name").and_then(Value::as_str))
            .bind(entry.get("avatar_url").and_then(Value::as_str))
            .bind(discord_id)
            .execute(&state.pool)
            .await?;
        } else {
            sqlx::query(
                "INSERT INTO coaching.coaches \
                 (id, discord_user_id, discord_username, display_name, avatar_url, status, created_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, 'active', now(), now())",
            )
                .bind(ids::id12())
                .bind(discord_id)
                .bind(entry.get("discord_username").and_then(Value::as_str))
                .bind(entry.get("display_name").and_then(Value::as_str))
                .bind(entry.get("avatar_url").and_then(Value::as_str))
                .execute(&state.pool)
                .await?;
        }
    }
    let placeholders = (1..=incoming.len())
        .map(|idx| format!("${idx}"))
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "UPDATE coaching.coaches \
         SET status='inactive', updated_at=now() \
         WHERE status='active' AND discord_user_id NOT IN ({placeholders})"
    );
    let mut q = sqlx::query(&sql);
    for id in &incoming {
        q = q.bind(id);
    }
    let result = q.execute(&state.pool).await?;
    Ok(Json(
        json!({ "ok": true, "active": incoming.len(), "deactivated": result.rows_affected() }),
    ))
}

pub async fn create_appointment(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let scheduled_at = body
        .get("scheduled_at")
        .and_then(Value::as_str)
        .unwrap_or_default();
    validate_iso(scheduled_at)?;
    let coachee_id = body
        .get("coachee_id")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM coaching.coachees WHERE id=$1")
        .bind(coachee_id)
        .fetch_optional(&state.pool)
        .await?;
    if exists.is_none() {
        return Err(AppError::not_found("Coachee nicht gefunden"));
    }
    let coach_id = acting_coach_id(&state, &user).await?;
    let id = ids::id12();
    let scheduled_at = parse_datetime_utc(scheduled_at)?;
    let duration_minutes = i32_body_or_default(&body, "duration_minutes", 60)?;
    sqlx::query(
        "INSERT INTO coaching.appointments \
         (id, coach_id, coachee_id, scheduled_at, duration_minutes, title, note, status, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', now(), now())",
    )
        .bind(&id)
        .bind(coach_id)
        .bind(coachee_id)
        .bind(scheduled_at)
        .bind(duration_minutes)
        .bind(body.get("title").and_then(Value::as_str))
        .bind(body.get("note").and_then(Value::as_str))
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "id": id })))
}

pub async fn list_appointments(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Query(query): Query<AppointmentQuery>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let cutoff = Utc::now() - Duration::days(7);
    let rows = if query.scope.as_deref().unwrap_or("mine") == "mine" {
        let coach_id = acting_coach_id(&state, &user).await?;
        sqlx::query(
            "SELECT a.id, a.coach_id, a.coachee_id, a.scheduled_at, a.duration_minutes, \
                    a.title, a.note, a.status, a.created_at, \
                    COALESCE(co.display_name, co.discord_username) AS coachee_display, \
                    COALESCE(c.display_name, c.discord_username) AS coach_display \
             FROM coaching.appointments a \
             LEFT JOIN coaching.coachees co ON a.coachee_id=co.id \
             LEFT JOIN coaching.coaches c ON a.coach_id=c.id \
             WHERE a.coach_id=$1 AND a.scheduled_at >= $2 \
             ORDER BY a.scheduled_at ASC",
        )
        .bind(coach_id)
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query(
            "SELECT a.id, a.coach_id, a.coachee_id, a.scheduled_at, a.duration_minutes, \
                    a.title, a.note, a.status, a.created_at, \
                    COALESCE(co.display_name, co.discord_username) AS coachee_display, \
                    COALESCE(c.display_name, c.discord_username) AS coach_display \
             FROM coaching.appointments a \
             LEFT JOIN coaching.coachees co ON a.coachee_id=co.id \
             LEFT JOIN coaching.coaches c ON a.coach_id=c.id \
             WHERE a.scheduled_at >= $1 \
             ORDER BY a.scheduled_at ASC",
        )
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(
        json!({ "appointments": rows.iter().map(rows::row_json).collect::<Vec<_>>() }),
    ))
}

pub async fn update_appointment(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(appointment_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    if let Some(status) = body.get("status").and_then(Value::as_str) {
        if !matches!(status, "scheduled" | "done" | "cancelled") {
            return Err(AppError::bad_request(
                "status muss scheduled | done | cancelled sein",
            ));
        }
    }
    if let Some(scheduled_at) = body.get("scheduled_at").and_then(Value::as_str) {
        validate_iso(scheduled_at)?;
    }
    let appt = sqlx::query("SELECT coach_id, status FROM coaching.appointments WHERE id=$1")
        .bind(&appointment_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Termin nicht gefunden"))?;
    let acting = acting_coach_id(&state, &user).await?;
    if user.role != "admin" && rows::string(&appt, "coach_id") != acting {
        return Err(AppError::forbidden(
            "Nur der zuständige Coach darf diesen Termin ändern",
        ));
    }
    let mut sets = Vec::new();
    let mut values: Vec<(String, Value)> = Vec::new();
    for key in [
        "scheduled_at",
        "duration_minutes",
        "title",
        "note",
        "status",
    ] {
        if let Some(value) = body.get(key).filter(|v| !v.is_null()) {
            push_set(&mut sets, &mut values, key, value.clone());
        }
    }
    if sets.is_empty() {
        return Ok(Json(json!({ "ok": true })));
    }
    if body.get("scheduled_at").is_some() {
        sets.push("notify_created_at=NULL".to_string());
        sets.push("notify_reminder_at=NULL".to_string());
    }
    push_set(&mut sets, &mut values, "updated_at", json!(iso_now()));
    let id_placeholder = values.len() + 1;
    run_update(
        &state,
        &format!(
            "UPDATE coaching.appointments SET {} WHERE id=${id_placeholder}",
            sets.join(", ")
        ),
        values,
        &appointment_id,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

pub async fn notifications_due(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let now = Utc::now();
    let in_2h = now + Duration::hours(2);
    let rows = sqlx::query(
        "SELECT 'created' AS type, a.id AS appointment_id, co.discord_user_id, \
                COALESCE(co.display_name, co.discord_username) AS coachee_display, \
                COALESCE(c.display_name, c.discord_username) AS coach_display, \
                a.scheduled_at, a.duration_minutes, a.title, a.note \
         FROM coaching.appointments a \
         JOIN coaching.coachees co ON a.coachee_id=co.id \
         JOIN coaching.coaches c ON a.coach_id=c.id \
         WHERE a.status='scheduled' AND a.notify_created_at IS NULL \
         UNION ALL \
         SELECT 'reminder' AS type, a.id, co.discord_user_id, \
                COALESCE(co.display_name, co.discord_username), \
                COALESCE(c.display_name, c.discord_username), \
                a.scheduled_at, a.duration_minutes, a.title, a.note \
         FROM coaching.appointments a \
         JOIN coaching.coachees co ON a.coachee_id=co.id \
         JOIN coaching.coaches c ON a.coach_id=c.id \
         WHERE a.status='scheduled' AND a.notify_reminder_at IS NULL \
           AND a.notify_created_at IS NOT NULL AND a.scheduled_at BETWEEN $1 AND $2 \
         UNION ALL \
         SELECT 'cancelled' AS type, a.id, co.discord_user_id, \
                COALESCE(co.display_name, co.discord_username), \
                COALESCE(c.display_name, c.discord_username), \
                a.scheduled_at, a.duration_minutes, a.title, a.note \
         FROM coaching.appointments a \
         JOIN coaching.coachees co ON a.coachee_id=co.id \
         JOIN coaching.coaches c ON a.coach_id=c.id \
         WHERE a.status='cancelled' AND a.notify_cancelled_at IS NULL \
           AND a.notify_created_at IS NOT NULL",
    )
    .bind(now)
    .bind(in_2h)
    .fetch_all(&state.pool)
    .await?;
    let mut notifications: Vec<Value> = rows.iter().map(rows::row_json).collect();

    let reqs = sqlx::query(
        "SELECT website_request_id AS request_id, \
                discord_user_id, discord_username, rank, subrank, hero, games_played, \
                hours_played, availability, current_problems, preferred_coach_id \
         FROM coaching.requests \
         WHERE website_request_id IS NOT NULL /* request_created mirrors only website-originated requests. */ \
           AND notify_discord_at IS NULL \
           AND status IN ('pending', 'analyzed', 'open', 'new') \
         ORDER BY created_at ASC NULLS LAST",
    )
    .fetch_all(&state.pool)
    .await?;
    for row in &reqs {
        let coachee_id = upsert_coachee(
            &state,
            rows::i64(row, "discord_user_id").unwrap_or_default(),
            rows::string(row, "discord_username").as_deref(),
        )
        .await?;
        notifications.push(json!({
            "type": "request_created",
            "request_id": rows::required_string(row, "request_id"),
            "coachee_id": coachee_id,
            "discord_user_id": rows::i64(row, "discord_user_id").unwrap_or_default(),
            "discord_username": rows::value_from_row(row, "discord_username"),
            "rank": rows::string(row, "rank").unwrap_or_default(),
            "subrank": rows::string(row, "subrank").unwrap_or_default(),
            "hero": rows::value_from_row(row, "hero"),
            "games_played": rows::value_from_row(row, "games_played"),
            "hours_played": rows::value_from_row(row, "hours_played"),
            "availability": rows::value_from_row(row, "availability"),
            "current_problems": rows::value_from_row(row, "current_problems"),
            "preferred_coach_id": rows::value_from_row(row, "preferred_coach_id"),
        }));
    }
    Ok(Json(json!({ "notifications": notifications })))
}

pub async fn notifications_ack(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    require_bot_token(&headers)?;
    let mut acked: u64 = 0;
    for item in body
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let Some(col) = item
            .get("type")
            .and_then(Value::as_str)
            .and_then(|kind| match kind {
                "created" => Some("notify_created_at"),
                "reminder" => Some("notify_reminder_at"),
                "cancelled" => Some("notify_cancelled_at"),
                _ => None,
            })
        else {
            continue;
        };
        let sql = format!("UPDATE coaching.appointments SET {col}=$1 WHERE id=$2");
        sqlx::query(&sql)
            .bind(Utc::now())
            .bind(
                item.get("appointment_id")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            )
            .execute(&state.pool)
            .await?;
        acked += 1;
    }
    for request_id in body
        .get("request_ids")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        if let Some(id) = request_id.as_str() {
            let res = sqlx::query(
                "UPDATE coaching.requests \
                 SET notify_discord_at=$1 \
                 WHERE website_request_id=$2 \
                   AND notify_discord_at IS NULL",
            )
            .bind(Utc::now())
            .bind(id)
            .execute(&state.pool)
            .await?;
            acked += res.rows_affected();
        }
    }
    Ok(Json(json!({ "ok": true, "acked": acked })))
}

pub async fn get_my_coach_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let discord_id = user
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::not_found("Coach-Profil nicht gefunden"))?;
    let row = sqlx::query("SELECT * FROM coaching.coaches WHERE discord_user_id=$1")
        .bind(discord_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Coach-Profil nicht gefunden"))?;
    let mut obj = rows::row_json(&row)
        .as_object()
        .cloned()
        .unwrap_or_default();
    obj.insert(
        "specialties".to_string(),
        rows::parse_json_or(rows::string(&row, "specialties_json"), json!([])),
    );
    obj.insert(
        "availability".to_string(),
        rows::parse_json_or(rows::string(&row, "availability_json"), json!({})),
    );
    Ok(Json(Value::Object(obj)))
}

pub async fn update_my_coach_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user = auth::require_coach_user(&state, &headers, Some(peer)).await?;
    let discord_id = user
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::not_found("Coach-Profil nicht gefunden"))?;
    let exists: Option<String> =
        sqlx::query_scalar("SELECT id FROM coaching.coaches WHERE discord_user_id=$1")
            .bind(discord_id)
            .fetch_optional(&state.pool)
            .await?;
    if exists.is_none() {
        return Err(AppError::not_found("Coach-Profil nicht gefunden"));
    }
    let mut sets = Vec::new();
    let mut values: Vec<(String, Value)> = Vec::new();
    if let Some(v) = body.get("bio").filter(|v| !v.is_null()) {
        push_set(&mut sets, &mut values, "bio", v.clone());
    }
    if let Some(v) = body.get("specialties").filter(|v| !v.is_null()) {
        push_set(&mut sets, &mut values, "specialties_json", v.clone());
    }
    if let Some(v) = body.get("twitch_url").filter(|v| !v.is_null()) {
        push_set(&mut sets, &mut values, "twitch_url", v.clone());
    }
    if sets.is_empty() {
        return Ok(Json(json!({ "ok": true })));
    }
    push_set(&mut sets, &mut values, "updated_at", json!(iso_now()));
    let id_placeholder = values.len() + 1;
    run_update_by_i64(
        &state,
        &format!(
            "UPDATE coaching.coaches SET {} WHERE discord_user_id=${id_placeholder}",
            sets.join(", ")
        ),
        values,
        discord_id,
    )
    .await?;
    Ok(Json(json!({ "ok": true })))
}

async fn find_request_by_references(
    state: &AppState,
    website_request_id: Option<&str>,
    bot_request_id: Option<i32>,
    request_uid: Option<&str>,
) -> AppResult<Option<rows::DbRow>> {
    let matches = sqlx::query(
        "SELECT * \
         FROM coaching.requests \
         WHERE ($1::text IS NOT NULL AND website_request_id=$1) \
            OR ($2::integer IS NOT NULL AND bot_request_id=$2) \
            OR ($3::text IS NOT NULL AND request_uid=$3) \
         ORDER BY CASE \
             WHEN $1::text IS NOT NULL AND website_request_id=$1 THEN 0 \
             WHEN $2::integer IS NOT NULL AND bot_request_id=$2 THEN 1 \
             ELSE 2 \
         END",
    )
    .bind(website_request_id)
    .bind(bot_request_id)
    .bind(request_uid)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from)?;

    let has_external_reference = website_request_id.is_some() || bot_request_id.is_some();
    let mut matched_external_reference = false;
    let mut first_request_uid = None;
    for row in &matches {
        let row_request_uid = rows::required_string(row, "request_uid");
        let matches_website = website_request_id
            .is_some_and(|id| rows::string(row, "website_request_id").as_deref() == Some(id));
        let matches_bot = bot_request_id
            .is_some_and(|id| rows::i64(row, "bot_request_id") == Some(i64::from(id)));
        matched_external_reference |= matches_website || matches_bot;
        if let Some(first_request_uid) = &first_request_uid {
            if first_request_uid != &row_request_uid {
                return Err(AppError::http(
                    StatusCode::CONFLICT,
                    "conflicting request references",
                ));
            }
        } else {
            first_request_uid = Some(row_request_uid);
        }
    }
    if has_external_reference && !matches.is_empty() && !matched_external_reference {
        return Err(AppError::http(
            StatusCode::CONFLICT,
            "conflicting request references",
        ));
    }

    Ok(matches.into_iter().next())
}

async fn find_session_by_references(
    state: &AppState,
    website_request_id: Option<&str>,
    bot_request_id: Option<i32>,
    request_uid: Option<&str>,
    bot_session_id: Option<&str>,
) -> AppResult<Option<rows::DbRow>> {
    sqlx::query(
        "SELECT id \
         FROM coaching.sessions \
         WHERE ($1::text IS NOT NULL AND website_request_id=$1) \
            OR ($2::integer IS NOT NULL AND bot_request_id=$2) \
            OR ($3::text IS NOT NULL AND request_uid=$3) \
            OR ($4::text IS NOT NULL AND bot_session_id=$4) \
         ORDER BY CASE \
             WHEN $1::text IS NOT NULL AND website_request_id=$1 THEN 0 \
             WHEN $2::integer IS NOT NULL AND bot_request_id=$2 THEN 1 \
             WHEN $3::text IS NOT NULL AND request_uid=$3 THEN 2 \
             ELSE 3 \
         END \
         LIMIT 1",
    )
    .bind(website_request_id)
    .bind(bot_request_id)
    .bind(request_uid)
    .bind(bot_session_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)
}

fn new_request_uid(
    website_request_id: Option<&str>,
    bot_request_id: Option<i32>,
    explicit_request_uid: Option<&str>,
) -> String {
    if let Some(website_request_id) = website_request_id {
        return website_request_id.to_string();
    }
    if let Some(bot_request_id) = bot_request_id {
        return format!("bot:{bot_request_id}");
    }
    explicit_request_uid.unwrap_or_default().to_string()
}

fn validate_website_request_id(website_request_id: Option<&str>) -> AppResult<()> {
    if website_request_id.is_some_and(|value| value.starts_with("bot:")) {
        return Err(AppError::bad_request(
            "website_request_id must not start with bot:",
        ));
    }
    Ok(())
}

async fn upsert_coach(
    state: &AppState,
    discord_user_id: i64,
    username: Option<&str>,
) -> AppResult<String> {
    let row = sqlx::query("SELECT id FROM coaching.coaches WHERE discord_user_id=$1")
        .bind(discord_user_id)
        .fetch_optional(&state.pool)
        .await?;
    if let Some(row) = row {
        return Ok(rows::required_string(&row, "id"));
    }
    let id = ids::id12();
    sqlx::query(
        "INSERT INTO coaching.coaches \
         (id, discord_user_id, discord_username, display_name, status, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, 'active', now(), now())",
    )
    .bind(&id)
    .bind(discord_user_id)
    .bind(username)
    .bind(username)
    .execute(&state.pool)
    .await?;
    Ok(id)
}

async fn upsert_coachee(
    state: &AppState,
    discord_user_id: i64,
    username: Option<&str>,
) -> AppResult<String> {
    let row = sqlx::query("SELECT id FROM coaching.coachees WHERE discord_user_id=$1")
        .bind(discord_user_id)
        .fetch_optional(&state.pool)
        .await?;
    if let Some(row) = row {
        let id = rows::required_string(&row, "id");
        if let Some(username) = username {
            sqlx::query(
                "UPDATE coaching.coachees \
                 SET discord_username=$1, updated_at=now() \
                 WHERE id=$2",
            )
            .bind(username)
            .bind(&id)
            .execute(&state.pool)
            .await?;
        }
        return Ok(id);
    }
    let id = ids::id12();
    sqlx::query(
        "INSERT INTO coaching.coachees \
         (id, discord_user_id, discord_username, display_name, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, now(), now())",
    )
    .bind(&id)
    .bind(discord_user_id)
    .bind(username)
    .bind(username)
    .execute(&state.pool)
    .await?;
    Ok(id)
}

async fn acting_coach_id(state: &AppState, user: &User) -> AppResult<Option<String>> {
    let Ok(discord_id) = user.sub.parse::<i64>() else {
        return Ok(None);
    };
    upsert_coach(state, discord_id, Some(&user.display_name))
        .await
        .map(Some)
}

async fn goals_with_milestones(state: &AppState, coachee_id: &str) -> AppResult<Vec<Value>> {
    let goals = sqlx::query(
        "SELECT * FROM coaching.goals \
         WHERE coachee_id=$1 \
         ORDER BY sort_order NULLS LAST, created_at",
    )
    .bind(coachee_id)
    .fetch_all(&state.pool)
    .await?;
    let mut out = Vec::new();
    for goal in goals {
        let mut obj = rows::row_json(&goal)
            .as_object()
            .cloned()
            .unwrap_or_default();
        let ms = sqlx::query(
            "SELECT * FROM coaching.milestones \
             WHERE goal_id=$1 \
             ORDER BY sort_order NULLS LAST, created_at",
        )
        .bind(rows::required_string(&goal, "id"))
        .fetch_all(&state.pool)
        .await?;
        obj.insert(
            "milestones".to_string(),
            Value::Array(ms.iter().map(rows::row_json).collect()),
        );
        out.push(Value::Object(obj));
    }
    Ok(out)
}

async fn update_known_fields(
    state: &AppState,
    table: &str,
    id_col: &str,
    id: &str,
    body: &Value,
    allowed: &[&str],
    updated_at: bool,
) -> AppResult<()> {
    let mut sets = Vec::new();
    let mut values: Vec<(String, Value)> = Vec::new();
    for key in allowed {
        if let Some(value) = body.get(*key).filter(|v| !v.is_null()) {
            push_set(&mut sets, &mut values, *key, value.clone());
        }
    }
    if sets.is_empty() {
        return Ok(());
    }
    if updated_at {
        push_set(&mut sets, &mut values, "updated_at", json!(iso_now()));
    }
    let id_placeholder = values.len() + 1;
    run_update(
        state,
        &format!(
            "UPDATE {table} SET {} WHERE {id_col}=${id_placeholder}",
            sets.join(", ")
        ),
        values,
        id,
    )
    .await
}

async fn run_update(
    state: &AppState,
    sql: &str,
    values: Vec<(String, Value)>,
    id: &str,
) -> AppResult<()> {
    let mut q = sqlx::query(sql);
    for (column, value) in values {
        q = bind_json(q, &column, value)?;
    }
    q.bind(id).execute(&state.pool).await?;
    Ok(())
}

async fn run_update_by_i64(
    state: &AppState,
    sql: &str,
    values: Vec<(String, Value)>,
    id: i64,
) -> AppResult<()> {
    let mut q = sqlx::query(sql);
    for (column, value) in values {
        q = bind_json(q, &column, value)?;
    }
    q.bind(id).execute(&state.pool).await?;
    Ok(())
}

fn push_set<S: Into<String>>(
    sets: &mut Vec<String>,
    values: &mut Vec<(String, Value)>,
    column: S,
    value: Value,
) {
    let column = column.into();
    values.push((column.clone(), value));
    sets.push(format!("{column}=${}", values.len()));
}

fn body_string<'a>(body: &'a Value, key: &str) -> Option<&'a str> {
    body.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn optional_i32_body(body: &Value, key: &str) -> AppResult<Option<i32>> {
    let Some(value) = body.get(key).filter(|value| !value.is_null()) else {
        return Ok(None);
    };
    let raw = match value {
        Value::Number(number) => number
            .as_i64()
            .ok_or_else(|| AppError::bad_request("invalid integer value"))?,
        Value::String(raw) => raw
            .trim()
            .parse::<i64>()
            .map_err(|_| AppError::bad_request("invalid integer value"))?,
        _ => return Err(AppError::bad_request("invalid integer value")),
    };
    i32::try_from(raw)
        .map(Some)
        .map_err(|_| AppError::bad_request("invalid integer value"))
}

fn i32_body_or_default(body: &Value, key: &str, default: i32) -> AppResult<i32> {
    optional_i32_body(body, key).map(|value| value.unwrap_or(default))
}

fn optional_date_body(body: &Value, key: &str) -> AppResult<Option<NaiveDate>> {
    match body.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(raw)) if raw.trim().is_empty() => Ok(None),
        Some(Value::String(raw)) => NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
            .map(Some)
            .map_err(|_| AppError::bad_request("invalid date value")),
        _ => Err(AppError::bad_request("invalid date value")),
    }
}

fn optional_datetime_body(body: &Value, key: &str) -> AppResult<Option<DateTime<Utc>>> {
    match body.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => datetime_from_value(value),
    }
}

fn datetime_from_value(value: &Value) -> AppResult<Option<DateTime<Utc>>> {
    match value {
        Value::Null => Ok(None),
        Value::String(raw) if raw.trim().is_empty() => Ok(None),
        Value::String(raw) => parse_datetime_utc(raw).map(Some),
        Value::Number(number) => {
            let Some(timestamp) = number.as_i64() else {
                return Err(AppError::bad_request("invalid timestamp value"));
            };
            DateTime::from_timestamp(timestamp, 0)
                .ok_or_else(|| AppError::bad_request("invalid timestamp value"))
                .map(Some)
        }
        _ => Err(AppError::bad_request("invalid timestamp value")),
    }
}

fn json_body_value_opt(body: &Value, keys: &[&str]) -> Option<Value> {
    keys.iter()
        .find_map(|key| body.get(*key).filter(|value| !value.is_null()).cloned())
}

type PgQuery<'q> = sqlx::query::Query<'q, Postgres, PgArguments>;

fn bind_json<'q>(q: PgQuery<'q>, column: &str, value: Value) -> AppResult<PgQuery<'q>> {
    let q = match column {
        "specialties_json" | "availability_json" | "main_heroes_json" | "ai_insights_json" => {
            bind_jsonb(q, value)
        }
        "achieved" | "is_public" | "would_recommend" | "is_active" => bind_bool(q, value)?,
        "target_date" => bind_date(q, value)?,
        "scheduled_at"
        | "started_at"
        | "completed_at"
        | "updated_at"
        | "achieved_at"
        | "reserved_until"
        | "notify_created_at"
        | "notify_reminder_at"
        | "notify_cancelled_at"
        | "notify_discord_at" => bind_datetime(q, value)?,
        _ => bind_dynamic_value(q, value),
    };
    Ok(q)
}

fn bind_jsonb<'q>(q: PgQuery<'q>, value: Value) -> PgQuery<'q> {
    match value {
        Value::Null => q.bind(Option::<Value>::None),
        Value::String(raw) => {
            q.bind(serde_json::from_str::<Value>(&raw).unwrap_or(Value::String(raw)))
        }
        other => q.bind(other),
    }
}

fn bind_bool<'q>(q: PgQuery<'q>, value: Value) -> AppResult<PgQuery<'q>> {
    let value = match value {
        Value::Null => None,
        Value::Bool(v) => Some(v),
        Value::Number(n) => n.as_i64().map(|v| v != 0),
        Value::String(raw) => match raw.to_ascii_lowercase().as_str() {
            "true" | "t" | "1" | "yes" => Some(true),
            "false" | "f" | "0" | "no" => Some(false),
            _ => return Err(AppError::bad_request("invalid boolean value")),
        },
        _ => return Err(AppError::bad_request("invalid boolean value")),
    };
    Ok(q.bind(value))
}

fn bind_date<'q>(q: PgQuery<'q>, value: Value) -> AppResult<PgQuery<'q>> {
    let value = match value {
        Value::Null => None,
        Value::String(raw) if raw.trim().is_empty() => None,
        Value::String(raw) => Some(
            NaiveDate::parse_from_str(&raw, "%Y-%m-%d")
                .map_err(|_| AppError::bad_request("invalid date value"))?,
        ),
        _ => return Err(AppError::bad_request("invalid date value")),
    };
    Ok(q.bind(value))
}

fn bind_datetime<'q>(q: PgQuery<'q>, value: Value) -> AppResult<PgQuery<'q>> {
    let value = match value {
        Value::Null => None,
        Value::String(raw) if raw.trim().is_empty() => None,
        Value::String(raw) => Some(parse_datetime_utc(&raw)?),
        Value::Number(n) => {
            let Some(timestamp) = n.as_i64() else {
                return Err(AppError::bad_request("invalid timestamp value"));
            };
            Some(
                DateTime::from_timestamp(timestamp, 0)
                    .ok_or_else(|| AppError::bad_request("invalid timestamp value"))?,
            )
        }
        _ => return Err(AppError::bad_request("invalid timestamp value")),
    };
    Ok(q.bind(value))
}

fn bind_dynamic_value<'q>(q: PgQuery<'q>, value: Value) -> PgQuery<'q> {
    match value {
        Value::Null => q.bind(Option::<String>::None),
        Value::Bool(v) => q.bind(v),
        Value::Number(n) => {
            if let Some(v) = n.as_i64() {
                q.bind(v)
            } else if let Some(v) = n.as_f64() {
                q.bind(v)
            } else {
                q.bind(n.to_string())
            }
        }
        Value::String(v) => q.bind(v),
        other => q.bind(other),
    }
}

fn parse_datetime_utc(value: &str) -> AppResult<DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| AppError::bad_request("invalid timestamp value"))
}

fn validate_iso(value: &str) -> AppResult<()> {
    chrono::DateTime::parse_from_rfc3339(&value.replace('Z', "+00:00"))
        .map(|_| ())
        .map_err(|_| AppError::bad_request("scheduled_at muss ISO-8601 UTC sein"))
}

fn empty_my_coaching() -> Value {
    json!({ "profile": null, "goals": [], "notes": [], "sessions": [], "appointments": [] })
}

fn iso_now() -> String {
    Utc::now().to_rfc3339()
}
