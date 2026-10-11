use axum::{
    body::Bytes,
    extract::{Query, State},
    http::header,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgConnection;
use tokio::sync::Mutex;

use crate::{
    app::AppState,
    error::{AppError, AppResult},
    rows,
};

type ChangeMarker = (i64, i64, String);

#[derive(Default)]
pub struct PatchTimelineCache(Mutex<Option<(ChangeMarker, Bytes)>>);

async fn change_marker(conn: &mut PgConnection) -> Result<ChangeMarker, sqlx::Error> {
    sqlx::query_as(
        "SELECT COUNT(*)::bigint, COALESCE(MAX(id), 0)::bigint, \
         COALESCE(SUM(xmin::text::bigint), 0)::text FROM brain.patch_events",
    )
    .fetch_one(conn)
    .await
}

pub async fn patch_timeline(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let mut cache = state.patch_timeline_cache.0.lock().await;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let marker = change_marker(&mut tx).await?;
    if let Some((cached_marker, body)) = cache.as_ref() {
        if cached_marker == &marker {
            let body = body.clone();
            tx.commit().await?;
            return Ok(([(header::CONTENT_TYPE, "application/json")], body));
        }
    }
    let overview = build_overview(&mut tx).await?;
    let body = Bytes::from(serde_json::to_vec(&overview)?);
    tx.commit().await?;
    *cache = Some((marker, body.clone()));
    Ok(([(header::CONTENT_TYPE, "application/json")], body))
}

async fn build_overview(conn: &mut PgConnection) -> AppResult<Value> {
    let summary = sqlx::query(
        r#"
        SELECT
          COUNT(*)::bigint AS total_events,
          COUNT(DISTINCT patch_external_id)::bigint AS total_patches,
          COUNT(DISTINCT entity_name) FILTER (WHERE entity_name IS NOT NULL AND entity_name <> '')::bigint AS named_entities,
          COUNT(*) FILTER (WHERE old_value IS NOT NULL OR new_value IS NOT NULL)::bigint AS value_events,
          COUNT(*) FILTER (WHERE source_kind = 'forum')::bigint AS forum_events,
          COUNT(*) FILTER (WHERE source_kind = 'steam')::bigint AS steam_events,
          MIN(posted_at) AS first_posted_at,
          MAX(posted_at) AS latest_posted_at,
          COALESCE((
            SELECT jsonb_object_agg(entity_type, event_count ORDER BY event_count DESC)
            FROM (
              SELECT entity_type, COUNT(*)::bigint AS event_count
              FROM brain.patch_events
              GROUP BY entity_type
            ) grouped
          ), '{}'::jsonb) AS entity_types,
          COALESCE((
            SELECT jsonb_object_agg(change_type, event_count ORDER BY event_count DESC)
            FROM (
              SELECT change_type, COUNT(*)::bigint AS event_count
              FROM brain.patch_events
              GROUP BY change_type
            ) grouped
          ), '{}'::jsonb) AS change_types
        FROM brain.patch_events
        "#,
    )
    .fetch_one(&mut *conn)
    .await?;

    let patch_rows = sqlx::query(
        r#"
        WITH base AS (
          SELECT
            patch_external_id AS patch_id,
            MAX(patch_title) AS title,
            MAX(patch_url) AS url,
            MAX(source_kind) AS source_kind,
            MAX(posted_at) AS posted_at,
            COUNT(*)::bigint AS event_count,
            COUNT(*) FILTER (WHERE entity_type = 'hero')::bigint AS hero_events,
            COUNT(*) FILTER (WHERE entity_type = 'item')::bigint AS item_events,
            COUNT(*) FILTER (WHERE entity_type = 'ability')::bigint AS ability_events,
            COUNT(*) FILTER (WHERE entity_type = 'general')::bigint AS general_events,
            COUNT(*) FILTER (WHERE change_type = 'buff')::bigint AS buff_events,
            COUNT(*) FILTER (WHERE change_type = 'nerf')::bigint AS nerf_events,
            COUNT(*) FILTER (WHERE change_type = 'fix')::bigint AS fix_events,
            COUNT(*) FILTER (WHERE change_type = 'rework')::bigint AS rework_events,
            COUNT(*) FILTER (WHERE old_value IS NOT NULL OR new_value IS NOT NULL)::bigint AS value_events
          FROM brain.patch_events
          GROUP BY patch_external_id
        ),
        entity_counts AS (
          SELECT patch_id, entity_type, entity_name, event_count
          FROM (
            SELECT
              patch_external_id AS patch_id,
              entity_type,
              COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), NULLIF(section, ''), 'General') AS entity_name,
              COUNT(*)::bigint AS event_count,
              row_number() OVER (
                PARTITION BY patch_external_id
                ORDER BY COUNT(*) DESC, COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), NULLIF(section, ''), 'General')
              ) AS row_num
            FROM brain.patch_events
            GROUP BY patch_external_id, entity_type, COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), NULLIF(section, ''), 'General')
          ) ranked
          WHERE row_num <= 5
        ),
        top_entities AS (
          SELECT
            patch_id,
            jsonb_agg(
              jsonb_build_object(
                'entity_type', entity_type,
                'entity_name', entity_name,
                'event_count', event_count
              )
              ORDER BY event_count DESC, entity_name
            ) AS entities
          FROM entity_counts
          GROUP BY patch_id
        )
        SELECT
          base.*,
          COALESCE(top_entities.entities, '[]'::jsonb) AS top_entities
        FROM base
        LEFT JOIN top_entities ON top_entities.patch_id = base.patch_id
        ORDER BY base.posted_at ASC NULLS FIRST, base.patch_id ASC
        "#,
    )
    .fetch_all(&mut *conn)
    .await?;

    let entity_rows = sqlx::query(
        r#"
        WITH base AS (
          SELECT
            entity_type,
            COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General') AS entity_name,
            COUNT(*)::bigint AS event_count,
            COUNT(DISTINCT patch_external_id)::bigint AS patch_count,
            MIN(posted_at) AS first_posted_at,
            MAX(posted_at) AS latest_posted_at,
            COUNT(*) FILTER (WHERE change_type = 'buff')::bigint AS buff_events,
            COUNT(*) FILTER (WHERE change_type = 'nerf')::bigint AS nerf_events,
            COUNT(*) FILTER (WHERE change_type = 'fix')::bigint AS fix_events,
            COUNT(*) FILTER (WHERE change_type = 'mechanic_change')::bigint AS mechanic_events,
            COUNT(*) FILTER (WHERE change_type = 'added')::bigint AS added_events,
            COUNT(*) FILTER (WHERE change_type = 'removed')::bigint AS removed_events,
            COUNT(*) FILTER (WHERE old_value IS NOT NULL OR new_value IS NOT NULL)::bigint AS value_events
          FROM brain.patch_events
          WHERE entity_type IN ('hero', 'item', 'ability', 'general')
          GROUP BY entity_type, COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General')
        ),
        latest AS (
          SELECT DISTINCT ON (entity_type, entity_name)
            entity_type,
            entity_name,
            patch_external_id AS latest_patch_id,
            patch_title AS latest_patch_title,
            patch_url AS latest_patch_url,
            posted_at AS latest_posted_at,
            change_type AS latest_change_type,
            normalized_line AS latest_line
          FROM (
            SELECT
              entity_type,
              COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General') AS entity_name,
              patch_external_id,
              patch_title,
              patch_url,
              posted_at,
              change_type,
              normalized_line,
              line_index
            FROM brain.patch_events
            WHERE entity_type IN ('hero', 'item', 'ability', 'general')
          ) events
          ORDER BY entity_type, entity_name, posted_at DESC NULLS LAST, line_index DESC
        )
        SELECT
          base.*,
          latest.latest_patch_id,
          latest.latest_patch_title,
          latest.latest_patch_url,
          latest.latest_posted_at,
          latest.latest_change_type,
          latest.latest_line
        FROM base
        LEFT JOIN latest ON latest.entity_type = base.entity_type AND latest.entity_name = base.entity_name
        ORDER BY base.event_count DESC, base.patch_count DESC, base.entity_name ASC
        LIMIT 220
        "#,
    )
    .fetch_all(&mut *conn)
    .await?;

    Ok(json!({
        "summary": rows::row_json(&summary),
        "patches": patch_rows.iter().map(rows::row_json).collect::<Vec<_>>(),
        "entities": entity_rows.iter().map(rows::row_json).collect::<Vec<_>>(),
    }))
}

