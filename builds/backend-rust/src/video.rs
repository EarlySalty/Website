use std::{
    collections::HashMap, future::Future, net::SocketAddr, pin::Pin, sync::Arc, time::Duration,
};

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{postgres::PgRow, Postgres, QueryBuilder, Row, Transaction};

use crate::{
    app::AppState,
    auth,
    error::{AppError, AppResult},
    ids,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoStatus {
    Live,
    Pending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionReason {
    TagMatch,
    NoTag,
    NoApiKey,
    ApiError,
}

impl DecisionReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TagMatch => "tag_match",
            Self::NoTag => "no_tag",
            Self::NoApiKey => "no_api_key",
            Self::ApiError => "api_error",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Decision {
    pub status: VideoStatus,
    pub reason: DecisionReason,
}

impl Decision {
    pub const fn live(reason: DecisionReason) -> Self {
        Self {
            status: VideoStatus::Live,
            reason,
        }
    }

    pub const fn pending(reason: DecisionReason) -> Self {
        Self {
            status: VideoStatus::Pending,
            reason,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagLookupFailure {
    NoApiKey,
    ApiError,
}

pub fn decide(tags: Option<&[String]>, failure: Option<TagLookupFailure>) -> Decision {
    if let Some(failure) = failure {
        return Decision::pending(match failure {
            TagLookupFailure::NoApiKey => DecisionReason::NoApiKey,
            TagLookupFailure::ApiError => DecisionReason::ApiError,
        });
    }
    if tags
        .unwrap_or_default()
        .iter()
        .any(|tag| tag.eq_ignore_ascii_case("deadlock"))
    {
        Decision::live(DecisionReason::TagMatch)
    } else {
        Decision::pending(DecisionReason::NoTag)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeedVideo {
    pub yt_video_id: String,
    pub title: String,
    pub description: String,
    pub published_at: DateTime<Utc>,
    pub thumbnail_url: String,
}

pub fn parse_feed(xml: &str) -> anyhow::Result<Vec<FeedVideo>> {
    let document = roxmltree::Document::parse(xml)?;
    document
        .descendants()
        .filter(|node| node.has_tag_name(("http://www.w3.org/2005/Atom", "entry")))
        .map(|entry| {
            let text = |name| {
                entry
                    .descendants()
                    .find(|node| node.is_element() && node.tag_name().name() == name)
                    .and_then(|node| node.text())
                    .unwrap_or_default()
                    .trim()
                    .to_string()
            };
            let published_at = text("published").parse::<DateTime<Utc>>()?;
            let thumbnail_url = entry
                .descendants()
                .find(|node| node.is_element() && node.tag_name().name() == "thumbnail")
                .and_then(|node| node.attribute("url"))
                .unwrap_or_default()
                .to_string();
            Ok(FeedVideo {
                yt_video_id: text("videoId"),
                title: text("title"),
                description: text("description"),
                published_at,
                thumbnail_url,
            })
        })
        .collect()
}

pub fn positioned_items<T: Clone>(items: &[T]) -> Vec<(T, i32)> {
    items
        .iter()
        .enumerate()
        .map(|(position, id)| (id.clone(), position as i32))
        .collect()
}

pub(crate) type YoutubeFuture<'a, T> = Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;
pub(crate) type TagFuture<'a> = Pin<
    Box<dyn Future<Output = Result<HashMap<String, Vec<String>>, TagLookupFailure>> + Send + 'a>,
>;

pub trait YoutubeClient: Send + Sync {
    fn resolve_channel<'a>(&'a self, input: &'a str) -> YoutubeFuture<'a, YoutubeChannel>;
    fn channel_feed<'a>(&'a self, channel_id: &'a str) -> YoutubeFuture<'a, String>;
    fn playlist_feed<'a>(&'a self, playlist_id: &'a str) -> YoutubeFuture<'a, String>;
    fn video_tags<'a>(&'a self, video_ids: &'a [String]) -> TagFuture<'a>;
    fn backfill<'a>(&'a self, channel_id: &'a str) -> YoutubeFuture<'a, Vec<FeedVideo>>;
}

#[derive(Debug, Clone)]
pub struct YoutubeChannel {
    pub id: String,
    pub title: String,
}

pub struct ReqwestYoutubeClient {
    client: reqwest::Client,
    api_key: Option<String>,
}

fn is_valid_channel_id(value: &str) -> bool {
    value.len() == 24
        && value.starts_with("UC")
        && value[2..]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

impl ReqwestYoutubeClient {
    pub fn new(client: reqwest::Client, api_key: Option<String>) -> Self {
        Self { client, api_key }
    }

    async fn api_json(&self, endpoint: &str, params: &[(&str, String)]) -> anyhow::Result<Value> {
        let key = self
            .api_key
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("YouTube API key missing"))?;
        let response = self
            .client
            .get(format!("https://www.googleapis.com/youtube/v3/{endpoint}"))
            .query(params)
            .query(&[("key", key)])
            .send()
            .await?
            .error_for_status()?;
        Ok(response.json().await?)
    }
}

impl YoutubeClient for ReqwestYoutubeClient {
    fn resolve_channel<'a>(&'a self, input: &'a str) -> YoutubeFuture<'a, YoutubeChannel> {
        Box::pin(async move {
            let trimmed = input.trim().trim_end_matches('/');
            let direct = trimmed
                .rsplit_once("/channel/")
                .map(|(_, id)| id)
                .filter(|id| is_valid_channel_id(id))
                .or_else(|| is_valid_channel_id(trimmed).then_some(trimmed));
            if let Some(id) = direct {
                return Ok(YoutubeChannel {
                    id: id.to_string(),
                    title: String::new(),
                });
            }
            let handle = trimmed
                .rsplit('/')
                .next()
                .unwrap_or(trimmed)
                .trim_start_matches('@');
            let body = self
                .api_json(
                    "channels",
                    &[("part", "snippet".into()), ("forHandle", handle.into())],
                )
                .await?;
            let item = body["items"]
                .as_array()
                .and_then(|v| v.first())
                .ok_or_else(|| anyhow::anyhow!("channel not found"))?;
            Ok(YoutubeChannel {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                title: item["snippet"]["title"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
            })
        })
    }

    fn channel_feed<'a>(&'a self, channel_id: &'a str) -> YoutubeFuture<'a, String> {
        Box::pin(async move {
            Ok(self
                .client
                .get("https://www.youtube.com/feeds/videos.xml")
                .query(&[("channel_id", channel_id)])
                .send()
                .await?
                .error_for_status()?
                .text()
                .await?)
        })
    }

    fn playlist_feed<'a>(&'a self, playlist_id: &'a str) -> YoutubeFuture<'a, String> {
        Box::pin(async move {
            Ok(self
                .client
                .get("https://www.youtube.com/feeds/videos.xml")
                .query(&[("playlist_id", playlist_id)])
                .send()
                .await?
                .error_for_status()?
                .text()
                .await?)
        })
    }

    fn video_tags<'a>(&'a self, video_ids: &'a [String]) -> TagFuture<'a> {
        Box::pin(async move {
            if self.api_key.is_none() {
                return Err(TagLookupFailure::NoApiKey);
            }
            let body = self
                .api_json(
                    "videos",
                    &[("part", "snippet".into()), ("id", video_ids.join(","))],
                )
                .await
                .map_err(|_| TagLookupFailure::ApiError)?;
            Ok(body["items"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|item| {
                    let id = item["id"].as_str()?.to_string();
                    let tags = item["snippet"]["tags"]
                        .as_array()
                        .map(|v| {
                            v.iter()
                                .filter_map(|v| v.as_str().map(str::to_string))
                                .collect()
                        })
                        .unwrap_or_default();
                    Some((id, tags))
                })
                .collect())
        })
    }

    fn backfill<'a>(&'a self, channel_id: &'a str) -> YoutubeFuture<'a, Vec<FeedVideo>> {
        Box::pin(async move {
            if self.api_key.is_none() {
                return Ok(Vec::new());
            }
            let channel = self
                .api_json(
                    "channels",
                    &[("part", "contentDetails".into()), ("id", channel_id.into())],
                )
                .await?;
            let uploads = channel["items"]
                .as_array()
                .and_then(|v| v.first())
                .and_then(|v| v["contentDetails"]["relatedPlaylists"]["uploads"].as_str())
                .ok_or_else(|| anyhow::anyhow!("uploads playlist missing"))?;
            let mut page = None::<String>;
            let mut videos = Vec::new();
            loop {
                let mut params = vec![
                    ("part", "snippet".into()),
                    ("playlistId", uploads.into()),
                    ("maxResults", "50".into()),
                ];
                if let Some(token) = page.as_ref() {
                    params.push(("pageToken", token.clone()));
                }
                let body = self.api_json("playlistItems", &params).await?;
                for item in body["items"].as_array().into_iter().flatten() {
                    let snippet = &item["snippet"];
                    let id = snippet["resourceId"]["videoId"]
                        .as_str()
                        .unwrap_or_default();
                    let published = snippet["publishedAt"]
                        .as_str()
                        .unwrap_or_default()
                        .parse::<DateTime<Utc>>();
                    if !id.is_empty() {
                        videos.push(FeedVideo {
                            yt_video_id: id.into(),
                            title: snippet["title"].as_str().unwrap_or_default().into(),
                            description: snippet["description"].as_str().unwrap_or_default().into(),
                            published_at: published?,
                            thumbnail_url: snippet["thumbnails"]["high"]["url"]
                                .as_str()
                                .unwrap_or_default()
                                .into(),
                        });
                    }
                }
                page = body["nextPageToken"].as_str().map(str::to_string);
                if page.is_none() {
                    break;
                }
            }
            Ok(videos)
        })
    }
}

fn youtube_client(state: &AppState) -> Arc<dyn YoutubeClient> {
    Arc::new(ReqwestYoutubeClient::new(
        state.http.clone(),
        state.cfg.youtube_api_key.clone(),
    ))
}

async fn require_creator(
    state: &AppState,
    headers: &HeaderMap,
    peer: SocketAddr,
) -> AppResult<auth::User> {
    let user = auth::require_authenticated_user(state, headers, Some(peer)).await?;
    let role_id = state
        .cfg
        .ddl_creator_role_id
        .ok_or_else(|| AppError::forbidden("Der Creator-Bereich ist noch nicht freigeschaltet"))?;
    let token = state.cfg.discord_bot_token.as_deref().ok_or_else(|| {
        AppError::forbidden(
            "Deine Creator-Rolle kann gerade nicht geprüft werden, versuch es gleich nochmal",
        )
    })?;
    let response = state
        .http
        .get(format!(
            "{}/guilds/{}/members/{}",
            state.cfg.discord_api_base.trim_end_matches('/'),
            state.cfg.scrim_guild_id,
            user.sub
        ))
        .header("Authorization", format!("Bot {token}"))
        .send()
        .await
        .map_err(|_| {
            AppError::forbidden(
                "Deine Creator-Rolle kann gerade nicht geprüft werden, versuch es gleich nochmal",
            )
        })?;
    if !response.status().is_success() {
        return Err(AppError::forbidden(
            "Dafür brauchst du die Creator-Rolle auf unserem Discord-Server",
        ));
    }
    let member: Value = response.json().await.map_err(|_| {
        AppError::forbidden(
            "Deine Creator-Rolle kann gerade nicht geprüft werden, versuch es gleich nochmal",
        )
    })?;
    let has_role = member["roles"].as_array().is_some_and(|roles| {
        roles
            .iter()
            .any(|role| role.as_str() == Some(&role_id.to_string()))
    });
    if !has_role {
        return Err(AppError::forbidden(
            "Dafür brauchst du die Creator-Rolle auf unserem Discord-Server",
        ));
    }
    Ok(user)
}

#[derive(Deserialize)]
pub struct ChannelBody {
    channel: String,
}

pub async fn own_channels(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = require_creator(&state, &headers, peer).await?;
    let owner = auth::parse_discord_user_id(&user.sub)?;
    let rows = sqlx::query("SELECT id,youtube_channel_id,youtube_url,title,active FROM video_library.channels WHERE owner_discord_id=$1 ORDER BY created_at DESC")
        .bind(owner)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(Value::Array(
        rows.iter()
            .map(|row| {
                json!({
                    "id": row.try_get::<i64, _>("id").unwrap_or_default(),
                    "youtube_channel_id": row.try_get::<String, _>("youtube_channel_id").unwrap_or_default(),
                    "youtube_url": row.try_get::<String, _>("youtube_url").unwrap_or_default(),
                    "title": row.try_get::<String, _>("title").unwrap_or_default(),
                    "active": row.try_get::<bool, _>("active").unwrap_or(false),
                })
            })
            .collect(),
    )))
}

pub async fn register_channel(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ChannelBody>,
) -> AppResult<Json<Value>> {
    let user = require_creator(&state, &headers, peer).await?;
    let discord_id = auth::parse_discord_user_id(&user.sub)?;
    let client = youtube_client(&state);
    let channel = client.resolve_channel(&body.channel).await.map_err(|_| {
        AppError::bad_request("Das sieht nicht nach einem gültigen YouTube-Kanal aus")
    })?;
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query("INSERT INTO video_library.channels (owner_discord_id,youtube_channel_id,youtube_url,title,active,detached_at) VALUES ($1,$2,$3,$4,TRUE,NULL) ON CONFLICT (youtube_channel_id) DO UPDATE SET active=TRUE, detached_at=NULL WHERE video_library.channels.owner_discord_id=EXCLUDED.owner_discord_id RETURNING id")
        .bind(discord_id).bind(&channel.id).bind(format!("https://www.youtube.com/channel/{}", channel.id)).bind(&channel.title).fetch_optional(&mut *tx).await?
        .ok_or_else(|| AppError::http(StatusCode::CONFLICT, "Dieser YouTube-Kanal ist bereits von jemand anderem registriert"))?;
    let id: i64 = row.try_get("id")?;
    sqlx::query("INSERT INTO video_library.channel_audit_log (channel_id,actor_discord_id,action) VALUES ($1,$2,'registered')").bind(id).bind(&user.sub).execute(&mut *tx).await?;
    tx.commit().await?;
    if let Ok(xml) = client.channel_feed(&channel.id).await {
        if let Ok(videos) = parse_feed(&xml) {
            let _ = ingest_videos(&state, Some(id), videos, "rss", client.as_ref()).await;
        }
    }
    if let Ok(videos) = client.backfill(&channel.id).await {
        let _ = ingest_videos(&state, Some(id), videos, "backfill", client.as_ref()).await;
    }
    Ok(Json(json!({"id": id, "youtube_channel_id": channel.id})))
}

pub async fn detach_channel(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let user = auth::require_admin_user(&state, &headers, Some(peer)).await?;
    sqlx::query("UPDATE video_library.channels SET active=FALSE, detached_at=now() WHERE id=$1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    sqlx::query("INSERT INTO video_library.channel_audit_log (channel_id,actor_discord_id,action) VALUES ($1,$2,'detached')").bind(id).bind(user.sub).execute(&state.pool).await?;
    Ok(Json(json!({"ok": true})))
}

pub async fn detach_own_channel(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let user = require_creator(&state, &headers, peer).await?;
    let owner = auth::parse_discord_user_id(&user.sub)?;
    let result = sqlx::query("UPDATE video_library.channels SET active=FALSE,detached_at=now() WHERE id=$1 AND owner_discord_id=$2 AND active=TRUE")
        .bind(id).bind(owner).execute(&state.pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("Kanal nicht gefunden"));
    }
    sqlx::query("INSERT INTO video_library.channel_audit_log(channel_id,actor_discord_id,action) VALUES($1,$2,'detached')")
        .bind(id).bind(user.sub).execute(&state.pool).await?;
    Ok(Json(json!({"ok":true})))
}

pub async fn ingest_videos(
    state: &AppState,
    channel_id: Option<i64>,
    videos: Vec<FeedVideo>,
    source: &str,
    client: &dyn YoutubeClient,
) -> AppResult<()> {
    for batch in videos.chunks(50) {
        let ids: Vec<String> = batch.iter().map(|v| v.yt_video_id.clone()).collect();
        let tags = client.video_tags(&ids).await;
        for video in batch {
            let (video_tags, failure) = match &tags {
                Ok(map) => (
                    Some(
                        map.get(&video.yt_video_id)
                            .map(Vec::as_slice)
                            .unwrap_or_default(),
                    ),
                    None,
                ),
                Err(failure) => (None, Some(*failure)),
            };
            let decision = decide(video_tags, failure);
            let status = match decision.status {
                VideoStatus::Live => "live",
                VideoStatus::Pending => "pending",
            };
            let mut tx = state.pool.begin().await?;
            let existing = sqlx::query(
                "SELECT id,status FROM video_library.videos WHERE yt_video_id=$1 FOR UPDATE",
            )
            .bind(&video.yt_video_id)
            .fetch_optional(&mut *tx)
            .await?;
            let (video_id, changed) = if let Some(existing) = existing {
                let video_id: i64 = existing.try_get("id")?;
                let old_status: String = existing.try_get("status")?;
                let next_status = if matches!(old_status.as_str(), "hidden" | "live") {
                    old_status.as_str()
                } else {
                    status
                };
                sqlx::query("UPDATE video_library.videos SET channel_id=COALESCE(channel_id,$1),title=$2,description=$3,published_at=$4,thumbnail_url=$5,status=$6,updated_at=now() WHERE id=$7")
                    .bind(channel_id).bind(&video.title).bind(&video.description).bind(video.published_at).bind(&video.thumbnail_url).bind(next_status).bind(video_id).execute(&mut *tx).await?;
                (video_id, old_status != next_status)
            } else {
                let video_id: i64 = sqlx::query_scalar("INSERT INTO video_library.videos (channel_id,yt_video_id,title,description,published_at,thumbnail_url,status,source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id")
                    .bind(channel_id).bind(&video.yt_video_id).bind(&video.title).bind(&video.description).bind(video.published_at).bind(&video.thumbnail_url).bind(status).bind(source).fetch_one(&mut *tx).await?;
                (video_id, true)
            };
            if changed {
                let title = video.title.chars().take(120).collect::<String>();
                sqlx::query("INSERT INTO video_library.decision_log (video_id,yt_video_id,title,verdict,reason) VALUES ($1,$2,$3,$4,$5)")
                    .bind(video_id).bind(&video.yt_video_id).bind(&title).bind(status).bind(decision.reason.as_str()).execute(&mut *tx).await?;
                tracing::info!(yt_video_id=%video.yt_video_id, title=%title, verdict=status, reason=decision.reason.as_str(), "video approval decision");
            }
            tx.commit().await?;
        }
    }
    Ok(())
}

#[derive(Default, Deserialize)]
pub struct FeedQuery {
    #[serde(rename = "type")]
    kind: Option<String>,
    hero: Option<String>,
    level: Option<String>,
    q: Option<String>,
}

pub async fn public_feed(
    State(state): State<AppState>,
    Query(query): Query<FeedQuery>,
) -> AppResult<Json<Value>> {
    let mut sql = QueryBuilder::new("SELECT DISTINCT v.* FROM video_library.videos v ");
    if query.kind.is_some() || query.hero.is_some() || query.level.is_some() {
        sql.push("JOIN video_library.video_taxonomy vt ON vt.video_id=v.id JOIN video_library.taxonomy t ON t.id=vt.taxonomy_id ");
    }
    sql.push("WHERE v.status='live' ");
    for (dimension, value) in [
        ("type", query.kind.as_ref()),
        ("hero", query.hero.as_ref()),
        ("level", query.level.as_ref()),
    ] {
        if let Some(value) = value {
            sql.push("AND EXISTS (SELECT 1 FROM video_library.video_taxonomy vx JOIN video_library.taxonomy tx ON tx.id=vx.taxonomy_id WHERE vx.video_id=v.id AND tx.dimension=").push_bind(dimension).push(" AND tx.slug=").push_bind(value).push(") ");
        }
    }
    if let Some(q) = query.q.filter(|q| !q.trim().is_empty()) {
        sql.push("AND (to_tsvector('german',v.title||' '||v.description) @@ websearch_to_tsquery('german',").push_bind(q.clone()).push(") OR EXISTS (SELECT 1 FROM video_library.free_tags f WHERE f.video_id=v.id AND f.tag ILIKE '%'||").push_bind(q).push("||'%')) ");
    }
    sql.push("ORDER BY v.published_at DESC");
    let rows = sql.build().fetch_all(&state.pool).await?;
    Ok(Json(Value::Array(rows.iter().map(video_json).collect())))
}

pub async fn own_videos(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let user = require_creator(&state, &headers, peer).await?;
    let owner = auth::parse_discord_user_id(&user.sub)?;
    let rows = sqlx::query("SELECT v.* FROM video_library.videos v JOIN video_library.channels c ON c.id=v.channel_id WHERE c.owner_discord_id=$1 ORDER BY v.published_at DESC")
        .bind(owner).fetch_all(&state.pool).await?;
    Ok(Json(Value::Array(rows.iter().map(video_json).collect())))
}

fn video_json(row: &PgRow) -> Value {
    json!({"id": row.try_get::<i64,_>("id").unwrap_or_default(), "yt_video_id": row.try_get::<String,_>("yt_video_id").unwrap_or_default(), "title": row.try_get::<String,_>("title").unwrap_or_default(), "description": row.try_get::<String,_>("description").unwrap_or_default(), "published_at": row.try_get::<DateTime<Utc>,_>("published_at").ok(), "thumbnail_url": row.try_get::<String,_>("thumbnail_url").unwrap_or_default(), "status": row.try_get::<String,_>("status").unwrap_or_default()})
}

async fn acting_user(
    state: &AppState,
    headers: &HeaderMap,
    peer: SocketAddr,
) -> AppResult<auth::User> {
    let user = auth::require_authenticated_user(state, headers, Some(peer)).await?;
    if user.role == "admin" {
        Ok(user)
    } else {
        require_creator(state, headers, peer).await
    }
}

async fn write_action_audit(
    tx: &mut Transaction<'_, Postgres>,
    user: &auth::User,
    action: &str,
    object_type: &str,
    object_id: impl ToString,
    detail: Option<Value>,
) -> AppResult<()> {
    sqlx::query("INSERT INTO video_library.action_audit_log(actor_discord_id,action,object_type,object_id,detail) VALUES($1,$2,$3,$4,$5)")
        .bind(&user.sub)
        .bind(action)
        .bind(object_type)
        .bind(object_id.to_string())
        .bind(detail)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn owns_video(state: &AppState, video_id: i64, user: &auth::User) -> AppResult<()> {
    if user.role == "admin" {
        return Ok(());
    }
    let owner: Option<i64> = sqlx::query_scalar("SELECT c.owner_discord_id FROM video_library.videos v JOIN video_library.channels c ON c.id=v.channel_id WHERE v.id=$1")
        .bind(video_id).fetch_optional(&state.pool).await?;
    if owner.map(|id| id.to_string()).as_deref() != Some(&user.sub) {
        return Err(AppError::forbidden(
            "Dieses Video gehört einem anderen Creator",
        ));
    }
    Ok(())
}

pub async fn approve_video(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    owns_video(&state, id, &user).await?;
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query("UPDATE video_library.videos SET status='live',updated_at=now() WHERE id=$1 AND status='pending'").bind(id).execute(&mut *tx).await?;
    if result.rows_affected() > 0 {
        write_action_audit(&mut tx, &user, "video_approved", "video", id, None).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({"ok": true})))
}

pub async fn hide_video(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    owns_video(&state, id, &user).await?;
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query("UPDATE video_library.videos SET status='hidden',updated_at=now() WHERE id=$1 AND status<>'hidden'")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if result.rows_affected() > 0 {
        write_action_audit(&mut tx, &user, "video_hidden", "video", id, None).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({"ok": true})))
}

#[derive(Deserialize)]
pub struct VideoTagsBody {
    taxonomy_ids: Vec<i64>,
    #[serde(default)]
    free_tags: Vec<String>,
}

pub async fn tag_video(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
    Json(body): Json<VideoTagsBody>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    owns_video(&state, id, &user).await?;
    let taxonomy_count = body.taxonomy_ids.len();
    let free_tags = body
        .free_tags
        .into_iter()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .collect::<Vec<_>>();
    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM video_library.video_taxonomy WHERE video_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    for taxonomy_id in body.taxonomy_ids {
        sqlx::query("INSERT INTO video_library.video_taxonomy(video_id,taxonomy_id) VALUES($1,$2)")
            .bind(id)
            .bind(taxonomy_id)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("DELETE FROM video_library.free_tags WHERE video_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    for tag in &free_tags {
        sqlx::query("INSERT INTO video_library.free_tags(video_id,tag) VALUES($1,$2) ON CONFLICT DO NOTHING").bind(id).bind(tag).execute(&mut *tx).await?;
    }
    write_action_audit(
        &mut tx,
        &user,
        "video_tagged",
        "video",
        id,
        Some(json!({"taxonomy_count": taxonomy_count, "free_tag_count": free_tags.len()})),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"ok": true})))
}

pub async fn list_taxonomy(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows = sqlx::query("SELECT id,dimension,name,slug FROM video_library.taxonomy WHERE active=TRUE ORDER BY dimension,name").fetch_all(&state.pool).await?;
    Ok(Json(Value::Array(rows.iter().map(|r| json!({"id":r.try_get::<i64,_>("id").unwrap_or_default(),"dimension":r.try_get::<String,_>("dimension").unwrap_or_default(),"name":r.try_get::<String,_>("name").unwrap_or_default(),"slug":r.try_get::<String,_>("slug").unwrap_or_default()})).collect())))
}

#[derive(Deserialize)]
pub struct TaxonomyBody {
    dimension: String,
    name: String,
    slug: String,
}

pub async fn create_taxonomy(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<TaxonomyBody>,
) -> AppResult<Json<Value>> {
    let user = auth::require_admin_user(&state, &headers, Some(peer)).await?;
    let mut tx = state.pool.begin().await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO video_library.taxonomy(dimension,name,slug) VALUES($1,$2,$3) RETURNING id",
    )
    .bind(body.dimension)
    .bind(body.name)
    .bind(body.slug)
    .fetch_one(&mut *tx)
    .await?;
    write_action_audit(&mut tx, &user, "taxonomy_created", "taxonomy", id, None).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id})))
}

