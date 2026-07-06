use std::{collections::BTreeSet, net::SocketAddr};

use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgRow, Row};

use crate::{
    app::AppState,
    auth::{self, User},
    discord_broker::{
        DiscordCreateRoleBrokerRequest, DiscordRoleBroker, DiscordRoleBrokerRequest,
        DiscordRoleOperation,
    },
    error::{AppError, AppResult},
};

#[derive(Debug, Serialize)]
pub struct ScrimParticipant {
    pub id: i32,
    pub display_name: String,
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub availability_slots: WeeklyAvailability,
    pub availability_confirmed: bool,
    pub status: String,
    pub source: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DayStatus {
    Available,
    Unavailable,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DaySlot {
    pub status: DayStatus,
    pub from: Option<u16>,
    pub to: Option<u16>,
}

impl Default for DaySlot {
    fn default() -> Self {
        Self::unknown()
    }
}

impl DaySlot {
    fn available(from: Option<u16>, to: Option<u16>) -> Self {
        Self {
            status: DayStatus::Available,
            from,
            to,
        }
    }

    fn unavailable() -> Self {
        Self {
            status: DayStatus::Unavailable,
            from: None,
            to: None,
        }
    }

    fn unknown() -> Self {
        Self {
            status: DayStatus::Unknown,
            from: None,
            to: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WeeklyAvailability {
    #[serde(default)]
    pub mon: DaySlot,
    #[serde(default)]
    pub tue: DaySlot,
    #[serde(default)]
    pub wed: DaySlot,
    #[serde(default)]
    pub thu: DaySlot,
    #[serde(default)]
    pub fri: DaySlot,
    #[serde(default)]
    pub sat: DaySlot,
    #[serde(default)]
    pub sun: DaySlot,
}

impl Default for WeeklyAvailability {
    fn default() -> Self {
        Self::unknown()
    }
}

impl WeeklyAvailability {
    fn unknown() -> Self {
        Self::from_slot(DaySlot::unknown())
    }

    fn from_slot(slot: DaySlot) -> Self {
        Self {
            mon: slot.clone(),
            tue: slot.clone(),
            wed: slot.clone(),
            thu: slot.clone(),
            fri: slot.clone(),
            sat: slot.clone(),
            sun: slot,
        }
    }

    fn day(&self, day: Weekday) -> &DaySlot {
        match day {
            Weekday::Mon => &self.mon,
            Weekday::Tue => &self.tue,
            Weekday::Wed => &self.wed,
            Weekday::Thu => &self.thu,
            Weekday::Fri => &self.fri,
            Weekday::Sat => &self.sat,
            Weekday::Sun => &self.sun,
        }
    }

    fn day_mut(&mut self, day: Weekday) -> &mut DaySlot {
        match day {
            Weekday::Mon => &mut self.mon,
            Weekday::Tue => &mut self.tue,
            Weekday::Wed => &mut self.wed,
            Weekday::Thu => &mut self.thu,
            Weekday::Fri => &mut self.fri,
            Weekday::Sat => &mut self.sat,
            Weekday::Sun => &mut self.sun,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DayOverlap {
    pub available: u32,
    pub unavailable: u32,
    pub unknown: u32,
    pub window_from: Option<u16>,
    pub window_to: Option<u16>,
    pub full_squad: bool,
    pub unavailable_ids: Vec<i32>,
    pub unknown_ids: Vec<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WeeklyOverlap {
    pub mon: DayOverlap,
    pub tue: DayOverlap,
    pub wed: DayOverlap,
    pub thu: DayOverlap,
    pub fri: DayOverlap,
    pub sat: DayOverlap,
    pub sun: DayOverlap,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScrimWindow {
    pub day: Weekday,
    pub from: u16,
    pub to: u16,
}

#[derive(Debug, Serialize)]
pub struct ScrimTeam {
    pub id: i32,
    pub name: String,
    pub coach: Option<String>,
    pub discord_role_id: Option<i64>,
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
    pub availability_slots: WeeklyAvailability,
    pub availability_confirmed: bool,
    pub discord_linked: bool,
    pub notes: Option<String>,
    pub status: String,
    pub source: String,
    pub team: Option<ScrimTeam>,
    pub role: Option<String>,
    pub is_captain: bool,
    pub is_bench: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiscordSyncStatus {
    pub ok: bool,
    pub detail: String,
}

#[derive(Debug, Serialize)]
pub struct ScrimParticipantPatchResponse {
    #[serde(flatten)]
    pub participant: ScrimPoolParticipant,
    pub discord_sync: DiscordSyncStatus,
}

#[derive(Debug, Serialize)]
pub struct ScrimDiscordResyncResponse {
    pub discord_sync: DiscordSyncStatus,
}

#[derive(Debug, Deserialize)]
pub struct ScrimSignupRequest {
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub availability_slots: Option<WeeklyAvailability>,
}

#[derive(Debug, Deserialize)]
pub struct ScrimPoolQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScrimCreateTeamRequest {
    pub name: String,
    pub coach: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScrimSuggestRosterRequest {
    pub window: Option<ScrimWindow>,
    pub size: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ScrimRosterSuggestResponse {
    pub team: ScrimTeam,
    pub requested_size: u32,
    pub fit_count: u32,
    pub best_window: Option<ScrimWindow>,
    pub candidates: Vec<ScrimRosterSuggestionCandidate>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScrimRosterSuggestionCandidate {
    pub participant_id: i32,
    pub display_name: String,
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub availability_slots: WeeklyAvailability,
    pub availability_confirmed: bool,
    pub status: String,
    pub source: String,
    pub fit_minutes: u32,
    pub fit_ratio: f64,
}

#[derive(Debug, Deserialize)]
pub struct ScrimParticipantPatch {
    pub status: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_i32")]
    pub team_id: Option<Option<i32>>,
    pub is_bench: Option<bool>,
    pub is_captain: Option<bool>,
    pub notes: Option<String>,
    pub rank: Option<String>,
    pub roles: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScrimTeamBoardResponse {
    pub team: ScrimTeam,
    pub members: Vec<ScrimTeamBoardMember>,
    pub overlap: WeeklyOverlap,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScrimTeamBoardMember {
    pub participant_id: i32,
    pub display_name: String,
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub is_captain: bool,
    pub is_bench: bool,
    pub discord_linked: bool,
    pub availability_confirmed: bool,
    pub availability: WeeklyAvailability,
    pub notes: Option<String>,
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
        "SELECT t.id, t.name, t.coach, t.discord_role_id, t.discord_channel_id \
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
    let (signup_availability_slots, signup_availability_text) =
        signup_availability_payload(body.availability_slots, body.availability)?;
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
             SET display_name=$2, rank=$3, roles=$4, availability=$5, \
                 availability_slots=COALESCE($6::jsonb, availability_slots), \
                 updated_at=now() \
             WHERE id=$1",
        )
        .bind(participant_id)
        .bind(&user.display_name)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(signup_availability_text.as_deref())
        .bind(signup_availability_slots.clone())
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
             SET discord_id=$2, rank=$3, roles=$4, availability=$5, \
                 availability_slots=COALESCE($6::jsonb, availability_slots), \
                 updated_at=now() \
             WHERE id=$1",
        )
        .bind(participant_id)
        .bind(discord_id)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(signup_availability_text.as_deref())
        .bind(signup_availability_slots.clone())
        .execute(&mut *tx)
        .await?;
        participant_id
    } else {
        sqlx::query_scalar(
            "INSERT INTO scrim.participants( \
                 id, discord_id, display_name, rank, rank_source, rank_verified, roles, availability, availability_slots, \
                 status, source, created_at, updated_at \
             ) \
             VALUES( \
                 (SELECT COALESCE(MAX(id), 0) + 1 FROM scrim.participants), \
                 $1, $2, $3, 'self', false, $4, $5, $6::jsonb, 'new', 'web_form', now(), now() \
             ) \
             RETURNING id",
        )
        .bind(discord_id)
        .bind(&user.display_name)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(signup_availability_text.as_deref())
        .bind(signup_availability_slots.clone())
        .fetch_one(&mut *tx)
        .await?
    };

    let row = sqlx::query(PARTICIPANT_SELECT_BY_ID)
        .bind(participant_id)
        .fetch_one(&mut *tx)
        .await?;
    let participant = participant_from_row(&row);
    let discord_sync_plan =
        fetch_discord_role_snapshot(&mut *tx, participant_id, scrim_reserve_role_id(&state))
            .await?
            .map(|snapshot| DiscordRoleSyncPlan::resync(&snapshot));
    tx.commit().await?;

    if let Some(plan) = discord_sync_plan {
        let discord_sync = execute_discord_sync(&state, plan).await;
        if !discord_sync.ok {
            tracing::warn!(
                participant_id,
                detail = %discord_sync.detail,
                "Scrim-Signup-Discord-Sync fail-open"
            );
        }
    }

    Ok(Json(participant))
}

pub async fn put_my_availability(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<WeeklyAvailability>,
) -> AppResult<Json<ScrimParticipant>> {
    let user = auth::require_authenticated_user(&state, &headers, Some(peer)).await?;
    let discord_id = parse_required_discord_id(&user)?;
    let body = canonicalize_weekly_availability(body)?;
    let mut tx = state.pool.begin().await?;

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
    let Some(participant_id) = participant_id else {
        return Err(AppError::not_found("Bitte zuerst zum Scrim-Pool anmelden."));
    };

    let availability_slots = serde_json::to_value(&body)?;
    let legacy_availability = render_legacy_availability(&body)?;
    sqlx::query(
        "UPDATE scrim.participants \
         SET availability_slots=$2::jsonb, availability=$3, updated_at=now() \
         WHERE id=$1",
    )
    .bind(participant_id)
    .bind(availability_slots)
    .bind(legacy_availability)
    .execute(&mut *tx)
    .await?;

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

pub async fn teams(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Vec<ScrimTeam>>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let rows = sqlx::query(
        "SELECT id, name, coach, discord_role_id, discord_channel_id \
         FROM scrim.teams \
         ORDER BY name ASC",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows.iter().map(team_from_row).collect()))
}

pub async fn create_team(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ScrimCreateTeamRequest>,
) -> AppResult<Json<ScrimTeam>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::bad_request("Team-Name darf nicht leer sein."));
    }
    let coach = body.coach.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    });
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(0x4451_0008_0004_0001i64)
        .execute(&mut *tx)
        .await?;

    let row = sqlx::query(
        "INSERT INTO scrim.teams(id, name, coach, created_at) \
         VALUES((SELECT COALESCE(MAX(id), 0) + 1 FROM scrim.teams), $1, $2, now()) \
         RETURNING id, name, coach, discord_role_id, discord_channel_id",
    )
    .bind(name)
    .bind(coach)
    .fetch_one(&mut *tx)
    .await?;
    let mut team = team_from_row(&row);
    tx.commit().await?;
    create_discord_team_role(&state, &mut team).await?;

    Ok(Json(team))
}

async fn create_discord_team_role(
    state: &AppState,
    team: &mut ScrimTeam,
) -> Result<(), sqlx::Error> {
    let request = DiscordCreateRoleBrokerRequest {
        guild_id: state.cfg.scrim_guild_id,
        name: team.name.clone(),
        mentionable: false,
        reason: Some(format!("Scrim-Team {}", team.name)),
        idempotency_key: Some(format!("scrim-team-{}-role-create", team.id)),
    };
    let role_id = match state.discord_role_broker.create_role(request).await {
        Ok(role_id) => role_id,
        Err(err) => {
            tracing::warn!(
                ?err,
                team_id = team.id,
                team_name = %team.name,
                "Scrim-Team-Rolle konnte nicht angelegt werden; Team bleibt ohne Discord-Rolle"
            );
            return Ok(());
        }
    };
    let Ok(role_id) = i64::try_from(role_id) else {
        tracing::warn!(
            role_id,
            team_id = team.id,
            "Scrim-Team-Rollen-ID passt nicht in BIGINT; Team bleibt ohne Discord-Rolle"
        );
        return Ok(());
    };

    sqlx::query("UPDATE scrim.teams SET discord_role_id=$2 WHERE id=$1")
        .bind(team.id)
        .bind(role_id)
        .execute(&state.pool)
        .await?;
    team.discord_role_id = Some(role_id);
    Ok(())
}

pub async fn team_board(
    State(state): State<AppState>,
    Path(team_id): Path<i32>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<ScrimTeamBoardResponse>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let team_row = sqlx::query(
        "SELECT id, name, coach, discord_role_id, discord_channel_id \
         FROM scrim.teams \
         WHERE id=$1",
    )
    .bind(team_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some(team_row) = team_row else {
        return Err(AppError::not_found("Team nicht gefunden."));
    };
    let team = team_from_row(&team_row);

    let member_rows = sqlx::query(TEAM_BOARD_MEMBERS_SELECT)
        .bind(team.id)
        .fetch_all(&state.pool)
        .await?;
    let members = member_rows
        .iter()
        .map(team_board_member_from_row)
        .collect::<Vec<_>>();
    let overlap_members = members
        .iter()
        .map(|member| OverlapMember {
            participant_id: member.participant_id,
            is_bench: member.is_bench,
            availability: member.availability.clone(),
        })
        .collect::<Vec<_>>();
    let overlap = overlap(&overlap_members);

    Ok(Json(ScrimTeamBoardResponse {
        team,
        members,
        overlap,
    }))
}

pub async fn suggest_roster(
    State(state): State<AppState>,
    Path(team_id): Path<i32>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ScrimSuggestRosterRequest>,
) -> AppResult<Json<ScrimRosterSuggestResponse>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let team_row = sqlx::query(
        "SELECT id, name, coach, discord_role_id, discord_channel_id \
         FROM scrim.teams \
         WHERE id=$1",
    )
    .bind(team_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some(team_row) = team_row else {
        return Err(AppError::not_found("Team nicht gefunden."));
    };
    let team = team_from_row(&team_row);
    let window = body.window.map(canonicalize_scrim_window).transpose()?;
    let requested_size = body.size.unwrap_or(6);

    let rows = sqlx::query(FREE_POOL_SELECT).fetch_all(&state.pool).await?;
    let pool = rows
        .iter()
        .map(roster_pool_candidate_from_row)
        .collect::<Vec<_>>();
    let suggestion = build_roster_suggestion(&pool, window, requested_size as usize);

    Ok(Json(ScrimRosterSuggestResponse {
        team,
        requested_size,
        fit_count: suggestion.fit_count,
        best_window: suggestion.best_window,
        candidates: suggestion.candidates,
    }))
}

pub async fn patch_participant(
    State(state): State<AppState>,
    Path(participant_id): Path<i32>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(body): Json<ScrimParticipantPatch>,
) -> AppResult<Json<ScrimParticipantPatchResponse>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(0x4451_0008_0004_0001i64)
        .execute(&mut *tx)
        .await?;

    let reserve_role_id = scrim_reserve_role_id(&state);
    let Some(before_discord_roles) =
        fetch_discord_role_snapshot(&mut *tx, participant_id, reserve_role_id).await?
    else {
        return Err(AppError::not_found("Teilnehmer nicht gefunden."));
    };

    if body.rank.is_some() || body.roles.is_some() || body.notes.is_some() {
        sqlx::query(
            "UPDATE scrim.participants \
             SET rank=COALESCE($2, rank), \
                 roles=COALESCE($3, roles), \
                 notes=COALESCE($4, notes), \
                 updated_at=now() \
             WHERE id=$1",
        )
        .bind(participant_id)
        .bind(body.rank.as_deref())
        .bind(body.roles.as_deref())
        .bind(body.notes.as_deref())
        .execute(&mut *tx)
        .await?;
    }

    if let Some(status) = body.status.as_deref() {
        sqlx::query("UPDATE scrim.participants SET status=$2, updated_at=now() WHERE id=$1")
            .bind(participant_id)
            .bind(status)
            .execute(&mut *tx)
            .await?;
    }

    match body.team_id {
        Some(Some(team_id)) => {
            let team_exists: Option<i32> =
                sqlx::query_scalar("SELECT 1 FROM scrim.teams WHERE id=$1")
                    .bind(team_id)
                    .fetch_optional(&mut *tx)
                    .await?;
            if team_exists.is_none() {
                return Err(AppError::not_found("Team nicht gefunden."));
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
        }
        Some(None) => {
            sqlx::query("DELETE FROM scrim.team_members WHERE participant_id=$1")
                .bind(participant_id)
                .execute(&mut *tx)
                .await?;
        }
        None if body.is_bench.is_some() || body.is_captain.is_some() => {
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
        None => {}
    }

    let row = sqlx::query(POOL_SELECT_BY_ID)
        .bind(participant_id)
        .fetch_one(&mut *tx)
        .await?;
    let participant = pool_participant_from_row(&row);
    let after_discord_roles =
        fetch_discord_role_snapshot(&mut *tx, participant_id, reserve_role_id)
            .await?
            .ok_or_else(|| AppError::not_found("Teilnehmer nicht gefunden."))?;
    let sync_plan = DiscordRoleSyncPlan::diff(&before_discord_roles, &after_discord_roles);
    tx.commit().await?;

    let discord_sync = execute_discord_sync(&state, sync_plan).await;

    Ok(Json(ScrimParticipantPatchResponse {
        participant,
        discord_sync,
    }))
}

pub async fn resync_participant_discord(
    State(state): State<AppState>,
    Path(participant_id): Path<i32>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> AppResult<Json<ScrimDiscordResyncResponse>> {
    require_scrim_coach(&state, &headers, Some(peer)).await?;

    let Some(snapshot) =
        fetch_discord_role_snapshot(&state.pool, participant_id, scrim_reserve_role_id(&state))
            .await?
    else {
        return Err(AppError::not_found("Teilnehmer nicht gefunden."));
    };
    let discord_sync = execute_discord_sync(&state, DiscordRoleSyncPlan::resync(&snapshot)).await;
    Ok(Json(ScrimDiscordResyncResponse { discord_sync }))
}

const DISCORD_SYNC_NOOP: &str = "Keine Discord-Änderung nötig.";
const DISCORD_SYNC_NO_ACCOUNT: &str = "Kein Discord-Account verknüpft — Rolle nicht gesetzt.";
const DISCORD_SYNC_NOT_CONFIGURED: &str = "Discord-Sync ist nicht konfiguriert.";
const DISCORD_SYNC_SUCCESS: &str = "Discord-Rollen aktualisiert.";
const DISCORD_SYNC_FAILED: &str = "Discord-Sync fehlgeschlagen.";

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiscordRoleSnapshot {
    participant_id: i32,
    discord_user_id: Option<u64>,
    role_ids: BTreeSet<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiscordRoleAction {
    operation: DiscordRoleOperation,
    role_id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DiscordRoleSyncPlan {
    participant_id: i32,
    discord_user_id: Option<u64>,
    actions: Vec<DiscordRoleAction>,
}

impl DiscordRoleSyncPlan {
    fn diff(before: &DiscordRoleSnapshot, after: &DiscordRoleSnapshot) -> Self {
        let remove_actions =
            before
                .role_ids
                .difference(&after.role_ids)
                .map(|role_id| DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: *role_id,
                });
        let add_actions =
            after
                .role_ids
                .difference(&before.role_ids)
                .map(|role_id| DiscordRoleAction {
                    operation: DiscordRoleOperation::Add,
                    role_id: *role_id,
                });
        Self {
            participant_id: after.participant_id,
            discord_user_id: after.discord_user_id.or(before.discord_user_id),
            actions: remove_actions.chain(add_actions).collect(),
        }
    }

    fn resync(snapshot: &DiscordRoleSnapshot) -> Self {
        Self {
            participant_id: snapshot.participant_id,
            discord_user_id: snapshot.discord_user_id,
            actions: snapshot
                .role_ids
                .iter()
                .map(|role_id| DiscordRoleAction {
                    operation: DiscordRoleOperation::Add,
                    role_id: *role_id,
                })
                .collect(),
        }
    }
}

async fn execute_discord_sync(state: &AppState, plan: DiscordRoleSyncPlan) -> DiscordSyncStatus {
    execute_discord_sync_with_broker(
        state.cfg.scrim_guild_id,
        state.discord_role_broker.as_ref(),
        plan,
    )
    .await
}

async fn execute_discord_sync_with_broker(
    guild_id: u64,
    broker: &dyn DiscordRoleBroker,
    plan: DiscordRoleSyncPlan,
) -> DiscordSyncStatus {
    if plan.actions.is_empty() {
        return DiscordSyncStatus {
            ok: true,
            detail: DISCORD_SYNC_NOOP.to_string(),
        };
    }

    let Some(discord_user_id) = plan.discord_user_id else {
        return DiscordSyncStatus {
            ok: true,
            detail: DISCORD_SYNC_NO_ACCOUNT.to_string(),
        };
    };

    if !broker.is_configured() {
        return DiscordSyncStatus {
            ok: false,
            detail: DISCORD_SYNC_NOT_CONFIGURED.to_string(),
        };
    }

    let mut ok = true;
    for action in plan.actions {
        let request = DiscordRoleBrokerRequest {
            guild_id,
            user_id: discord_user_id,
            role_id: action.role_id,
            reason: Some(format!(
                "scrim participant {} {} role {}",
                plan.participant_id,
                action.operation.idempotency_suffix(),
                action.role_id
            )),
            idempotency_key: Some(format!(
                "scrim-{}-{}-{}",
                plan.participant_id,
                action.role_id,
                action.operation.idempotency_suffix()
            )),
        };
        if broker.apply_role(action.operation, request).await.is_err() {
            ok = false;
        }
    }

    DiscordSyncStatus {
        ok,
        detail: if ok {
            DISCORD_SYNC_SUCCESS
        } else {
            DISCORD_SYNC_FAILED
        }
        .to_string(),
    }
}

async fn fetch_discord_role_snapshot<'e, E>(
    executor: E,
    participant_id: i32,
    reserve_role_id: Option<u64>,
) -> Result<Option<DiscordRoleSnapshot>, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let rows = sqlx::query(
        "SELECT p.discord_id, p.status, tm.team_id, t.discord_role_id \
         FROM scrim.participants p \
         LEFT JOIN scrim.team_members tm ON tm.participant_id=p.id \
         LEFT JOIN scrim.teams t ON t.id=tm.team_id \
         WHERE p.id=$1 \
         ORDER BY t.discord_role_id ASC NULLS LAST",
    )
    .bind(participant_id)
    .fetch_all(executor)
    .await?;
    Ok(discord_role_snapshot_from_rows(
        participant_id,
        reserve_role_id,
        &rows,
    ))
}

fn discord_role_snapshot_from_rows(
    participant_id: i32,
    reserve_role_id: Option<u64>,
    rows: &[PgRow],
) -> Option<DiscordRoleSnapshot> {
    let first = rows.first()?;
    let discord_user_id = positive_i64_as_u64(first.get("discord_id"));
    let status: String = first.get("status");
    let mut role_ids = BTreeSet::new();
    if !status.trim().eq_ignore_ascii_case("inactive") {
        let has_team = rows
            .iter()
            .any(|row| row.get::<Option<i32>, _>("team_id").is_some());
        if !has_team {
            if let Some(role_id) = reserve_role_id {
                role_ids.insert(role_id);
            }
        }
        for row in rows {
            if let Some(role_id) = positive_i64_as_u64(row.get("discord_role_id")) {
                role_ids.insert(role_id);
            }
        }
    }
    Some(DiscordRoleSnapshot {
        participant_id,
        discord_user_id,
        role_ids,
    })
}

fn scrim_reserve_role_id(state: &AppState) -> Option<u64> {
    let role_id = positive_i64_as_u64(state.cfg.scrim_reserve_role_id);
    if role_id.is_none() {
        tracing::warn!(
            "SCRIM_RESERVE_ROLE_ID nicht gesetzt; Scrim-Reserve-Rollen-Sync deaktiviert"
        );
    }
    role_id
}

fn positive_i64_as_u64(value: Option<i64>) -> Option<u64> {
    value.and_then(|value| (value > 0).then_some(value as u64))
}

fn deserialize_nullable_i32<'de, D>(deserializer: D) -> Result<Option<Option<i32>>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<i32>::deserialize(deserializer).map(Some)
}

const PARTICIPANT_SELECT_BY_ID: &str = "\
    SELECT id, display_name, rank, roles, availability, availability_slots, status, source \
    FROM scrim.participants \
    WHERE id=$1";

const PARTICIPANT_SELECT_BY_DISCORD: &str = "\
    SELECT id, display_name, rank, roles, availability, availability_slots, status, source \
    FROM scrim.participants \
    WHERE discord_id=$1 \
    ORDER BY id ASC \
    LIMIT 1";

const POOL_SELECT: &str = "\
    SELECT p.id, p.display_name, p.rank, p.roles, p.availability, p.availability_slots, \
           (p.discord_id IS NOT NULL) AS discord_linked, p.notes, p.status, p.source, \
           t.id AS team_id, t.name AS team_name, t.coach AS team_coach, \
           t.discord_role_id AS team_discord_role_id, \
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
    SELECT p.id, p.display_name, p.rank, p.roles, p.availability, p.availability_slots, \
           (p.discord_id IS NOT NULL) AS discord_linked, p.notes, p.status, p.source, \
           t.id AS team_id, t.name AS team_name, t.coach AS team_coach, \
           t.discord_role_id AS team_discord_role_id, \
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

const FREE_POOL_SELECT: &str = "\
    SELECT p.id, p.display_name, p.rank, p.roles, p.availability, p.availability_slots, \
           p.status, p.source \
    FROM scrim.participants p \
    WHERE p.status <> 'inactive' \
      AND NOT EXISTS (SELECT 1 FROM scrim.team_members tm WHERE tm.participant_id=p.id) \
    ORDER BY p.created_at ASC, p.id ASC";

const TEAM_BOARD_MEMBERS_SELECT: &str = "\
    SELECT tm.participant_id, p.display_name, p.rank, p.roles, \
           tm.is_captain, tm.is_bench, \
           (p.discord_id IS NOT NULL) AS discord_linked, \
           p.availability, p.availability_slots, p.notes \
    FROM scrim.team_members tm \
    JOIN scrim.participants p ON p.id = tm.participant_id \
    WHERE tm.team_id=$1 \
    ORDER BY tm.is_bench ASC, tm.is_captain DESC, p.display_name ASC, tm.participant_id ASC";

async fn require_scrim_coach(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
) -> AppResult<User> {
    let user = auth::require_authenticated_user(state, headers, peer).await?;
    if is_coach(state, &user).await? {
        return Ok(user);
    }
    Err(AppError::http(
        StatusCode::FORBIDDEN,
        "Kein Zugriff – dieser Bereich ist nur für Coaches.",
    ))
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
    parse_discord_id(&user.id)
        .map_err(|_| AppError::bad_request("Ungültige Discord-ID in der Sitzung."))
}

fn parse_discord_id(value: &str) -> Result<i64, ()> {
    let value = value.trim();
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(());
    }
    let parsed = value.parse::<i64>().map_err(|_| ())?;
    (parsed > 0).then_some(parsed).ok_or(())
}

fn participant_from_row(row: &PgRow) -> ScrimParticipant {
    let availability: Option<String> = row.get("availability");
    let availability_slots_value: Option<Value> = row.get("availability_slots");
    let availability_confirmed = availability_slots_value.is_some();
    let availability_slots = effective(availability_slots_value, availability.as_deref());
    ScrimParticipant {
        id: row.get("id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        availability,
        availability_slots,
        availability_confirmed,
        status: row.get("status"),
        source: row.get("source"),
    }
}

fn team_from_row(row: &PgRow) -> ScrimTeam {
    ScrimTeam {
        id: row.get("id"),
        name: row.get("name"),
        coach: row.get("coach"),
        discord_role_id: row.get("discord_role_id"),
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
    let availability: Option<String> = row.get("availability");
    let availability_slots_value: Option<Value> = row.get("availability_slots");
    let availability_confirmed = availability_slots_value.is_some();
    let availability_slots = effective(availability_slots_value, availability.as_deref());
    ScrimPoolParticipant {
        id: row.get("id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        availability,
        availability_slots,
        availability_confirmed,
        discord_linked: row.get("discord_linked"),
        notes: row.get("notes"),
        status: row.get("status"),
        source: row.get("source"),
        team: team_id.map(|id| ScrimTeam {
            id,
            name: row.get("team_name"),
            coach: row.get("team_coach"),
            discord_role_id: row.get("team_discord_role_id"),
            discord_channel_id: row.get("team_discord_channel_id"),
        }),
        role: row.get("team_member_role"),
        is_captain: row.get("is_captain"),
        is_bench: row.get("is_bench"),
    }
}

fn team_board_member_from_row(row: &PgRow) -> ScrimTeamBoardMember {
    let availability_text: Option<String> = row.get("availability");
    let availability_slots_value: Option<Value> = row.get("availability_slots");
    let availability_confirmed = availability_slots_value.is_some();
    let availability = effective(availability_slots_value, availability_text.as_deref());
    ScrimTeamBoardMember {
        participant_id: row.get("participant_id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        is_captain: row.get("is_captain"),
        is_bench: row.get("is_bench"),
        discord_linked: row.get("discord_linked"),
        availability_confirmed,
        availability,
        notes: row.get("notes"),
    }
}

#[derive(Debug, Clone)]
struct RosterPoolCandidate {
    participant_id: i32,
    display_name: String,
    rank: Option<String>,
    roles: Option<String>,
    availability: Option<String>,
    availability_slots: WeeklyAvailability,
    availability_confirmed: bool,
    status: String,
    source: String,
}

#[derive(Debug)]
struct RosterSuggestion {
    fit_count: u32,
    best_window: Option<ScrimWindow>,
    candidates: Vec<ScrimRosterSuggestionCandidate>,
}

fn roster_pool_candidate_from_row(row: &PgRow) -> RosterPoolCandidate {
    let availability: Option<String> = row.get("availability");
    let availability_slots_value: Option<Value> = row.get("availability_slots");
    let availability_confirmed = availability_slots_value.is_some();
    let availability_slots = effective(availability_slots_value, availability.as_deref());
    RosterPoolCandidate {
        participant_id: row.get("id"),
        display_name: row.get("display_name"),
        rank: row.get("rank"),
        roles: row.get("roles"),
        availability,
        availability_slots,
        availability_confirmed,
        status: row.get("status"),
        source: row.get("source"),
    }
}

fn build_roster_suggestion(
    pool: &[RosterPoolCandidate],
    requested_window: Option<ScrimWindow>,
    size: usize,
) -> RosterSuggestion {
    let window = requested_window.or_else(|| best_pool_window(pool));
    let mut candidates = pool
        .iter()
        .map(|candidate| roster_suggestion_candidate(candidate, window))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        right
            .fit_minutes
            .cmp(&left.fit_minutes)
            .then_with(|| {
                right
                    .availability_confirmed
                    .cmp(&left.availability_confirmed)
            })
            .then_with(|| left.display_name.cmp(&right.display_name))
            .then_with(|| left.participant_id.cmp(&right.participant_id))
    });
    candidates.truncate(size);
    let fit_count = candidates
        .iter()
        .filter(|candidate| candidate.fit_minutes > 0)
        .count() as u32;
    let best_window = window.and_then(|window| common_suggestion_window(window, &candidates));

    RosterSuggestion {
        fit_count,
        best_window,
        candidates,
    }
}

fn roster_suggestion_candidate(
    candidate: &RosterPoolCandidate,
    window: Option<ScrimWindow>,
) -> ScrimRosterSuggestionCandidate {
    let fit_minutes = window
        .map(|window| fit_minutes_for_window(&candidate.availability_slots, window))
        .unwrap_or(0);
    let fit_ratio = window
        .map(window_minutes)
        .filter(|minutes| *minutes > 0)
        .map(|minutes| f64::from(fit_minutes) / f64::from(minutes))
        .unwrap_or(0.0);
    ScrimRosterSuggestionCandidate {
        participant_id: candidate.participant_id,
        display_name: candidate.display_name.clone(),
        rank: candidate.rank.clone(),
        roles: candidate.roles.clone(),
        availability: candidate.availability.clone(),
        availability_slots: candidate.availability_slots.clone(),
        availability_confirmed: candidate.availability_confirmed,
        status: candidate.status.clone(),
        source: candidate.source.clone(),
        fit_minutes,
        fit_ratio,
    }
}

fn best_pool_window(pool: &[RosterPoolCandidate]) -> Option<ScrimWindow> {
    let mut best = None;
    let mut best_count = 0_u32;
    let mut best_total = 0_u32;

    for candidate in pool {
        for day in Weekday::ALL {
            let Some(window) = window_from_slot(day, candidate.availability_slots.day(day)) else {
                continue;
            };
            let mut count = 0_u32;
            let mut total = 0_u32;
            for other in pool {
                let fit = fit_minutes_for_window(&other.availability_slots, window);
                if fit > 0 {
                    count += 1;
                    total += fit;
                }
            }
            if count > best_count || (count == best_count && total > best_total) {
                best = Some(window);
                best_count = count;
                best_total = total;
            }
        }
    }

    best
}

fn common_suggestion_window(
    window: ScrimWindow,
    candidates: &[ScrimRosterSuggestionCandidate],
) -> Option<ScrimWindow> {
    let mut members = candidates
        .iter()
        .filter(|candidate| candidate.fit_minutes > 0)
        .map(|candidate| OverlapMember {
            participant_id: candidate.participant_id,
            is_bench: false,
            availability: candidate.availability_slots.clone(),
        })
        .collect::<Vec<_>>();
    if members.is_empty() {
        return None;
    }
    members.push(window_overlap_member(window));
    let overlap = overlap_day(&members, window.day);
    match (overlap.window_from, overlap.window_to) {
        (Some(from), Some(to)) => Some(ScrimWindow {
            day: window.day,
            from,
            to,
        }),
        _ => None,
    }
}

fn fit_minutes_for_window(availability: &WeeklyAvailability, window: ScrimWindow) -> u32 {
    if availability.day(window.day).status != DayStatus::Available {
        return 0;
    }
    let overlap = overlap_day(
        &[
            OverlapMember {
                participant_id: 0,
                is_bench: false,
                availability: availability.clone(),
            },
            window_overlap_member(window),
        ],
        window.day,
    );
    match (overlap.window_from, overlap.window_to) {
        (Some(from), Some(to)) => u32::from(to.saturating_sub(from)),
        _ => 0,
    }
}

fn window_overlap_member(window: ScrimWindow) -> OverlapMember {
    let mut availability = WeeklyAvailability::unknown();
    *availability.day_mut(window.day) = DaySlot::available(Some(window.from), Some(window.to));
    OverlapMember {
        participant_id: i32::MIN,
        is_bench: false,
        availability,
    }
}

fn window_from_slot(day: Weekday, slot: &DaySlot) -> Option<ScrimWindow> {
    if slot.status != DayStatus::Available {
        return None;
    }
    let window = ScrimWindow {
        day,
        from: slot.from.unwrap_or(0),
        to: slot.to.unwrap_or(1440),
    };
    valid_scrim_window(window).then_some(window)
}

fn window_minutes(window: ScrimWindow) -> u32 {
    u32::from(window.to - window.from)
}

fn signup_availability_payload(
    slots: Option<WeeklyAvailability>,
    legacy: Option<String>,
) -> AppResult<(Option<Value>, Option<String>)> {
    let Some(slots) = slots else {
        return Ok((None, legacy));
    };
    let slots = canonicalize_weekly_availability(slots)?;
    let legacy = render_legacy_availability(&slots)?;
    Ok((Some(serde_json::to_value(slots)?), Some(legacy)))
}

fn canonicalize_scrim_window(window: ScrimWindow) -> AppResult<ScrimWindow> {
    if valid_scrim_window(window) {
        Ok(window)
    } else {
        Err(AppError::bad_request("Ungültiges Zeitfenster."))
    }
}

fn valid_scrim_window(window: ScrimWindow) -> bool {
    window.from < window.to && window.to <= 1440
}

fn parse_legacy(text: &str) -> WeeklyAvailability {
    let text = text.trim();
    if text.is_empty() {
        return WeeklyAvailability::unknown();
    }

    if let Ok(Value::Object(values)) = serde_json::from_str::<Value>(text) {
        let mut weekly = WeeklyAvailability::unknown();
        for (key, day) in GERMAN_DAYS {
            if let Some(value) = values.get(key) {
                *weekly.day_mut(day) = parse_legacy_day(&legacy_value_to_string(value));
            }
        }
        return weekly;
    }

    WeeklyAvailability::from_slot(parse_legacy_day(text))
}

fn effective(slots: Option<Value>, legacy: Option<&str>) -> WeeklyAvailability {
    if let Some(slots) = slots {
        return serde_json::from_value(slots).unwrap_or_else(|_| WeeklyAvailability::unknown());
    }
    legacy
        .map(parse_legacy)
        .unwrap_or_else(WeeklyAvailability::unknown)
}

fn overlap(members: &[OverlapMember]) -> WeeklyOverlap {
    WeeklyOverlap {
        mon: overlap_day(members, Weekday::Mon),
        tue: overlap_day(members, Weekday::Tue),
        wed: overlap_day(members, Weekday::Wed),
        thu: overlap_day(members, Weekday::Thu),
        fri: overlap_day(members, Weekday::Fri),
        sat: overlap_day(members, Weekday::Sat),
        sun: overlap_day(members, Weekday::Sun),
    }
}

fn overlap_day(members: &[OverlapMember], day: Weekday) -> DayOverlap {
    let mut available = 0_u32;
    let mut unavailable = 0_u32;
    let mut unknown = 0_u32;
    let mut unavailable_ids = Vec::new();
    let mut unknown_ids = Vec::new();
    let mut window_from = 0_u16;
    let mut window_to = 1440_u16;
    let mut counted_members = 0_u32;

    for member in members.iter().filter(|member| !member.is_bench) {
        counted_members += 1;
        let slot = member.availability.day(day);
        match slot.status {
            DayStatus::Available => {
                available += 1;
                window_from = window_from.max(slot.from.unwrap_or(0));
                window_to = window_to.min(slot.to.unwrap_or(1440));
            }
            DayStatus::Unavailable => {
                unavailable += 1;
                unavailable_ids.push(member.participant_id);
            }
            DayStatus::Unknown => {
                unknown += 1;
                unknown_ids.push(member.participant_id);
            }
        }
    }

    let has_window = available >= 1 && window_from < window_to;
    DayOverlap {
        available,
        unavailable,
        unknown,
        window_from: has_window.then_some(window_from),
        window_to: has_window.then_some(window_to),
        full_squad: available == counted_members && has_window,
        unavailable_ids,
        unknown_ids,
    }
}

fn canonicalize_weekly_availability(
    mut weekly: WeeklyAvailability,
) -> AppResult<WeeklyAvailability> {
    for day in Weekday::ALL {
        canonicalize_day_slot(weekly.day_mut(day))?;
    }
    Ok(weekly)
}

fn canonicalize_day_slot(slot: &mut DaySlot) -> AppResult<()> {
    if slot.status != DayStatus::Available {
        slot.from = None;
        slot.to = None;
        return Ok(());
    }

    if slot.from.is_some_and(|from| from > 1440) || slot.to.is_some_and(|to| to > 1440) {
        return Err(AppError::bad_request("Ungültige Verfügbarkeitsangabe."));
    }
    if let (Some(from), Some(to)) = (slot.from, slot.to) {
        if from >= to {
            return Err(AppError::bad_request("Ungültige Verfügbarkeitsangabe."));
        }
    }
    Ok(())
}

fn parse_legacy_day(raw: &str) -> DaySlot {
    let value = raw.trim();
    let lower = value.to_ascii_lowercase();
    let lower = lower.trim();
    if lower.is_empty() || lower == "?" {
        return DaySlot::unknown();
    }
    if lower.contains("geht nicht") || lower.contains("nein") || lower.contains("keine zeit") {
        return DaySlot::unavailable();
    }
    if matches!(
        lower,
        "flexibel" | "immer" | "immer zeit" | "jederzeit" | "optimal"
    ) {
        return DaySlot::available(None, None);
    }
    if let Some((from, to)) = parse_hour_range(lower) {
        return DaySlot::available(Some(from), Some(to));
    }
    if let Some(from) = parse_time(lower) {
        return DaySlot::available(Some(from), None);
    }
    if let Some(rest) = lower.strip_prefix("ab ") {
        if let Some(from) = parse_time_or_hour(rest.trim()) {
            return DaySlot::available(Some(from), None);
        }
    }
    if let Some(from) = parse_hour(lower) {
        return DaySlot::available(Some(from), None);
    }
    if lower.contains("abend") {
        return DaySlot::available(Some(18 * 60), None);
    }
    if lower.contains("nachmittag") {
        return DaySlot::available(Some(14 * 60), None);
    }
    if lower.contains("mittag") {
        return DaySlot::available(Some(12 * 60), None);
    }
    DaySlot::available(None, None)
}

fn parse_hour_range(value: &str) -> Option<(u16, u16)> {
    let (from, to) = value.split_once('-')?;
    let from = parse_time_or_hour(from.trim())?;
    let to = parse_time_or_hour(to.trim())?;
    (from < to && from <= 1440 && to <= 1440).then_some((from, to))
}

fn parse_time_or_hour(value: &str) -> Option<u16> {
    parse_time(value).or_else(|| parse_hour(value))
}

fn parse_time(value: &str) -> Option<u16> {
    let (hour, minute) = value.split_once(':')?;
    let hour = hour.trim().parse::<u16>().ok()?;
    let minute = minute.trim().parse::<u16>().ok()?;
    if hour > 24 || minute > 59 || (hour == 24 && minute != 0) {
        return None;
    }
    Some(hour * 60 + minute)
}

fn parse_hour(value: &str) -> Option<u16> {
    let hour = value.parse::<u16>().ok()?;
    (hour <= 24).then_some(hour * 60)
}

fn legacy_value_to_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        value => value.to_string(),
    }
}

fn render_legacy_availability(weekly: &WeeklyAvailability) -> Result<String, serde_json::Error> {
    serde_json::to_string(&LegacyAvailabilityText {
        mo: render_legacy_day(&weekly.mon),
        di: render_legacy_day(&weekly.tue),
        mi: render_legacy_day(&weekly.wed),
        r#do: render_legacy_day(&weekly.thu),
        fr: render_legacy_day(&weekly.fri),
        sa: render_legacy_day(&weekly.sat),
        so: render_legacy_day(&weekly.sun),
    })
}

fn render_legacy_day(slot: &DaySlot) -> String {
    match slot.status {
        DayStatus::Unavailable => "Geht nicht".to_string(),
        DayStatus::Unknown => String::new(),
        DayStatus::Available => match (slot.from, slot.to) {
            (None, None) => "Flexibel".to_string(),
            (Some(from), Some(to)) => format!("{}-{}", format_minutes(from), format_minutes(to)),
            (Some(from), None) => format!("ab {}", format_minutes(from)),
            (None, Some(to)) => format!("00:00-{}", format_minutes(to)),
        },
    }
}

fn format_minutes(minutes: u16) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

#[derive(Debug, Clone)]
struct OverlapMember {
    participant_id: i32,
    is_bench: bool,
    availability: WeeklyAvailability,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl Weekday {
    const ALL: [Self; 7] = [
        Self::Mon,
        Self::Tue,
        Self::Wed,
        Self::Thu,
        Self::Fri,
        Self::Sat,
        Self::Sun,
    ];
}

const GERMAN_DAYS: [(&str, Weekday); 7] = [
    ("Mo", Weekday::Mon),
    ("Di", Weekday::Tue),
    ("Mi", Weekday::Wed),
    ("Do", Weekday::Thu),
    ("Fr", Weekday::Fri),
    ("Sa", Weekday::Sat),
    ("So", Weekday::Sun),
];

#[derive(Serialize)]
struct LegacyAvailabilityText {
    #[serde(rename = "Mo")]
    mo: String,
    #[serde(rename = "Di")]
    di: String,
    #[serde(rename = "Mi")]
    mi: String,
    #[serde(rename = "Do")]
    r#do: String,
    #[serde(rename = "Fr")]
    fr: String,
    #[serde(rename = "Sa")]
    sa: String,
    #[serde(rename = "So")]
    so: String,
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeSet,
        net::{IpAddr, Ipv4Addr, SocketAddr},
        sync::{Arc, Mutex},
    };

    use axum::{
        body::{to_bytes, Body},
        extract::connect_info::ConnectInfo,
        http::{Method, Request, StatusCode},
    };
    use serde_json::{json, Value};
    use serial_test::serial;
    use sqlx::postgres::PgPoolOptions;
    use sqlx::Row;
    use tower::ServiceExt;

    use super::*;
    use crate::discord_broker::{DiscordRoleBrokerError, DiscordRoleBrokerFuture};
    use crate::{app::router, config::Config};

    #[test]
    fn parse_legacy_covers_real_excel_values() {
        let cases = vec![
            ("Flexibel", DaySlot::available(None, None)),
            ("19-20", DaySlot::available(Some(1140), Some(1200))),
            ("15-24", DaySlot::available(Some(900), Some(1440))),
            ("16-22", DaySlot::available(Some(960), Some(1320))),
            ("10-17", DaySlot::available(Some(600), Some(1020))),
            ("Ab 8", DaySlot::available(Some(480), None)),
            ("Ab 14", DaySlot::available(Some(840), None)),
            ("22:40", DaySlot::available(Some(1360), None)),
            ("20:30", DaySlot::available(Some(1230), None)),
            ("19", DaySlot::available(Some(1140), None)),
            ("Geht nicht", DaySlot::unavailable()),
            ("", DaySlot::unknown()),
            ("?", DaySlot::unknown()),
            ("so abends", DaySlot::available(Some(1080), None)),
            ("Immer Zeit", DaySlot::available(None, None)),
            ("optimal", DaySlot::available(None, None)),
        ];

        for (raw, expected) in cases {
            let legacy = format!(
                r#"{{"Mo":{}}}"#,
                serde_json::to_string(raw).expect("legacy value")
            );
            assert_eq!(parse_legacy(&legacy).mon, expected, "{raw}");
        }
    }

    #[test]
    fn render_legacy_day_round_trips_through_parser() {
        let cases = vec![
            (
                DaySlot::available(None, None),
                "Flexibel",
                DaySlot::available(None, None),
            ),
            (
                DaySlot::available(Some(1140), Some(1200)),
                "19:00-20:00",
                DaySlot::available(Some(1140), Some(1200)),
            ),
            (
                DaySlot::available(Some(840), None),
                "ab 14:00",
                DaySlot::available(Some(840), None),
            ),
            (
                DaySlot::available(None, Some(1020)),
                "00:00-17:00",
                DaySlot::available(Some(0), Some(1020)),
            ),
            (DaySlot::unavailable(), "Geht nicht", DaySlot::unavailable()),
            (DaySlot::unknown(), "", DaySlot::unknown()),
        ];

        for (slot, rendered, parsed) in cases {
            let legacy = render_legacy_day(&slot);
            assert_eq!(legacy, rendered);
            assert_eq!(parse_legacy_day(&legacy), parsed, "{rendered}");
        }
    }

    #[test]
    fn parse_legacy_day_accepts_rendered_ranges_and_rejects_invalid_boundaries() {
        assert_eq!(
            parse_legacy_day("19:00-22:00"),
            DaySlot::available(Some(1140), Some(1320))
        );
        assert_eq!(parse_hour_range("19:00-22:00"), Some((1140, 1320)));
        assert_eq!(parse_hour_range("23:00-25:00"), None);
        assert_eq!(parse_hour_range("25:00-26:00"), None);
        assert_eq!(parse_hour_range("24:00-24:00"), None);
        assert_eq!(
            parse_legacy_day("23:00-25:00"),
            DaySlot::available(None, None)
        );
    }

    #[test]
    fn parse_discord_id_rejects_signed_zero_and_non_digit_values() {
        assert_eq!(parse_discord_id("123"), Ok(123));
        assert_eq!(parse_discord_id(" 123 "), Ok(123));
        assert!(parse_discord_id("+123").is_err());
        assert!(parse_discord_id("-1").is_err());
        assert!(parse_discord_id("0").is_err());
        assert!(parse_discord_id("12a").is_err());
        assert!(parse_discord_id("").is_err());
    }

    #[test]
    fn participant_patch_distinguishes_missing_team_id_from_null() {
        let missing: ScrimParticipantPatch =
            serde_json::from_value(json!({})).expect("missing team_id");
        assert_eq!(missing.team_id, None);

        let removed: ScrimParticipantPatch =
            serde_json::from_value(json!({ "team_id": null })).expect("null team_id");
        assert_eq!(removed.team_id, Some(None));

        let assigned: ScrimParticipantPatch =
            serde_json::from_value(json!({ "team_id": 4 })).expect("numeric team_id");
        assert_eq!(assigned.team_id, Some(Some(4)));
    }

    #[test]
    fn canonicalize_weekly_availability_strips_non_available_times_and_rejects_invalid_windows() {
        let mut weekly = WeeklyAvailability::unknown();
        weekly.mon = DaySlot {
            status: DayStatus::Unavailable,
            from: Some(1500),
            to: Some(1600),
        };
        weekly.tue = DaySlot {
            status: DayStatus::Unknown,
            from: Some(10),
            to: Some(20),
        };
        weekly.wed = DaySlot::available(Some(0), Some(1440));

        let canonical = canonicalize_weekly_availability(weekly).expect("valid canonical weekly");
        assert_eq!(canonical.mon, DaySlot::unavailable());
        assert_eq!(canonical.tue, DaySlot::unknown());
        assert_eq!(canonical.wed, DaySlot::available(Some(0), Some(1440)));

        let invalids = vec![
            DaySlot::available(Some(1500), None),
            DaySlot::available(None, Some(1500)),
            DaySlot::available(Some(600), Some(600)),
            DaySlot::available(Some(720), Some(600)),
        ];
        for slot in invalids {
            let mut weekly = WeeklyAvailability::unknown();
            weekly.mon = slot;
            assert!(canonicalize_weekly_availability(weekly).is_err());
        }
    }

    #[test]
    fn overlap_counts_windows_and_blocking_ids() {
        let full = overlap(&[
            overlap_member(
                1,
                false,
                WeeklyAvailability::from_slot(DaySlot::available(None, None)),
            ),
            overlap_member(
                2,
                false,
                WeeklyAvailability::from_slot(DaySlot::available(None, None)),
            ),
        ]);
        assert_eq!(full.mon.available, 2);
        assert_eq!(full.mon.window_from, Some(0));
        assert_eq!(full.mon.window_to, Some(1440));
        assert!(full.mon.full_squad);

        let intersection = overlap(&[
            overlap_member(
                1,
                false,
                weekly_with_mon(DaySlot::available(Some(1140), Some(1320))),
            ),
            overlap_member(
                2,
                false,
                weekly_with_mon(DaySlot::available(Some(1200), Some(1380))),
            ),
        ]);
        assert_eq!(intersection.mon.window_from, Some(1200));
        assert_eq!(intersection.mon.window_to, Some(1320));
        assert!(intersection.mon.full_squad);

        let no_window = overlap(&[
            overlap_member(
                1,
                false,
                weekly_with_mon(DaySlot::available(Some(600), Some(720))),
            ),
            overlap_member(
                2,
                false,
                weekly_with_mon(DaySlot::available(Some(780), Some(840))),
            ),
        ]);
        assert_eq!(no_window.mon.available, 2);
        assert_eq!(no_window.mon.window_from, None);
        assert_eq!(no_window.mon.window_to, None);
        assert!(!no_window.mon.full_squad);

        let blockers = overlap(&[
            overlap_member(1, false, weekly_with_mon(DaySlot::unavailable())),
            overlap_member(2, false, weekly_with_mon(DaySlot::unknown())),
            overlap_member(
                3,
                false,
                weekly_with_mon(DaySlot::available(Some(1080), None)),
            ),
        ]);
        assert_eq!(blockers.mon.available, 1);
        assert_eq!(blockers.mon.unavailable, 1);
        assert_eq!(blockers.mon.unknown, 1);
        assert_eq!(blockers.mon.unavailable_ids, vec![1]);
        assert_eq!(blockers.mon.unknown_ids, vec![2]);
        assert_eq!(blockers.mon.window_from, Some(1080));
        assert_eq!(blockers.mon.window_to, Some(1440));
        assert!(!blockers.mon.full_squad);

        let bench_ignored = overlap(&[
            overlap_member(
                1,
                false,
                WeeklyAvailability::from_slot(DaySlot::available(None, None)),
            ),
            overlap_member(
                2,
                true,
                WeeklyAvailability::from_slot(DaySlot::unavailable()),
            ),
        ]);
        assert_eq!(bench_ignored.mon.available, 1);
        assert_eq!(bench_ignored.mon.unavailable, 0);
        assert!(bench_ignored.mon.full_squad);
    }

    #[test]
    fn roster_suggestion_ranks_empty_pool_and_auto_window() {
        let window = ScrimWindow {
            day: Weekday::Mon,
            from: 18 * 60,
            to: 22 * 60,
        };
        let pool = vec![
            roster_pool_candidate(
                1,
                "Alpha",
                weekly_with_mon(DaySlot::available(Some(18 * 60), Some(22 * 60))),
            ),
            roster_pool_candidate(
                2,
                "Beta",
                weekly_with_mon(DaySlot::available(Some(19 * 60), Some(21 * 60))),
            ),
            roster_pool_candidate(3, "Gamma", weekly_with_mon(DaySlot::unavailable())),
        ];

        let ranked = build_roster_suggestion(&pool, Some(window), 2);
        assert_eq!(
            ranked
                .candidates
                .iter()
                .map(|candidate| candidate.participant_id)
                .collect::<Vec<_>>(),
            vec![1, 2]
        );
        assert_eq!(ranked.candidates[0].fit_minutes, 240);
        assert_eq!(ranked.candidates[1].fit_minutes, 120);
        assert_eq!(ranked.fit_count, 2);
        assert_eq!(
            ranked.best_window,
            Some(ScrimWindow {
                day: Weekday::Mon,
                from: 19 * 60,
                to: 21 * 60,
            })
        );

        let empty = build_roster_suggestion(&[], Some(window), 6);
        assert!(empty.candidates.is_empty());
        assert_eq!(empty.fit_count, 0);
        assert_eq!(empty.best_window, None);

        let auto = build_roster_suggestion(&pool, None, 2);
        assert_eq!(auto.fit_count, 2);
        assert_eq!(
            auto.best_window,
            Some(ScrimWindow {
                day: Weekday::Mon,
                from: 19 * 60,
                to: 21 * 60,
            })
        );
    }

    #[test]
    fn discord_role_diff_builds_expected_actions() {
        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[101]),
            &role_snapshot(7, Some(42), &[102]),
        );
        assert_eq!(
            plan.actions,
            vec![
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: 101,
                },
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Add,
                    role_id: 102,
                },
            ]
        );

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[]),
            &role_snapshot(7, Some(42), &[102]),
        );
        assert_eq!(
            plan.actions,
            vec![DiscordRoleAction {
                operation: DiscordRoleOperation::Add,
                role_id: 102,
            }]
        );

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[101]),
            &role_snapshot(7, Some(42), &[]),
        );
        assert_eq!(
            plan.actions,
            vec![DiscordRoleAction {
                operation: DiscordRoleOperation::Remove,
                role_id: 101,
            }]
        );

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[]),
            &role_snapshot(7, Some(42), &[]),
        );
        assert!(plan.actions.is_empty());

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[9001]),
            &role_snapshot(7, Some(42), &[101]),
        );
        assert_eq!(
            plan.actions,
            vec![
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: 9001,
                },
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Add,
                    role_id: 101,
                },
            ]
        );

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[101]),
            &role_snapshot(7, Some(42), &[9001]),
        );
        assert_eq!(
            plan.actions,
            vec![
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: 101,
                },
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Add,
                    role_id: 9001,
                },
            ]
        );

        let plan = DiscordRoleSyncPlan::diff(
            &role_snapshot(7, Some(42), &[101, 9001]),
            &role_snapshot(7, Some(42), &[]),
        );
        assert_eq!(
            plan.actions,
            vec![
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: 101,
                },
                DiscordRoleAction {
                    operation: DiscordRoleOperation::Remove,
                    role_id: 9001,
                },
            ]
        );
    }

    #[tokio::test]
    async fn discord_sync_skips_unlinked_participant_without_broker_call() {
        let broker = FakeDiscordRoleBroker::configured(false);
        let status = execute_discord_sync_with_broker(
            128,
            &broker,
            DiscordRoleSyncPlan::resync(&role_snapshot(7, None, &[101])),
        )
        .await;

        assert!(status.ok);
        assert_eq!(status.detail, DISCORD_SYNC_NO_ACCOUNT);
        assert!(broker.calls().is_empty());
    }

    #[tokio::test]
    async fn discord_sync_reports_broker_failure_without_panicking() {
        let broker = FakeDiscordRoleBroker::configured(true);
        let status = execute_discord_sync_with_broker(
            128,
            &broker,
            DiscordRoleSyncPlan::resync(&role_snapshot(7, Some(42), &[101])),
        )
        .await;

        assert!(!status.ok);
        assert_eq!(status.detail, DISCORD_SYNC_FAILED);
        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Add);
        assert_eq!(calls[0].1.guild_id, 128);
        assert_eq!(calls[0].1.user_id, 42);
        assert_eq!(calls[0].1.role_id, 101);
        assert_eq!(
            calls[0].1.idempotency_key.as_deref(),
            Some("scrim-7-101-add")
        );
    }

    #[tokio::test]
    async fn discord_sync_treats_empty_plan_as_noop_before_account_or_config_checks() {
        let broker = FakeDiscordRoleBroker::unconfigured();
        let status = execute_discord_sync_with_broker(
            128,
            &broker,
            DiscordRoleSyncPlan {
                participant_id: 7,
                discord_user_id: None,
                actions: Vec::new(),
            },
        )
        .await;

        assert!(status.ok);
        assert_eq!(status.detail, DISCORD_SYNC_NOOP);
        assert!(broker.calls().is_empty());
    }

    #[tokio::test]
    async fn discord_sync_reports_missing_configuration_without_broker_call() {
        let broker = FakeDiscordRoleBroker::unconfigured();
        let status = execute_discord_sync_with_broker(
            128,
            &broker,
            DiscordRoleSyncPlan::resync(&role_snapshot(7, Some(42), &[101])),
        )
        .await;

        assert!(!status.ok);
        assert_eq!(status.detail, DISCORD_SYNC_NOT_CONFIGURED);
        assert!(broker.calls().is_empty());
    }

    #[test]
    fn weekly_availability_json_shape_is_stable() {
        let value = serde_json::to_value(availability_roundtrip_body()).expect("serialize weekly");
        assert_exact_keys(&value, &["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
        assert_exact_keys(&value["mon"], &["status", "from", "to"]);
        assert_eq!(value["mon"]["status"], "available");
        assert_eq!(value["mon"]["from"], 1140);
        assert_eq!(value["mon"]["to"], 1320);
        assert_eq!(value["tue"]["status"], "available");
        assert!(value["tue"]["from"].is_null());
        assert!(value["tue"]["to"].is_null());
        assert_eq!(value["wed"]["status"], "unavailable");
        assert!(value["sun"]["from"].is_null());
    }

    #[test]
    fn day_overlap_json_shape_is_stable() {
        let value = serde_json::to_value(DayOverlap {
            available: 2,
            unavailable: 1,
            unknown: 1,
            window_from: Some(1200),
            window_to: Some(1320),
            full_squad: false,
            unavailable_ids: vec![3],
            unknown_ids: vec![4],
        })
        .expect("serialize overlap");
        assert_exact_keys(
            &value,
            &[
                "available",
                "unavailable",
                "unknown",
                "window_from",
                "window_to",
                "full_squad",
                "unavailable_ids",
                "unknown_ids",
            ],
        );
        assert_eq!(value["window_from"], 1200);
        assert_eq!(value["unavailable_ids"], json!([3]));
        assert!(value["full_squad"].is_boolean());
    }

    #[test]
    fn scrim_me_response_json_shape_is_stable() {
        let response = ScrimMeResponse {
            participant: Some(ScrimParticipant {
                id: 1,
                display_name: "Participant One".to_string(),
                rank: Some("Oracle".to_string()),
                roles: Some("Flex".to_string()),
                availability: None,
                availability_slots: WeeklyAvailability::unknown(),
                availability_confirmed: false,
                status: "assigned".to_string(),
                source: "web_form".to_string(),
            }),
            team: Some(ScrimTeam {
                id: 10,
                name: "Team One".to_string(),
                coach: Some("Coach".to_string()),
                discord_role_id: Some(456),
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
                "availability_slots",
                "availability_confirmed",
                "status",
                "source",
            ],
        );
        assert_exact_keys(
            &value["team"],
            &[
                "id",
                "name",
                "coach",
                "discord_role_id",
                "discord_channel_id",
            ],
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
        assert_eq!(
            value["participant"]["availability_slots"]["mon"]["status"],
            "unknown"
        );
        assert!(value["participant"]["availability_confirmed"].is_boolean());
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
            availability_slots: WeeklyAvailability::unknown(),
            availability_confirmed: false,
            discord_linked: true,
            notes: Some("Coach note".to_string()),
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
                "availability_slots",
                "availability_confirmed",
                "discord_linked",
                "notes",
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
        assert_eq!(value["notes"], "Coach note");
        assert!(value["discord_linked"].is_boolean());
        assert!(value["is_bench"].is_boolean());
    }

    #[test]
    fn scrim_patch_response_json_shape_is_additive() {
        let response = ScrimParticipantPatchResponse {
            participant: pool_participant_sample(),
            discord_sync: DiscordSyncStatus {
                ok: true,
                detail: DISCORD_SYNC_SUCCESS.to_string(),
            },
        };

        let value = serde_json::to_value(response).expect("serialize patch response");
        assert_exact_keys(
            &value,
            &[
                "id",
                "display_name",
                "rank",
                "roles",
                "availability",
                "availability_slots",
                "availability_confirmed",
                "discord_linked",
                "notes",
                "status",
                "source",
                "team",
                "role",
                "is_captain",
                "is_bench",
                "discord_sync",
            ],
        );
        assert_exact_keys(&value["discord_sync"], &["ok", "detail"]);
        assert_eq!(value["discord_sync"]["ok"], true);
        assert_eq!(value["discord_sync"]["detail"], DISCORD_SYNC_SUCCESS);
    }

    #[test]
    fn scrim_team_board_response_json_shape_is_stable() {
        let response = ScrimTeamBoardResponse {
            team: ScrimTeam {
                id: 1,
                name: "Alpha".to_string(),
                coach: Some("Coach A".to_string()),
                discord_role_id: Some(101),
                discord_channel_id: Some(201),
            },
            members: vec![ScrimTeamBoardMember {
                participant_id: 1,
                display_name: "Participant One".to_string(),
                rank: Some("Oracle".to_string()),
                roles: Some("Flex".to_string()),
                is_captain: true,
                is_bench: false,
                discord_linked: true,
                availability_confirmed: true,
                availability: availability_roundtrip_body(),
                notes: None,
            }],
            overlap: WeeklyOverlap {
                mon: day_overlap_sample(),
                tue: day_overlap_sample(),
                wed: day_overlap_sample(),
                thu: day_overlap_sample(),
                fri: day_overlap_sample(),
                sat: day_overlap_sample(),
                sun: day_overlap_sample(),
            },
        };

        let value = serde_json::to_value(response).expect("serialize board");
        assert_exact_keys(&value, &["team", "members", "overlap"]);
        assert_exact_keys(
            &value["members"][0],
            &[
                "participant_id",
                "display_name",
                "rank",
                "roles",
                "is_captain",
                "is_bench",
                "discord_linked",
                "availability_confirmed",
                "availability",
                "notes",
            ],
        );
        assert_exact_keys(
            &value["overlap"],
            &["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        );
        assert_eq!(value["members"][0]["availability"]["mon"]["from"], 1140);
        assert!(value["members"][0]["discord_linked"].is_boolean());
    }

    #[tokio::test]
    #[serial]
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
        assert_eq!(body["participant"]["availability_confirmed"], true);
        assert_eq!(
            body["participant"]["availability_slots"]["mon"]["from"],
            1140
        );
        assert_eq!(body["participant"]["availability_slots"]["mon"]["to"], 1320);
        assert_eq!(body["team"]["name"], "Alpha");
        assert_eq!(body["members"].as_array().expect("members").len(), 2);
        assert_eq!(body["next_match"]["opponent_team_name"], "Beta");

        let availability_body = availability_roundtrip_body();
        let availability_payload =
            serde_json::to_value(&availability_body).expect("availability payload");
        for _ in 0..2 {
            let response = app
                .clone()
                .oneshot(authenticated_request(
                    Method::PUT,
                    "/api/scrim/me/availability",
                    &user_token,
                    Some(availability_payload.clone()),
                ))
                .await
                .expect("put availability response");
            assert_eq!(response.status(), StatusCode::OK);
            let body = to_json(response).await;
            assert_eq!(body["id"], 1);
            assert_eq!(body["availability_confirmed"], true);
            assert_eq!(body["availability_slots"], availability_payload);
        }
        let row = sqlx::query(
            "SELECT availability_slots, availability FROM scrim.participants WHERE id=$1",
        )
        .bind(1_i32)
        .fetch_one(&state.pool)
        .await
        .expect("availability row");
        let stored_slots: Value = row.get("availability_slots");
        let stored_legacy: String = row.get("availability");
        assert_eq!(stored_slots, availability_payload);
        assert_eq!(
            serde_json::from_str::<Value>(&stored_legacy).expect("legacy json"),
            json!({
                "Mo": "19:00-22:00",
                "Di": "Flexibel",
                "Mi": "Geht nicht",
                "Do": "ab 14:00",
                "Fr": "ab 20:30",
                "Sa": "10:00-17:00",
                "So": ""
            })
        );
        let mut invalid_availability = availability_roundtrip_body();
        invalid_availability.mon = DaySlot::available(Some(1500), None);
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PUT,
                "/api/scrim/me/availability",
                &user_token,
                Some(serde_json::to_value(invalid_availability).expect("invalid payload")),
            ))
            .await
            .expect("invalid availability response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            to_json(response).await["detail"],
            "Ungültige Verfügbarkeitsangabe."
        );
        let participant_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM scrim.participants")
            .fetch_one(&state.pool)
            .await
            .expect("participant count");
        assert_eq!(participant_count, 3);

        let missing_token = state
            .auth
            .create_session_jwt("4444", "missing_user", "user", Some("Missing User"), None)
            .expect("missing token");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::PUT,
                "/api/scrim/me/availability",
                &missing_token,
                Some(availability_payload.clone()),
            ))
            .await
            .expect("missing availability response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            to_json(response).await["detail"],
            "Bitte zuerst zum Scrim-Pool anmelden."
        );

        let signup_token = state
            .auth
            .create_session_jwt("3333", "signup_user", "user", Some("Signup User"), None)
            .expect("signup token");
        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/signup",
                &signup_token,
                Some(json!({
                    "rank": "Oracle",
                    "roles": "Flex",
                    "availability": "Abends"
                })),
            ))
            .await
            .expect("legacy signup response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["display_name"], "Signup User");
        assert_eq!(body["rank"], "Oracle");
        assert_eq!(body["availability_confirmed"], false);
        assert_eq!(body["availability_slots"]["mon"]["from"], 1080);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/signup",
                &signup_token,
                Some(json!({
                    "rank": "Phantom",
                    "roles": "Flex",
                    "availability": "ignored when slots exist",
                    "availability_slots": availability_payload.clone()
                })),
            ))
            .await
            .expect("structured signup response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["display_name"], "Signup User");
        assert_eq!(body["rank"], "Phantom");
        assert_eq!(body["availability_confirmed"], true);
        assert_eq!(body["availability_slots"], availability_payload);
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
        let free_agent = pool
            .iter()
            .find(|participant| participant["display_name"] == "Free Agent")
            .expect("free agent in pool");
        assert_eq!(free_agent["availability_confirmed"], false);
        assert_eq!(free_agent["availability_slots"]["mon"]["status"], "unknown");
        assert_eq!(free_agent["discord_linked"], true);
        assert!(free_agent["notes"].is_null());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams",
                &coach_token,
                None,
            ))
            .await
            .expect("teams response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        let teams = body.as_array().expect("teams array");
        assert_eq!(teams.len(), 3);
        assert_eq!(teams[0]["name"], "Alpha");
        assert_eq!(teams[0]["discord_role_id"], 101);
        assert_eq!(teams[1]["name"], "Beta");
        assert_eq!(teams[1]["discord_role_id"], 102);
        assert_eq!(teams[2]["name"], "Gamma");
        assert!(teams[2]["discord_role_id"].is_null());

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams",
                &coach_token,
                Some(json!({
                    "name": "Delta",
                    "coach": "Coach D"
                })),
            ))
            .await
            .expect("create team response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["name"], "Delta");
        assert_eq!(body["coach"], "Coach D");
        assert!(body["discord_role_id"].is_null());
        let created_team_id = body["id"].as_i64().expect("created team id");

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::POST,
                &format!("/api/scrim/teams/{created_team_id}/suggest"),
                &coach_token,
                Some(json!({
                    "window": { "day": "mon", "from": 19 * 60, "to": 22 * 60 },
                    "size": 6
                })),
            ))
            .await
            .expect("suggest roster response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["fit_count"], 1);
        assert_eq!(body["best_window"]["day"], "mon");
        assert_eq!(body["best_window"]["from"], 19 * 60);
        assert_eq!(body["best_window"]["to"], 22 * 60);
        assert_eq!(body["candidates"][0]["display_name"], "Signup User");
        assert_eq!(body["candidates"][0]["fit_minutes"], 180);

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams/404/board",
                &coach_token,
                None,
            ))
            .await
            .expect("missing board response");
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(to_json(response).await["detail"], "Team nicht gefunden.");

        let response = app
            .clone()
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/teams/1/board",
                &coach_token,
                None,
            ))
            .await
            .expect("board response");
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["team"]["name"], "Alpha");
        assert_eq!(body["team"]["discord_role_id"], 101);
        assert_eq!(body["members"].as_array().expect("board members").len(), 2);
        assert_eq!(body["members"][0]["participant_id"], 1);
        assert_eq!(body["members"][0]["availability_confirmed"], true);
        assert_eq!(body["members"][0]["discord_linked"], true);
        assert_eq!(body["members"][1]["participant_id"], 2);
        assert_eq!(body["members"][1]["availability_confirmed"], false);
        assert_eq!(body["members"][1]["discord_linked"], false);
        assert_eq!(body["members"][1]["notes"], "Legacy-only availability");
        assert_eq!(body["overlap"]["mon"]["available"], 2);
        assert_eq!(body["overlap"]["mon"]["window_from"], 1200);
        assert_eq!(body["overlap"]["mon"]["window_to"], 1320);
        assert_eq!(body["overlap"]["mon"]["full_squad"], true);
        assert_eq!(body["overlap"]["wed"]["unavailable"], 2);
        assert_eq!(body["overlap"]["wed"]["unavailable_ids"], json!([1, 2]));
        assert_eq!(body["overlap"]["fri"]["available"], 1);
        assert_eq!(body["overlap"]["fri"]["unknown"], 1);
        assert_eq!(body["overlap"]["fri"]["unknown_ids"], json!([2]));
        assert_eq!(body["overlap"]["fri"]["full_squad"], false);

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
                    "is_captain": false,
                    "notes": "Kann shotcallen",
                    "rank": "Phantom",
                    "roles": "Flex"
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
        assert_eq!(body["rank"], "Phantom");
        assert_eq!(body["roles"], "Flex");
        assert_eq!(body["notes"], "Kann shotcallen");
        assert_eq!(body["discord_linked"], true);
        assert_eq!(body["discord_sync"]["ok"], false);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_NOT_CONFIGURED);
        let persisted_notes: Option<String> =
            sqlx::query_scalar("SELECT notes FROM scrim.participants WHERE id=$1")
                .bind(signup_id)
                .fetch_one(&state.pool)
                .await
                .expect("persisted notes");
        assert_eq!(persisted_notes.as_deref(), Some("Kann shotcallen"));

        sqlx::query("ALTER TABLE scrim.participants DROP COLUMN availability_slots")
            .execute(&state.pool)
            .await
            .expect("drop drift column");
        let response = app
            .oneshot(authenticated_request(
                Method::GET,
                "/api/scrim/pool",
                &coach_token,
                None,
            ))
            .await
            .expect("drift response");
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_create_team_persists_created_discord_role() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/teams",
                &coach_token,
                Some(json!({ "name": "Echo", "coach": "Coach E" })),
            ))
            .await
            .expect("create team response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        let team_id = body["id"].as_i64().expect("team id");
        assert_eq!(body["discord_role_id"], 901);

        let persisted: Option<i64> =
            sqlx::query_scalar("SELECT discord_role_id FROM scrim.teams WHERE id=$1")
                .bind(team_id as i32)
                .fetch_one(&state.pool)
                .await
                .expect("persisted role id");
        assert_eq!(persisted, Some(901));

        let create_calls = broker.create_calls();
        assert_eq!(create_calls.len(), 1);
        assert_eq!(create_calls[0].guild_id, state.cfg.scrim_guild_id);
        assert_eq!(create_calls[0].name, "Echo");
        assert!(!create_calls[0].mentionable);
        assert_eq!(create_calls[0].reason.as_deref(), Some("Scrim-Team Echo"));
        let expected_idempotency_key = format!("scrim-team-{team_id}-role-create");
        assert_eq!(
            create_calls[0].idempotency_key.as_deref(),
            Some(expected_idempotency_key.as_str())
        );
    }

    #[tokio::test]
    #[serial]
    async fn scrim_signup_adds_reserve_role_when_configured() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker_and_reserve(broker_for_state, Some(9001)).await
        else {
            return;
        };
        let app = router(state.clone());
        let signup_token = state
            .auth
            .create_session_jwt("3333", "signup_user", "user", Some("Signup User"), None)
            .expect("signup token");

        let response = app
            .oneshot(authenticated_request(
                Method::POST,
                "/api/scrim/signup",
                &signup_token,
                Some(json!({ "rank": "Oracle", "roles": "Flex" })),
            ))
            .await
            .expect("signup response");

        assert_eq!(response.status(), StatusCode::OK);
        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Add);
        assert_eq!(calls[0].1.user_id, 3333);
        assert_eq!(calls[0].1.role_id, 9001);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_is_fail_open_when_discord_broker_fails() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(true));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/3",
                &coach_token,
                Some(json!({
                    "status": "assigned",
                    "team_id": 1
                })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["team"]["id"], 1);
        assert_eq!(body["discord_sync"]["ok"], false);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_FAILED);

        let assigned: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM scrim.team_members WHERE participant_id=3 AND team_id=1",
        )
        .fetch_one(&state.pool)
        .await
        .expect("team member persisted");
        assert_eq!(assigned, 1);

        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Add);
        assert_eq!(calls[0].1.role_id, 101);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_removes_discord_role_when_status_becomes_inactive() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/1",
                &coach_token,
                Some(json!({ "status": "inactive" })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["status"], "inactive");
        assert_eq!(body["discord_sync"]["ok"], true);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_SUCCESS);

        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.user_id, 1111);
        assert_eq!(calls[0].1.role_id, 101);
        assert_eq!(
            calls[0].1.idempotency_key.as_deref(),
            Some("scrim-1-101-remove")
        );
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_removes_team_role_when_team_id_is_null() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/1",
                &coach_token,
                Some(json!({ "team_id": null })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert!(body["team"].is_null());
        assert_eq!(body["discord_sync"]["ok"], true);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_SUCCESS);

        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.user_id, 1111);
        assert_eq!(calls[0].1.role_id, 101);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_switches_team_role_in_one_patch() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/1",
                &coach_token,
                Some(json!({ "team_id": 2 })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["team"]["id"], 2);
        assert_eq!(body["discord_sync"]["ok"], true);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_SUCCESS);

        let member_team_id: i32 =
            sqlx::query_scalar("SELECT team_id FROM scrim.team_members WHERE participant_id=$1")
                .bind(1_i32)
                .fetch_one(&state.pool)
                .await
                .expect("member team id");
        assert_eq!(member_team_id, 2);

        let calls = broker.calls();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.role_id, 101);
        assert_eq!(calls[1].0, DiscordRoleOperation::Add);
        assert_eq!(calls[1].1.role_id, 102);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_team_without_discord_role_is_noop_without_broker_call() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/3",
                &coach_token,
                Some(json!({
                    "status": "assigned",
                    "team_id": 3
                })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["team"]["id"], 3);
        assert_eq!(body["discord_sync"]["ok"], true);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_NOOP);
        assert!(broker.calls().is_empty());
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_pool_to_team_removes_reserve_and_adds_team_role() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker_and_reserve(broker_for_state, Some(9001)).await
        else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/3",
                &coach_token,
                Some(json!({ "team_id": 1 })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["team"]["id"], 1);

        let calls = broker.calls();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.role_id, 9001);
        assert_eq!(calls[1].0, DiscordRoleOperation::Add);
        assert_eq!(calls[1].1.role_id, 101);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_team_to_pool_removes_team_role_and_adds_reserve() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker_and_reserve(broker_for_state, Some(9001)).await
        else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/1",
                &coach_token,
                Some(json!({ "team_id": null })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert!(body["team"].is_null());

        let calls = broker.calls();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.role_id, 101);
        assert_eq!(calls[1].0, DiscordRoleOperation::Add);
        assert_eq!(calls[1].1.role_id, 9001);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_pool_inactive_removes_reserve_role() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker_and_reserve(broker_for_state, Some(9001)).await
        else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/3",
                &coach_token,
                Some(json!({ "status": "inactive" })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["status"], "inactive");

        let calls = broker.calls();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].0, DiscordRoleOperation::Remove);
        assert_eq!(calls[0].1.role_id, 9001);
    }

    #[tokio::test]
    #[serial]
    async fn scrim_patch_notes_only_is_noop_without_broker_call() {
        let broker = Arc::new(FakeDiscordRoleBroker::configured(false));
        let broker_for_state: Arc<dyn DiscordRoleBroker> = broker.clone();
        let Some(state) = test_state_with_broker(broker_for_state).await else {
            return;
        };
        let app = router(state.clone());
        let coach_token = state
            .auth
            .create_session_jwt("9000", "coach_user", "user", Some("Coach User"), None)
            .expect("coach token");

        let response = app
            .oneshot(authenticated_request(
                Method::PATCH,
                "/api/scrim/participants/1",
                &coach_token,
                Some(json!({ "notes": "Nur Notiz geaendert" })),
            ))
            .await
            .expect("patch response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_json(response).await;
        assert_eq!(body["notes"], "Nur Notiz geaendert");
        assert_eq!(body["discord_sync"]["ok"], true);
        assert_eq!(body["discord_sync"]["detail"], DISCORD_SYNC_NOOP);
        assert!(broker.calls().is_empty());
    }

    fn availability_roundtrip_body() -> WeeklyAvailability {
        WeeklyAvailability {
            mon: DaySlot::available(Some(1140), Some(1320)),
            tue: DaySlot::available(None, None),
            wed: DaySlot::unavailable(),
            thu: DaySlot::available(Some(840), None),
            fri: DaySlot::available(Some(1230), None),
            sat: DaySlot::available(Some(600), Some(1020)),
            sun: DaySlot::unknown(),
        }
    }

    fn weekly_with_mon(slot: DaySlot) -> WeeklyAvailability {
        let mut weekly = WeeklyAvailability::unknown();
        weekly.mon = slot;
        weekly
    }

    fn overlap_member(
        participant_id: i32,
        is_bench: bool,
        availability: WeeklyAvailability,
    ) -> OverlapMember {
        OverlapMember {
            participant_id,
            is_bench,
            availability,
        }
    }

    fn roster_pool_candidate(
        participant_id: i32,
        display_name: &str,
        availability_slots: WeeklyAvailability,
    ) -> RosterPoolCandidate {
        RosterPoolCandidate {
            participant_id,
            display_name: display_name.to_string(),
            rank: None,
            roles: Some("Flex".to_string()),
            availability: None,
            availability_slots,
            availability_confirmed: true,
            status: "new".to_string(),
            source: "test".to_string(),
        }
    }

    fn day_overlap_sample() -> DayOverlap {
        DayOverlap {
            available: 1,
            unavailable: 0,
            unknown: 0,
            window_from: Some(1140),
            window_to: Some(1320),
            full_squad: true,
            unavailable_ids: Vec::new(),
            unknown_ids: Vec::new(),
        }
    }

    fn pool_participant_sample() -> ScrimPoolParticipant {
        ScrimPoolParticipant {
            id: 2,
            display_name: "Pool Participant".to_string(),
            rank: None,
            roles: Some("Duo".to_string()),
            availability: Some("Abends".to_string()),
            availability_slots: WeeklyAvailability::unknown(),
            availability_confirmed: false,
            discord_linked: true,
            notes: Some("Coach note".to_string()),
            status: "new".to_string(),
            source: "discord_reaction".to_string(),
            team: None,
            role: None,
            is_captain: false,
            is_bench: false,
        }
    }

    fn role_snapshot(
        participant_id: i32,
        discord_user_id: Option<u64>,
        role_ids: &[u64],
    ) -> DiscordRoleSnapshot {
        DiscordRoleSnapshot {
            participant_id,
            discord_user_id,
            role_ids: role_ids.iter().copied().collect(),
        }
    }

    #[derive(Clone)]
    struct FakeDiscordRoleBroker {
        configured: bool,
        fail: bool,
        calls: Arc<Mutex<Vec<(DiscordRoleOperation, DiscordRoleBrokerRequest)>>>,
        create_calls: Arc<Mutex<Vec<DiscordCreateRoleBrokerRequest>>>,
        create_role_id: u64,
    }

    impl FakeDiscordRoleBroker {
        fn configured(fail: bool) -> Self {
            Self {
                configured: true,
                fail,
                calls: Arc::new(Mutex::new(Vec::new())),
                create_calls: Arc::new(Mutex::new(Vec::new())),
                create_role_id: 901,
            }
        }

        fn unconfigured() -> Self {
            Self {
                configured: false,
                fail: false,
                calls: Arc::new(Mutex::new(Vec::new())),
                create_calls: Arc::new(Mutex::new(Vec::new())),
                create_role_id: 901,
            }
        }

        fn calls(&self) -> Vec<(DiscordRoleOperation, DiscordRoleBrokerRequest)> {
            self.calls.lock().expect("fake broker calls").clone()
        }

        fn create_calls(&self) -> Vec<DiscordCreateRoleBrokerRequest> {
            self.create_calls
                .lock()
                .expect("fake broker create calls")
                .clone()
        }
    }

    impl DiscordRoleBroker for FakeDiscordRoleBroker {
        fn is_configured(&self) -> bool {
            self.configured
        }

        fn apply_role<'a>(
            &'a self,
            operation: DiscordRoleOperation,
            request: DiscordRoleBrokerRequest,
        ) -> DiscordRoleBrokerFuture<'a> {
            Box::pin(async move {
                self.calls
                    .lock()
                    .expect("fake broker calls")
                    .push((operation, request));
                if self.fail {
                    Err(DiscordRoleBrokerError::Rejected)
                } else {
                    Ok(())
                }
            })
        }

        fn create_role<'a>(
            &'a self,
            request: DiscordCreateRoleBrokerRequest,
        ) -> DiscordRoleBrokerFuture<'a, u64> {
            Box::pin(async move {
                if !self.configured {
                    return Err(DiscordRoleBrokerError::Unconfigured);
                }
                self.create_calls
                    .lock()
                    .expect("fake broker create calls")
                    .push(request);
                if self.fail {
                    Err(DiscordRoleBrokerError::Rejected)
                } else {
                    Ok(self.create_role_id)
                }
            })
        }
    }

    async fn test_state() -> Option<AppState> {
        test_state_with_broker(Arc::new(FakeDiscordRoleBroker::unconfigured())).await
    }

    async fn test_state_with_broker(
        discord_role_broker: Arc<dyn DiscordRoleBroker>,
    ) -> Option<AppState> {
        test_state_with_broker_and_reserve(discord_role_broker, None).await
    }

    async fn test_state_with_broker_and_reserve(
        discord_role_broker: Arc<dyn DiscordRoleBroker>,
        scrim_reserve_role_id: Option<i64>,
    ) -> Option<AppState> {
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
        let mut cfg = Config::from_env();
        cfg.master_broker_token = None;
        cfg.scrim_reserve_role_id = scrim_reserve_role_id;
        Some(AppState::for_test_pool_with_broker(
            pool,
            cfg,
            discord_role_broker,
        ))
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
        let seeded_slots =
            serde_json::to_value(availability_roundtrip_body()).expect("seeded availability slots");
        let seeded_legacy =
            render_legacy_availability(&availability_roundtrip_body()).expect("seeded legacy text");
        let legacy_only = r#"{"Mo":"20-22","Di":"Flexibel","Mi":"Geht nicht","Do":"Ab 14","Fr":"?","Sa":"15-24","So":"so abends"}"#;
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
             (id, discord_id, display_name, rank, rank_source, rank_verified, roles, availability, availability_slots, notes, status, source, created_at, updated_at) \
             VALUES \
             (1, 1111, 'Scrim User', 'Oracle', 'self', false, 'Flex', $1, $2::jsonb, NULL, 'assigned', 'seed', now(), now()), \
             (2, NULL, 'Team Mate', NULL, 'self', false, NULL, $3, NULL, 'Legacy-only availability', 'assigned', 'seed', now(), now()), \
             (3, 2222, 'Free Agent', NULL, 'self', false, NULL, NULL, NULL, NULL, 'new', 'seed', now(), now())",
        )
        .bind(seeded_legacy)
        .bind(seeded_slots)
        .bind(legacy_only)
        .execute(pool)
        .await
        .expect("seed participants");
        sqlx::query(
            "INSERT INTO scrim.teams(id, name, coach, discord_role_id, discord_channel_id, created_at) \
             VALUES \
             (1, 'Alpha', 'Coach A', 101, 201, now()), \
             (2, 'Beta', 'Coach B', 102, 202, now()), \
             (3, 'Gamma', 'Coach C', NULL, 203, now())",
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
             availability_slots JSONB, \
             notes TEXT, \
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
