use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::{
    app::AppState,
    error::{AppError, AppResult},
    ids, rows,
};

#[derive(Deserialize)]
pub struct BuildQuery {
    #[serde(rename = "heroId")]
    hero_id: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
pub struct TierQuery {
    secret: Option<String>,
}

pub async fn list_heroes(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM meta_heroes ORDER BY name")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(rows.iter().map(hero_from_row).collect())))
}

pub async fn get_hero(
    State(state): State<AppState>,
    Path(hero_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row = sqlx::query("SELECT * FROM meta_heroes WHERE id=?")
        .bind(hero_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Hero not found"))?;
    Ok(Json(hero_from_row(&row)))
}

pub async fn create_hero(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    sqlx::query(
        "INSERT INTO meta_heroes (id, name, tier, role, image_url, abilities_json, stats_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
    .bind(body.get("tier").and_then(Value::as_str).unwrap_or("C"))
    .bind(body.get("role").and_then(Value::as_str))
    .bind(body.get("image_url").and_then(Value::as_str))
    .bind(body.get("abilities_json").and_then(Value::as_str).unwrap_or("[]"))
    .bind(body.get("stats_json").and_then(Value::as_str).unwrap_or("{}"))
    .execute(&state.pool)
    .await?;
    get_hero(State(state), Path(id)).await
}

pub async fn update_hero(
    State(state): State<AppState>,
    Path(hero_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    sqlx::query(
        "UPDATE meta_heroes SET name=?, tier=?, role=?, image_url=?, abilities_json=?, stats_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
    .bind(body.get("tier").and_then(Value::as_str).unwrap_or("C"))
    .bind(body.get("role").and_then(Value::as_str))
    .bind(body.get("image_url").and_then(Value::as_str))
    .bind(body.get("abilities_json").and_then(Value::as_str).unwrap_or("[]"))
    .bind(body.get("stats_json").and_then(Value::as_str).unwrap_or("{}"))
    .bind(&hero_id)
    .execute(&state.pool)
    .await?;
    get_hero(State(state), Path(hero_id)).await
}

pub async fn delete_hero(
    State(state): State<AppState>,
    Path(hero_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_heroes WHERE id=?")
        .bind(hero_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Hero deleted" })))
}

pub async fn list_builds(
    State(state): State<AppState>,
    Query(query): Query<BuildQuery>,
) -> AppResult<Json<Value>> {
    let rows = match (query.hero_id, query.status) {
        (Some(hero_id), Some(status)) => {
            sqlx::query("SELECT * FROM meta_builds WHERE hero_id=? AND status=? ORDER BY upvotes DESC, created_at DESC")
                .bind(hero_id)
                .bind(status)
                .fetch_all(&state.pool)
                .await?
        }
        (Some(hero_id), None) => {
            sqlx::query("SELECT * FROM meta_builds WHERE hero_id=? ORDER BY upvotes DESC, created_at DESC")
                .bind(hero_id)
                .fetch_all(&state.pool)
                .await?
        }
        (None, Some(status)) => {
            sqlx::query("SELECT * FROM meta_builds WHERE status=? ORDER BY upvotes DESC, created_at DESC")
                .bind(status)
                .fetch_all(&state.pool)
                .await?
        }
        (None, None) => {
            sqlx::query("SELECT * FROM meta_builds ORDER BY upvotes DESC, created_at DESC")
                .fetch_all(&state.pool)
                .await?
        }
    };
    Ok(Json(Value::Array(
        rows.iter().map(build_from_row).collect(),
    )))
}

pub async fn get_build(
    State(state): State<AppState>,
    Path(build_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row = sqlx::query("SELECT * FROM meta_builds WHERE id=?")
        .bind(build_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Build not found"))?;
    Ok(Json(build_from_row(&row)))
}

pub async fn create_build(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    sqlx::query(
        "INSERT INTO meta_builds (id, hero_id, name, author_id, author_name, description, ability_order_json, items_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.get("hero_id").and_then(Value::as_str).unwrap_or_default())
    .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
    .bind("anonymous")
    .bind("Anonymous")
    .bind(body.get("description").and_then(Value::as_str))
    .bind(body.get("ability_order_json").and_then(Value::as_str).unwrap_or("[]"))
    .bind(body.get("items_json").and_then(Value::as_str).unwrap_or("[]"))
    .execute(&state.pool)
    .await?;
    get_build(State(state), Path(id)).await
}

pub async fn update_build(
    State(state): State<AppState>,
    Path(build_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    sqlx::query(
        "UPDATE meta_builds SET hero_id=?, name=?, description=?, ability_order_json=?, items_json=? WHERE id=?",
    )
    .bind(body.get("hero_id").and_then(Value::as_str).unwrap_or_default())
    .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
    .bind(body.get("description").and_then(Value::as_str))
    .bind(body.get("ability_order_json").and_then(Value::as_str).unwrap_or("[]"))
    .bind(body.get("items_json").and_then(Value::as_str).unwrap_or("[]"))
    .bind(&build_id)
    .execute(&state.pool)
    .await?;
    get_build(State(state), Path(build_id)).await
}

pub async fn delete_build(
    State(state): State<AppState>,
    Path(build_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_builds WHERE id=?")
        .bind(build_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Build deleted" })))
}

pub async fn vote_build(
    State(state): State<AppState>,
    Path(build_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let up = body.get("vote").and_then(Value::as_str) == Some("up");
    let sql = if up {
        "UPDATE meta_builds SET upvotes = upvotes + 1 WHERE id=?"
    } else {
        "UPDATE meta_builds SET downvotes = downvotes + 1 WHERE id=?"
    };
    sqlx::query(sql)
        .bind(&build_id)
        .execute(&state.pool)
        .await?;
    get_build(State(state), Path(build_id)).await
}

pub async fn report_build(
    State(state): State<AppState>,
    Path(build_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    sqlx::query("INSERT INTO meta_reports (id, build_id, reason, status) VALUES (?, ?, ?, 'open')")
        .bind(id)
        .bind(&build_id)
        .bind(
            body.get("reason")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .execute(&state.pool)
        .await?;
    sqlx::query("UPDATE meta_builds SET status='reported' WHERE id=?")
        .bind(build_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Report submitted" })))
}

pub async fn list_items(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM meta_items ORDER BY name")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(
        rows.iter().map(rows::row_json).collect(),
    )))
}

pub async fn get_item(
    State(state): State<AppState>,
    Path(item_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row = sqlx::query("SELECT * FROM meta_items WHERE id=?")
        .bind(item_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Item not found"))?;
    Ok(Json(rows::row_json(&row)))
}

pub async fn list_tierlists(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows =
        sqlx::query("SELECT * FROM meta_tier_lists WHERE is_public=1 ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(Value::Array(
        rows.iter().map(tierlist_from_row).collect(),
    )))
}

pub async fn my_tierlists(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows =
        sqlx::query("SELECT * FROM meta_tier_lists WHERE owner_id=? ORDER BY created_at DESC")
            .bind("admin")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(Value::Array(
        rows.iter().map(tierlist_from_row).collect(),
    )))
}

pub async fn get_tierlist(
    State(state): State<AppState>,
    Path(list_id): Path<String>,
    Query(query): Query<TierQuery>,
) -> AppResult<Json<Value>> {
    let row =
        sqlx::query("SELECT * FROM meta_tier_lists WHERE id=? AND (is_public=1 OR secret_code=?)")
            .bind(list_id)
            .bind(query.secret.unwrap_or_default())
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| AppError::not_found("Tier list not found"))?;
    Ok(Json(tierlist_from_row(&row)))
}

pub async fn create_tierlist(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    let is_public = body
        .get("is_public")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let secret = if is_public {
        None
    } else {
        Some(ids::token_urlsafe(8))
    };
    sqlx::query(
        "INSERT INTO meta_tier_lists (id, name, owner_id, is_public, secret_code, tiers_json) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
    .bind("admin")
    .bind(if is_public { 1 } else { 0 })
    .bind(secret)
    .bind(body.get("tiers_json").and_then(Value::as_str).unwrap_or("{}"))
    .execute(&state.pool)
    .await?;
    let row = sqlx::query("SELECT * FROM meta_tier_lists WHERE id=?")
        .bind(id)
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(tierlist_from_row(&row)))
}

pub async fn update_tierlist(
    State(state): State<AppState>,
    Path(list_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let is_public = body
        .get("is_public")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    sqlx::query("UPDATE meta_tier_lists SET name=?, is_public=?, tiers_json=? WHERE id=?")
        .bind(body.get("name").and_then(Value::as_str).unwrap_or_default())
        .bind(if is_public { 1 } else { 0 })
        .bind(
            body.get("tiers_json")
                .and_then(Value::as_str)
                .unwrap_or("{}"),
        )
        .bind(&list_id)
        .execute(&state.pool)
        .await?;
    let row = sqlx::query("SELECT * FROM meta_tier_lists WHERE id=?")
        .bind(list_id)
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(tierlist_from_row(&row)))
}

pub async fn delete_tierlist(
    State(state): State<AppState>,
    Path(list_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_tier_lists WHERE id=?")
        .bind(list_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Tier list deleted" })))
}

pub async fn fork_tierlist(
    State(state): State<AppState>,
    Path(list_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row = sqlx::query("SELECT * FROM meta_tier_lists WHERE id=?")
        .bind(&list_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::not_found("Tier list not found"))?;
    let id = ids::id16();
    sqlx::query("INSERT INTO meta_tier_lists (id, name, owner_id, is_public, tiers_json, forked_from) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(format!("Fork of {}", rows::required_string(&row, "name")))
        .bind("admin")
        .bind(0)
        .bind(rows::string(&row, "tiers_json"))
        .bind(list_id)
        .execute(&state.pool)
        .await?;
    let row = sqlx::query("SELECT * FROM meta_tier_lists WHERE id=?")
        .bind(id)
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(tierlist_from_row(&row)))
}

pub async fn list_patchnotes(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM meta_patch_notes ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(
        rows.iter().map(rows::row_json).collect(),
    )))
}

pub async fn create_patchnote(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    sqlx::query("INSERT INTO meta_patch_notes (id, title, content, version) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(
            body.get("title")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .bind(
            body.get("content")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .bind(
            body.get("version")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({
        "id": id,
        "title": body.get("title").and_then(Value::as_str).unwrap_or_default(),
        "content": body.get("content").and_then(Value::as_str).unwrap_or_default(),
        "version": body.get("version").and_then(Value::as_str).unwrap_or_default(),
        "created_at": "",
    })))
}

pub async fn delete_patchnote(
    State(state): State<AppState>,
    Path(note_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_patch_notes WHERE id=?")
        .bind(note_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Patch note deleted" })))
}

pub async fn list_history(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM meta_tier_history ORDER BY changed_at DESC LIMIT 50")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(
        rows.iter().map(rows::row_json).collect(),
    )))
}

pub async fn list_reports(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query(
        "SELECT r.*, b.name AS build_name FROM meta_reports r LEFT JOIN meta_builds b ON r.build_id=b.id ORDER BY r.created_at DESC",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(Value::Array(
        rows.iter().map(rows::row_json).collect(),
    )))
}

pub async fn update_report(
    State(state): State<AppState>,
    Path(report_id): Path<String>,
    Query(query): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Json<Value>> {
    sqlx::query("UPDATE meta_reports SET status=? WHERE id=?")
        .bind(query.get("status").cloned().unwrap_or_default())
        .bind(report_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Report updated" })))
}

pub async fn list_votes(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query(
        "SELECT build_id, SUM(CASE WHEN vote_type='up' THEN 1 ELSE 0 END) AS upvotes, SUM(CASE WHEN vote_type='down' THEN 1 ELSE 0 END) AS downvotes FROM meta_votes GROUP BY build_id",
    )
    .fetch_all(&state.pool)
    .await?;
    let values = rows
        .iter()
        .map(|row| {
            json!({
                "buildId": rows::string(row, "build_id"),
                "upvotes": rows::i64(row, "upvotes").unwrap_or(0),
                "downvotes": rows::i64(row, "downvotes").unwrap_or(0),
            })
        })
        .collect();
    Ok(Json(Value::Array(values)))
}

pub async fn delete_vote(
    State(state): State<AppState>,
    Path(vote_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_votes WHERE id=?")
        .bind(vote_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Vote deleted" })))
}

pub async fn set_announcement(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let id = ids::id16();
    let message = body
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or_default();
    sqlx::query("UPDATE meta_announcements SET is_active=0")
        .execute(&state.pool)
        .await?;
    sqlx::query("INSERT INTO meta_announcements (id, message, is_active) VALUES (?, ?, 1)")
        .bind(&id)
        .bind(message)
        .execute(&state.pool)
        .await?;
    Ok(Json(
        json!({ "id": id, "message": message, "is_active": true, "created_at": "" }),
    ))
}

pub async fn delete_announcement(
    State(state): State<AppState>,
    Path(ann_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM meta_announcements WHERE id=?")
        .bind(ann_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "Announcement deleted" })))
}

pub async fn list_users(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT * FROM meta_users ORDER BY created_at DESC")
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(
        rows.iter().map(rows::row_json).collect(),
    )))
}

pub async fn update_user_role(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    sqlx::query("UPDATE meta_users SET role=? WHERE id=?")
        .bind(body.get("role").and_then(Value::as_str).unwrap_or("user"))
        .bind(user_id)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({ "message": "User role updated" })))
}

fn hero_from_row(row: &rows::DbRow) -> Value {
    let mut obj = base_map(
        row,
        &[
            "id",
            "name",
            "tier",
            "role",
            "image_url",
            "abilities_json",
            "stats_json",
        ],
    );
    let abilities = rows::json_or(row, &["abilities_json", "abilities"], json!([]));
    let stats = rows::json_or(row, &["stats_json", "stats"], json!({}));
    obj.insert("abilities_json".to_string(), abilities.clone());
    obj.insert("abilities".to_string(), abilities);
    obj.insert("stats_json".to_string(), stats.clone());
    obj.insert("stats".to_string(), stats);
    Value::Object(obj)
}

fn build_from_row(row: &rows::DbRow) -> Value {
    let mut obj = base_map(
        row,
        &[
            "id",
            "hero_id",
            "name",
            "author_id",
            "author_name",
            "description",
            "ability_order_json",
            "items_json",
            "upvotes",
            "downvotes",
            "status",
            "created_at",
        ],
    );
    obj.insert(
        "ability_order_json".to_string(),
        rows::json_or(row, &["ability_order_json", "ability_order"], json!([])),
    );
    obj.insert(
        "items_json".to_string(),
        rows::json_or(row, &["items_json", "items"], json!([])),
    );
    Value::Object(obj)
}

fn tierlist_from_row(row: &rows::DbRow) -> Value {
    let mut obj = base_map(
        row,
        &[
            "id",
            "name",
            "owner_id",
            "secret_code",
            "tiers_json",
            "forked_from",
            "created_at",
        ],
    );
    obj.insert(
        "tiers_json".to_string(),
        rows::json_or(row, &["tiers_json", "tiers"], json!({})),
    );
    obj.insert("owner_name".to_string(), json!("Admin"));
    obj.insert(
        "is_public".to_string(),
        json!(rows::bool(row, "is_public").unwrap_or(false)),
    );
    Value::Object(obj)
}

fn base_map(row: &rows::DbRow, keys: &[&str]) -> Map<String, Value> {
    let mut obj = Map::new();
    for key in keys {
        obj.insert((*key).to_string(), rows::value_from_row(row, key));
    }
    obj
}