pub async fn update_taxonomy(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
    Json(body): Json<TaxonomyBody>,
) -> AppResult<Json<Value>> {
    let user = auth::require_admin_user(&state, &headers, Some(peer)).await?;
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query(
        "UPDATE video_library.taxonomy SET dimension=$1,name=$2,slug=$3,active=TRUE WHERE id=$4",
    )
    .bind(body.dimension)
    .bind(body.name)
    .bind(body.slug)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() > 0 {
        write_action_audit(&mut tx, &user, "taxonomy_updated", "taxonomy", id, None).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({"ok":true})))
}

pub async fn delete_taxonomy(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let user = auth::require_admin_user(&state, &headers, Some(peer)).await?;
    let mut tx = state.pool.begin().await?;
    let result =
        sqlx::query("UPDATE video_library.taxonomy SET active=FALSE WHERE id=$1 AND active=TRUE")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    if result.rows_affected() > 0 {
        write_action_audit(&mut tx, &user, "taxonomy_deactivated", "taxonomy", id, None).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({"ok":true})))
}

#[derive(Deserialize)]
pub struct PlaylistBody {
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default = "manual_source")]
    source: String,
    yt_playlist_id: Option<String>,
    #[serde(default)]
    video_ids: Option<Vec<i64>>,
    #[serde(default)]
    featured: bool,
}
fn manual_source() -> String {
    "manual".into()
}