#[derive(Default, Deserialize)]
pub struct PatchEventsQuery {
    search: Option<String>,
    entity_type: Option<String>,
    change_type: Option<String>,
    source: Option<String>,
    entity: Option<String>,
    patch: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

impl PatchEventsQuery {
    fn validate(&self) -> AppResult<()> {
        for value in [
            &self.search,
            &self.entity_type,
            &self.change_type,
            &self.source,
            &self.entity,
            &self.patch,
        ]
        .into_iter()
        .flatten()
        {
            if value.len() > 512 {
                return Err(AppError::bad_request("Der Filter ist zu lang."));
            }
        }
        Ok(())
    }
}

pub async fn patch_timeline_events(
    State(state): State<AppState>,
    Query(query): Query<PatchEventsQuery>,
) -> AppResult<Json<Value>> {
    query.validate()?;
    let limit = query.limit.unwrap_or(20).clamp(1, 50);
    let offset = query.offset.unwrap_or(0);
    let event_rows = sqlx::query(
        r#"
        SELECT
          id,
          patch_external_id AS patch_id,
          patch_title,
          patch_url AS url,
          source_kind,
          posted_at,
          line_index,
          section,
          entity_type,
          COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General') AS entity_name,
          subject,
          change_type,
          normalized_line,
          old_value,
          new_value,
          confidence
        FROM brain.patch_events
        WHERE ($1::text IS NULL OR strpos(lower(concat_ws(' ',
          patch_title, COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General'),
          subject, section, change_type, normalized_line, old_value, new_value
        )), lower($1)) > 0)
          AND ($2::text IS NULL OR $2 = 'all' OR entity_type = $2)
          AND ($3::text IS NULL OR $3 = 'all' OR change_type = $3)
          AND ($4::text IS NULL OR $4 = 'all' OR source_kind = $4)
          AND ($5::text IS NULL OR COALESCE(NULLIF(entity_name, ''), NULLIF(subject, ''), 'General') = $5)
          AND ($6::text IS NULL OR patch_external_id = $6)
        ORDER BY posted_at DESC NULLS LAST, patch_external_id ASC, line_index DESC, id DESC
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(query.search.as_deref())
    .bind(query.entity_type.as_deref())
    .bind(query.change_type.as_deref())
    .bind(query.source.as_deref())
    .bind(query.entity.as_deref())
    .bind(query.patch.as_deref())
    .bind(i64::from(limit) + 1)
    .bind(i64::from(offset))
    .fetch_all(&state.pool)
    .await?;

    let has_more = event_rows.len() > limit as usize;
    let events = event_rows
        .iter()
        .take(limit as usize)
        .map(rows::row_json)
        .collect::<Vec<_>>();
    let next_offset = if has_more {
        Some(u64::from(offset) + events.len() as u64)
    } else {
        None
    };
    Ok(Json(json!({
        "events": events,
        "next_offset": next_offset,
        "has_more": has_more,
    })))
}

pub async fn patch_notes(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let patch_rows = sqlx::query(
        r#"
        SELECT id, title, url, posted_at, translated_content, raw_content
        FROM patchnotes.changelog_posts
        ORDER BY posted_at DESC NULLS LAST, id DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    let patches = patch_rows
        .iter()
        .map(|row| {
            let translated = rows::string(row, "translated_content").unwrap_or_default();
            let raw = rows::string(row, "raw_content").unwrap_or_default();
            let content = if translated.trim().is_empty() {
                raw
            } else {
                translated
            };
            json!({
                "id": rows::value_from_row(row, "id"),
                "title": rows::string(row, "title").unwrap_or_else(|| "Patch Notes".to_string()),
                "url": rows::string(row, "url"),
                "posted_at": rows::value_from_row(row, "posted_at"),
                "translated_content": content,
                "sections": infer_sections(&content),
            })
        })
        .collect::<Vec<_>>();

    Ok(Json(json!({ "patches": patches })))
}

fn infer_sections(content: &str) -> Vec<&'static str> {
    let lower = content.to_ascii_lowercase();
    let mut sections = Vec::new();
    if lower.contains("item") || lower.contains("weapon") || lower.contains("spirit") {
        sections.push("items");
    }
    if lower.contains("hero") || lower.contains("held") || lower.contains("ability") {
        sections.push("helden");
    }
    if sections.is_empty()
        || lower.contains("general")
        || lower.contains("map")
        || lower.contains("matchmaking")
    {
        sections.push("allgemein");
    }
    sections
}
