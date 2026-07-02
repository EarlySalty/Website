use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{app::AppState, error::AppResult, rows};

pub async fn patch_timeline(State(state): State<AppState>) -> AppResult<Json<Value>> {
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
    .fetch_one(&state.pool)
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
    .fetch_all(&state.pool)
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
    .fetch_all(&state.pool)
    .await?;

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
          COALESCE(NULLIF(entity_name, ''), NULLIF(subject, '')) AS entity_name,
          subject,
          change_type,
          normalized_line,
          old_value,
          new_value,
          confidence
        FROM brain.patch_events
        ORDER BY posted_at ASC NULLS LAST, patch_external_id ASC, line_index ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "summary": rows::row_json(&summary),
        "patches": patch_rows.iter().map(rows::row_json).collect::<Vec<_>>(),
        "entities": entity_rows.iter().map(rows::row_json).collect::<Vec<_>>(),
        "events": event_rows.iter().map(rows::row_json).collect::<Vec<_>>(),
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