pub async fn create_playlist(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<PlaylistBody>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    if body.featured && user.role != "admin" {
        return Err(AppError::forbidden("Lernpfade können nur Admins anlegen"));
    }
    let owner = auth::parse_discord_user_id(&user.sub)?;
    let id = ids::id16();
    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO video_library.playlists(id,owner_discord_id,title,description,featured,source,yt_playlist_id) VALUES($1,$2,$3,$4,$5,$6,$7)").bind(&id).bind(owner).bind(body.title).bind(body.description).bind(body.featured).bind(&body.source).bind(&body.yt_playlist_id).execute(&mut *tx).await?;
    for (video_id, position) in positioned_items(body.video_ids.as_deref().unwrap_or_default()) {
        sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) VALUES($1,$2,$3)").bind(&id).bind(video_id).bind(position).execute(&mut *tx).await?;
    }
    write_action_audit(
        &mut tx,
        &user,
        "playlist_created",
        "playlist",
        &id,
        Some(json!({"source": &body.source, "featured": body.featured})),
    )
    .await?;
    tx.commit().await?;
    let (sync_failed, sync_error) =
        sync_playlist_after_commit(&state, &id, &body.source, body.yt_playlist_id.as_deref()).await;
    Ok(Json(
        json!({"id":id,"sync_failed":sync_failed,"sync_error":sync_error}),
    ))
}

pub async fn update_playlist(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
    Json(body): Json<PlaylistBody>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    let playlist =
        sqlx::query("SELECT owner_discord_id,featured FROM video_library.playlists WHERE id=$1")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| AppError::not_found("Playlist nicht gefunden"))?;
    let owner: i64 = playlist.try_get("owner_discord_id")?;
    let was_featured: bool = playlist.try_get("featured")?;
    if user.role != "admin" && owner.to_string() != user.sub {
        return Err(AppError::forbidden(
            "Diese Playlist gehört einem anderen Creator",
        ));
    }
    if body.featured && user.role != "admin" {
        return Err(AppError::forbidden("Lernpfade können nur Admins anlegen"));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("UPDATE video_library.playlists SET title=$1,description=$2,featured=$3,source=$4,yt_playlist_id=$5,updated_at=now() WHERE id=$6")
        .bind(body.title).bind(body.description).bind(body.featured).bind(&body.source).bind(&body.yt_playlist_id).bind(&id).execute(&mut *tx).await?;
    if let Some(video_ids) = body.video_ids.as_deref() {
        sqlx::query("DELETE FROM video_library.playlist_items WHERE playlist_id=$1")
            .bind(&id)
            .execute(&mut *tx)
            .await?;
        for (video_id, position) in positioned_items(video_ids) {
            sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) VALUES($1,$2,$3)").bind(&id).bind(video_id).bind(position).execute(&mut *tx).await?;
        }
    }
    write_action_audit(
        &mut tx,
        &user,
        "playlist_updated",
        "playlist",
        &id,
        Some(json!({"source": &body.source, "featured": body.featured})),
    )
    .await?;
    if was_featured != body.featured {
        write_action_audit(
            &mut tx,
            &user,
            "playlist_featured",
            "playlist",
            &id,
            Some(json!({"from": was_featured, "to": body.featured})),
        )
        .await?;
    }
    tx.commit().await?;
    let (sync_failed, sync_error) =
        sync_playlist_after_commit(&state, &id, &body.source, body.yt_playlist_id.as_deref()).await;
    Ok(Json(
        json!({"ok":true,"sync_failed":sync_failed,"sync_error":sync_error}),
    ))
}

pub async fn delete_playlist(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let user = acting_user(&state, &headers, peer).await?;
    let owner: Option<i64> =
        sqlx::query_scalar("SELECT owner_discord_id FROM video_library.playlists WHERE id=$1")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await?;
    let owner = owner.ok_or_else(|| AppError::not_found("Playlist nicht gefunden"))?;
    if user.role != "admin" && owner.to_string() != user.sub {
        return Err(AppError::forbidden(
            "Diese Playlist gehört einem anderen Creator",
        ));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM video_library.playlists WHERE id=$1")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    write_action_audit(&mut tx, &user, "playlist_deleted", "playlist", &id, None).await?;
    tx.commit().await?;
    Ok(Json(json!({"ok":true})))
}

async fn sync_playlist(state: &AppState, id: &str, playlist_id: &str) -> AppResult<()> {
    let client = youtube_client(state);
    sync_playlist_with_client(state, id, playlist_id, client.as_ref()).await
}

async fn sync_playlist_after_commit(
    state: &AppState,
    id: &str,
    source: &str,
    yt_playlist_id: Option<&str>,
) -> (bool, Option<String>) {
    let Some(playlist_id) = (source == "yt").then_some(yt_playlist_id).flatten() else {
        return (false, None);
    };
    match sync_playlist(state, id, playlist_id).await {
        Ok(()) => (false, None),
        Err(error) => {
            let reason = match &error {
                AppError::Http(_, detail) => detail.clone(),
                AppError::Db(_) => "Database error".to_string(),
                AppError::Json(error) => error.to_string(),
                AppError::Reqwest(_) => "Internal service is not reachable".to_string(),
            };
            tracing::warn!(?error, sync_error=%reason, playlist_id=%id, "video playlist sync failed");
            (true, Some(reason))
        }
    }
}

pub(crate) async fn sync_playlist_with_client(
    state: &AppState,
    id: &str,
    playlist_id: &str,
    client: &dyn YoutubeClient,
) -> AppResult<()> {
    let xml = client.playlist_feed(playlist_id).await.map_err(|_| {
        AppError::service_unavailable("Die YouTube-Playlist konnte nicht geladen werden")
    })?;
    let videos = parse_feed(&xml).map_err(|_| {
        AppError::service_unavailable("Die YouTube-Playlist konnte nicht gelesen werden")
    })?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM video_library.playlist_items WHERE playlist_id=$1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    for (position, video) in videos.iter().enumerate() {
        sqlx::query("INSERT INTO video_library.playlist_items(playlist_id,video_id,position) SELECT $1,v.id,$2 FROM video_library.videos v JOIN video_library.channels c ON c.id=v.channel_id WHERE v.yt_video_id=$3 ON CONFLICT DO NOTHING")
            .bind(id)
            .bind(position as i32)
            .bind(&video.yt_video_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn list_playlists(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows=sqlx::query("SELECT id,owner_discord_id,title,description,featured,source,yt_playlist_id FROM video_library.playlists ORDER BY featured DESC,created_at DESC").fetch_all(&state.pool).await?;
    Ok(Json(Value::Array(rows.iter().map(playlist_json).collect())))
}
fn playlist_json(r: &PgRow) -> Value {
    json!({"id":r.try_get::<String,_>("id").unwrap_or_default(),"owner_discord_id":r.try_get::<i64,_>("owner_discord_id").unwrap_or_default(),"title":r.try_get::<String,_>("title").unwrap_or_default(),"description":r.try_get::<String,_>("description").unwrap_or_default(),"featured":r.try_get::<bool,_>("featured").unwrap_or(false),"source":r.try_get::<String,_>("source").unwrap_or_default(),"yt_playlist_id":r.try_get::<Option<String>,_>("yt_playlist_id").ok().flatten()})
}

pub async fn playlist_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let playlist=sqlx::query("SELECT id,owner_discord_id,title,description,featured,source,yt_playlist_id FROM video_library.playlists WHERE id=$1").bind(&id).fetch_optional(&state.pool).await?.ok_or_else(||AppError::not_found("Playlist nicht gefunden"))?;
    let rows=sqlx::query("SELECT v.* FROM video_library.playlist_items i JOIN video_library.videos v ON v.id=i.video_id WHERE i.playlist_id=$1 AND v.status='live' ORDER BY i.position").bind(&id).fetch_all(&state.pool).await?;
    let mut value = playlist_json(&playlist);
    value["videos"] = Value::Array(rows.iter().map(video_json).collect());
    Ok(Json(value))
}

pub async fn creator_profile(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Json<Value>> {
    let creator=sqlx::query("SELECT u.id,u.display_name,u.avatar_url,c.youtube_url FROM core.meta_users u JOIN video_library.channels c ON c.owner_discord_id=u.id AND c.active=TRUE WHERE u.id=$1 LIMIT 1").bind(id).fetch_optional(&state.pool).await?.ok_or_else(||AppError::not_found("Creator nicht gefunden"))?;
    let videos=sqlx::query("SELECT v.* FROM video_library.videos v JOIN video_library.channels c ON c.id=v.channel_id WHERE c.owner_discord_id=$1 AND v.status='live' ORDER BY v.published_at DESC").bind(id).fetch_all(&state.pool).await?;
    let playlists=sqlx::query("SELECT id,owner_discord_id,title,description,featured,source,yt_playlist_id FROM video_library.playlists WHERE owner_discord_id=$1 ORDER BY featured DESC,created_at DESC").bind(id).fetch_all(&state.pool).await?;
    Ok(Json(
        json!({"id":id,"name":creator.try_get::<Option<String>,_>("display_name").ok().flatten(),"avatar_url":creator.try_get::<Option<String>,_>("avatar_url").ok().flatten(),"youtube_url":creator.try_get::<String,_>("youtube_url").unwrap_or_default(),"videos":videos.iter().map(video_json).collect::<Vec<_>>(),"playlists":playlists.iter().map(playlist_json).collect::<Vec<_>>() }),
    ))
}

pub fn spawn_ingest_worker(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15 * 60));
        loop {
            interval.tick().await;
            let rows = match sqlx::query(
                "SELECT id,youtube_channel_id FROM video_library.channels WHERE active=TRUE",
            )
            .fetch_all(&state.pool)
            .await
            {
                Ok(rows) => rows,
                Err(error) => {
                    tracing::warn!(?error, "video channel load failed");
                    continue;
                }
            };
            let client = youtube_client(&state);
            for row in rows {
                let id = row.try_get::<i64, _>("id").unwrap_or_default();
                let channel = row
                    .try_get::<String, _>("youtube_channel_id")
                    .unwrap_or_default();
                if let Ok(xml) = client.channel_feed(&channel).await {
                    if let Ok(videos) = parse_feed(&xml) {
                        if let Err(error) =
                            ingest_videos(&state, Some(id), videos, "rss", client.as_ref()).await
                        {
                            tracing::warn!(?error, channel_id=%channel, "video ingest failed");
                        }
                    }
                }
            }
            if let Ok(playlists) = sqlx::query(
                "SELECT id,yt_playlist_id FROM video_library.playlists WHERE source='yt'",
            )
            .fetch_all(&state.pool)
            .await
            {
                for playlist in playlists {
                    if let (Ok(id), Ok(Some(yt_id))) = (
                        playlist.try_get::<String, _>("id"),
                        playlist.try_get::<Option<String>, _>("yt_playlist_id"),
                    ) {
                        if let Err(error) = sync_playlist(&state, &id, &yt_id).await {
                            tracing::warn!(?error, playlist_id=%id, "video playlist sync failed");
                        }
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decide_requires_case_insensitive_deadlock_tag() {
        assert_eq!(
            decide(Some(&["Guide".into(), "DeAdLoCk".into()]), None),
            Decision::live(DecisionReason::TagMatch)
        );
        assert_eq!(
            decide(Some(&["Guide".into()]), None),
            Decision::pending(DecisionReason::NoTag)
        );
    }

    #[test]
    fn decide_is_pending_without_key_or_after_api_error() {
        assert_eq!(
            decide(None, Some(TagLookupFailure::NoApiKey)),
            Decision::pending(DecisionReason::NoApiKey)
        );
        assert_eq!(
            decide(None, Some(TagLookupFailure::ApiError)),
            Decision::pending(DecisionReason::ApiError)
        );
    }

    #[test]
    fn parses_youtube_atom_fixture() {
        let videos =
            parse_feed(include_str!("../tests/fixtures/youtube-feed.xml")).expect("fixture parses");
        assert_eq!(videos.len(), 2);
        assert_eq!(videos[0].yt_video_id, "video-001");
        assert_eq!(videos[0].title, "Deadlock Grundlagen");
        assert_eq!(videos[0].description, "Laning und Souls");
        assert_eq!(
            videos[0].thumbnail_url,
            "https://i.ytimg.com/vi/video-001/hqdefault.jpg"
        );
        assert_eq!(
            videos[0].published_at.to_rfc3339(),
            "2026-07-10T17:30:00+00:00"
        );
    }

    #[test]
    fn playlist_positions_follow_input_order() {
        assert_eq!(
            positioned_items(&["video-c".into(), "video-a".into(), "video-b".into()]),
            vec![
                ("video-c".to_string(), 0),
                ("video-a".to_string(), 1),
                ("video-b".to_string(), 2),
            ]
        );
    }

    #[test]
    fn youtube_channel_id_format_is_strict() {
        assert!(is_valid_channel_id("UCabcdefghijklmnopqrstuv"));
        assert!(is_valid_channel_id("UCabc_DEF-ghiJKLmnoPQRST"));
        assert!(!is_valid_channel_id("UC123"));
        assert!(!is_valid_channel_id("UCabcdefghijklmnopqrstu!"));
        assert!(!is_valid_channel_id("XXabcdefghijklmnopqrstuv"));
    }
}
