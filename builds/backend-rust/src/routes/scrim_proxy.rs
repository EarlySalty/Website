use std::{collections::HashMap, net::SocketAddr, sync::LazyLock};

use axum::{
    body::{Body, Bytes},
    extract::{ConnectInfo, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::{get, patch, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{json, Value};
use url::form_urlencoded;

use crate::{
    app::AppState,
    auth,
    config::ScrimBackendMode,
    error::AppError,
    routes::scrim::{DayStatus, ScrimPoolSource, ScrimWindow, Weekday},
    scrim_upstream::{
        generated_request_id, idempotency_key, service_unavailable_response,
        upstream_error_response, upstream_response_to_browser, ScrimActorAssertion,
        ScrimUpstreamClient, ScrimUpstreamKind, ScrimUpstreamRequest, ScrimUpstreamResponse,
    },
};

pub const SCRIM_PROXY_MAX_REQUEST_BYTES: usize = 64 * 1024;

const TURNIER_PREFIX: &str = "/internal/turnier/v1/scrims";
const AI_LAGEBILDER_PREFIX: &str = "/internal/dl-bots/v1/scrim/lagebilder";
const WEEKDAYS: [&str; 7] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

static EMPTY_OBJECT: LazyLock<Value> = LazyLock::new(|| json!({}));

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ProxyAuth {
    User,
    Coach,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum ResponseAdapter {
    Json,
    CommandCenter,
    Me,
    Pool { status: Option<String> },
    Teams,
    Board,
    LegacyOverview,
}

#[derive(Debug, Default, Deserialize)]
pub struct CommonQuery {
    pub status: Option<String>,
    pub team_id: Option<String>,
    pub match_id: Option<String>,
    pub limit: Option<u16>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdString(String);

impl IdString {
    fn parse(value: impl Into<String>) -> Result<Self, String> {
        let value = value.into();
        let value = value.trim();
        if !positive_decimal_id(value) {
            return Err("id must be a positive decimal string".to_string());
        }
        Ok(Self(value.to_string()))
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}

impl Serialize for IdString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for IdString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Self::parse(raw).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyIdString(String);

impl LegacyIdString {
    fn into_id(self) -> IdString {
        IdString(self.0)
    }
}

impl<'de> Deserialize<'de> for LegacyIdString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = Value::deserialize(deserializer)?;
        let raw = match value {
            Value::String(value) => value,
            Value::Number(value) if value.is_u64() => value.to_string(),
            _ => {
                return Err(serde::de::Error::custom(
                    "legacy id must be a positive decimal",
                ))
            }
        };
        IdString::parse(raw)
            .map(|id| Self(id.0))
            .map_err(serde::de::Error::custom)
    }
}

impl Serialize for LegacyIdString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrowserCompatIdString(String);

impl BrowserCompatIdString {
    fn parse_decimal(value: &str) -> Result<Self, String> {
        if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(browser_compat_id_error());
        }
        let id = value
            .parse::<u64>()
            .map_err(|_| browser_compat_id_error())?;
        Self::from_u64(id)
    }

    fn from_u64(id: u64) -> Result<Self, String> {
        if id == 0 || id > i32::MAX as u64 {
            return Err(browser_compat_id_error());
        }
        Ok(Self(id.to_string()))
    }
}

impl Serialize for BrowserCompatIdString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for BrowserCompatIdString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        match Value::deserialize(deserializer)? {
            Value::String(value) => Self::parse_decimal(&value),
            Value::Number(value) => value
                .as_u64()
                .map(Self::from_u64)
                .unwrap_or_else(|| Err(browser_compat_id_error())),
            _ => Err(browser_compat_id_error()),
        }
        .map_err(serde::de::Error::custom)
    }
}

fn browser_compat_id_error() -> String {
    "browser compatibility id must be a positive int32 decimal string or integer".to_string()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProxyDaySlot {
    pub status: DayStatus,
    pub from: Option<u16>,
    pub to: Option<u16>,
}

impl Default for ProxyDaySlot {
    fn default() -> Self {
        Self {
            status: DayStatus::Unknown,
            from: None,
            to: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProxyWeeklyAvailability {
    #[serde(default)]
    pub mon: ProxyDaySlot,
    #[serde(default)]
    pub tue: ProxyDaySlot,
    #[serde(default)]
    pub wed: ProxyDaySlot,
    #[serde(default)]
    pub thu: ProxyDaySlot,
    #[serde(default)]
    pub fri: ProxyDaySlot,
    #[serde(default)]
    pub sat: ProxyDaySlot,
    #[serde(default)]
    pub sun: ProxyDaySlot,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SignupRequest {
    pub rank: Option<String>,
    pub roles: Option<String>,
    pub availability: Option<String>,
    pub availability_slots: Option<ProxyWeeklyAvailability>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CreateTeamRequest {
    pub name: String,
    pub coach: Option<String>,
    pub coach_discord_id: Option<String>,
    pub default_from: Option<i32>,
    pub default_to: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AnnounceRequest {
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SuggestRosterRequest {
    pub window: Option<ScrimWindow>,
    pub size: Option<u32>,
    #[serde(default)]
    pub pool: ScrimPoolSource,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SubstituteRequest {
    pub participant_id: BrowserCompatIdString,
    pub window: ScrimWindow,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum PatchField<T> {
    #[default]
    Omitted,
    Null,
    Value(T),
}

impl<T> PatchField<T> {
    fn is_omitted(&self) -> bool {
        matches!(self, Self::Omitted)
    }
}

impl<T> Serialize for PatchField<T>
where
    T: Serialize,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Omitted => serializer.serialize_unit(),
            Self::Null => serializer.serialize_none(),
            Self::Value(value) => value.serialize(serializer),
        }
    }
}

impl<'de, T> Deserialize<'de> for PatchField<T>
where
    T: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Option::<T>::deserialize(deserializer).map(|value| match value {
            Some(value) => Self::Value(value),
            None => Self::Null,
        })
    }
}

fn patch_field_omitted<T>(field: &PatchField<T>) -> bool {
    field.is_omitted()
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlanningCreateRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub technical_template_key: Option<String>,
    pub deadline_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slots: Option<Vec<PlanningSlot>>,
    pub pairings: Vec<PlanningPairing>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlanningSlot {
    pub day: Weekday,
    pub from_minute: u16,
    pub to_minute: u16,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PlanningPairing {
    pub team_a_id: IdString,
    #[serde(default)]
    pub team_b_id: Option<IdString>,
    #[serde(default)]
    pub slots: Option<Vec<PlanningSlot>>,
}

impl PlanningCreateRequest {
    fn validate(&self) -> Result<(), AppError> {
        if let Some(technical_template_key) = self.technical_template_key.as_deref() {
            validate_small_label(technical_template_key, "technical_template_key")?;
        }
        if let Some(slots) = self.slots.as_deref() {
            validate_slots(slots)?;
        }
        if self.pairings.is_empty() {
            return Err(AppError::bad_request("pairings must not be empty"));
        }
        for pairing in &self.pairings {
            if pairing
                .team_b_id
                .as_ref()
                .is_some_and(|team_b| team_b.as_str() == pairing.team_a_id.as_str())
            {
                return Err(AppError::bad_request("pairing teams must be different"));
            }
            let effective_slots = pairing.slots.as_deref().or(self.slots.as_deref());
            let Some(effective_slots) = effective_slots else {
                return Err(AppError::bad_request("Each pairing needs 2-5 slots"));
            };
            validate_slots(effective_slots)?;
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyPlanningCreateRequest {
    pub template: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    #[serde(default)]
    pub slots: Option<Vec<LegacyPlanningSlot>>,
    #[serde(alias = "pairings")]
    pub matches: Vec<LegacyPlanningPairing>,
}

impl LegacyPlanningCreateRequest {
    fn into_canonical(self) -> Result<PlanningCreateRequest, AppError> {
        let deadline_at = self
            .deadline
            .ok_or_else(|| AppError::bad_request("deadline is required"))?;
        Ok(PlanningCreateRequest {
            technical_template_key: self.template,
            deadline_at,
            slots: self.slots.map(|slots| {
                slots
                    .into_iter()
                    .map(LegacyPlanningSlot::into_slot)
                    .collect()
            }),
            pairings: self
                .matches
                .into_iter()
                .map(LegacyPlanningPairing::into_pairing)
                .collect(),
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyPlanningSlot {
    pub day: Weekday,
    #[serde(alias = "from_minute")]
    pub from: u16,
    #[serde(alias = "to_minute")]
    pub to: u16,
}

impl LegacyPlanningSlot {
    fn into_slot(self) -> PlanningSlot {
        PlanningSlot {
            day: self.day,
            from_minute: self.from,
            to_minute: self.to,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyPlanningPairing {
    pub team_a_id: LegacyIdString,
    #[serde(default)]
    pub team_b_id: Option<LegacyIdString>,
    #[serde(default)]
    pub slots: Option<Vec<LegacyPlanningSlot>>,
}

impl LegacyPlanningPairing {
    fn into_pairing(self) -> PlanningPairing {
        PlanningPairing {
            team_a_id: self.team_a_id.into_id(),
            team_b_id: self.team_b_id.map(LegacyIdString::into_id),
            slots: self.slots.map(|slots| {
                slots
                    .into_iter()
                    .map(LegacyPlanningSlot::into_slot)
                    .collect()
            }),
        }
    }
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MatchCreateRequest {
    pub team_a_id: Option<IdString>,
    pub team_b_id: Option<IdString>,
    pub match_request_id: Option<IdString>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub note: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MatchRequestPatch {
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub status: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub note: PatchField<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TeamPatchRequest {
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub name: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub coach: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub coach_discord_id: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub default_from: PatchField<i32>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub default_to: PatchField<i32>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ParticipantPatchRequest {
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub status: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub team_id: PatchField<BrowserCompatIdString>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub is_bench: PatchField<bool>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub is_captain: PatchField<bool>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub notes: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub rank: PatchField<String>,
    #[serde(default, skip_serializing_if = "patch_field_omitted")]
    pub roles: PatchField<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MatchLobbyCodeRequest {
    pub lobby_code: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyMatchLobbyCodeRequest {
    #[serde(alias = "lobby_code", alias = "lobbyCode")]
    pub code: String,
}

impl LegacyMatchLobbyCodeRequest {
    fn into_canonical(self) -> MatchLobbyCodeRequest {
        MatchLobbyCodeRequest {
            lobby_code: self.code,
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MatchIdCreateRequest {
    pub match_ids: Vec<IdString>,
}

impl MatchIdCreateRequest {
    fn validate(&self) -> Result<(), AppError> {
        if self.match_ids.is_empty() {
            return Err(AppError::bad_request("match_ids must not be empty"));
        }
        Ok(())
    }
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyMatchIdCreateRequest {
    #[serde(default)]
    pub match_ids: Option<Vec<LegacyIdString>>,
    #[serde(default, alias = "steam_match_id", alias = "matchId")]
    pub match_id: Option<LegacyIdString>,
}

impl LegacyMatchIdCreateRequest {
    fn into_canonical(self) -> MatchIdCreateRequest {
        let match_ids = self
            .match_ids
            .unwrap_or_default()
            .into_iter()
            .chain(self.match_id)
            .map(LegacyIdString::into_id)
            .collect();
        MatchIdCreateRequest { match_ids }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ResultRefPatchRequest {
    pub message: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EmptyRequest {}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LagebildCorrectionRequest {
    pub message: String,
}

pub fn router() -> Router<AppState> {
    let router = mount_canonical_routes(Router::new(), "/api/scrim");
    mount_legacy_scrims_routes(router, "/api/scrims")
        .fallback(scrim_not_found)
        .layer(axum::middleware::from_fn(add_request_id_header))
}

fn mount_canonical_routes(mut router: Router<AppState>, prefix: &str) -> Router<AppState> {
    router = router
        .route(&format!("{prefix}/me"), get(get_me))
        .route(
            &format!("{prefix}/me/availability"),
            put(put_my_availability),
        )
        .route(&format!("{prefix}/signup"), post(signup))
        .route(&format!("{prefix}/command-center"), get(command_center))
        .route(&format!("{prefix}/pool"), get(pool))
        .route(&format!("{prefix}/coaches"), get(coaches))
        .route(&format!("{prefix}/teams"), get(teams).post(create_team))
        .route(&format!("{prefix}/teams/{{id}}"), patch(patch_team))
        .route(
            &format!("{prefix}/teams/{{id}}/announce"),
            post(announce_team),
        )
        .route(&format!("{prefix}/teams/{{id}}/board"), get(team_board))
        .route(
            &format!("{prefix}/teams/{{id}}/timeline"),
            get(team_timeline),
        )
        .route(
            &format!("{prefix}/teams/{{id}}/suggest"),
            post(suggest_roster),
        )
        .route(
            &format!("{prefix}/teams/{{id}}/substitute"),
            post(substitute),
        )
        .route(
            &format!("{prefix}/teams/{{id}}/lagebild/refresh"),
            post(lagebild_refresh),
        )
        .route(
            &format!("{prefix}/teams/{{id}}/lagebild/corrections"),
            post(lagebild_corrections),
        )
        .route(
            &format!("{prefix}/participants/{{id}}"),
            patch(patch_participant),
        )
        .route(
            &format!("{prefix}/participants/{{id}}/resync-discord"),
            post(resync_participant_discord),
        )
        .route(&format!("{prefix}/history"), get(history))
        .route(
            &format!("{prefix}/match-requests/defaults"),
            get(match_request_defaults),
        )
        .route(
            &format!("{prefix}/match-request-batches"),
            get(match_request_batches).post(planning_create),
        )
        .route(
            &format!("{prefix}/match-request-batches/{{id}}"),
            get(match_request_batch),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}"),
            get(match_request).patch(patch_match_request),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/status-preview"),
            get(match_request_status_preview),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/release"),
            post(match_request_release),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/reminders"),
            post(match_request_reminders),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/status-publications"),
            post(match_request_status_publication_create),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/replacement-needs"),
            get(match_request_replacement_needs),
        )
        .route(
            &format!("{prefix}/matches"),
            get(matches).post(match_create),
        )
        .route(&format!("{prefix}/matches/{{id}}"), get(match_detail))
        .route(
            &format!("{prefix}/matches/{{id}}/lobby-code"),
            put(match_lobby_code),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/match-ids"),
            post(match_id_create),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/result-fetches"),
            post(match_result_fetch),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/result-refs/{{ref_id}}"),
            patch(match_result_ref_patch),
        )
        .route(
            &format!("{prefix}/replacement-needs/{{id}}/candidates"),
            get(replacement_need_candidates),
        )
        .route(
            &format!("{prefix}/replacement-needs/{{id}}/requests"),
            post(replacement_need_request_create),
        )
        .route(
            &format!("{prefix}/replacement-requests/{{id}}"),
            patch(replacement_request_patch),
        )
        .route(
            &format!("{prefix}/blocks/{{id}}/announcement-preview"),
            get(block_announcement_preview),
        )
        .route(
            &format!("{prefix}/blocks/{{id}}/announcement-publications"),
            post(block_announcement_publication),
        )
        .route(&format!("{prefix}/actions/{{id}}"), get(action_detail));
    router
}

fn mount_legacy_scrims_routes(mut router: Router<AppState>, prefix: &str) -> Router<AppState> {
    router = router
        .route(prefix, get(legacy_overview))
        .route(
            &format!("{prefix}/match-requests/defaults"),
            get(match_request_defaults),
        )
        .route(
            &format!("{prefix}/match-requests"),
            post(legacy_planning_create),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/summary"),
            get(legacy_match_request_summary),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/release"),
            post(match_request_release),
        )
        .route(
            &format!("{prefix}/match-requests/{{id}}/reminders"),
            post(match_request_reminders),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/lobby-code"),
            post(legacy_match_lobby_code),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/match-ids"),
            post(legacy_match_id_create),
        )
        .route(
            &format!("{prefix}/matches/{{id}}/result"),
            post(legacy_match_result),
        );
    router
}

pub async fn scrim_browser_security_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    if is_scrim_path(request.uri().path()) {
        let request_id = generated_request_id();
        if let Err(err) = reject_browser_control_headers(request.headers()) {
            return error_response(err, &request_id);
        }
        if mutates(request.method()) {
            if let Err(err) = require_json_content_type(request.headers())
                .and_then(|()| require_same_origin(&state, request.headers()))
            {
                return error_response(err, &request_id);
            }
        }
    }
    next.run(request).await
}

pub async fn add_request_id_header(_request: Request<Body>, next: Next) -> Response {
    let fallback_request_id = generated_request_id();
    let mut response = next.run(_request).await;
    if !response.headers().contains_key("X-Request-Id") {
        insert_request_id(response.headers_mut(), &fallback_request_id);
    }
    response
}

pub async fn get_me(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    forward_read(
        state,
        headers,
        Some(peer),
        ProxyAuth::User,
        "/me",
        None,
        ResponseAdapter::Me,
    )
    .await
}

pub async fn put_my_availability(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    forward_json::<ProxyWeeklyAvailability>(
        state,
        headers,
        Some(peer),
        ProxyAuth::User,
        Method::PUT,
        "/me/availability",
        "PUT:/me/availability",
        body,
        &["discord_id", "discord_user_id", "user_id", "participant_id"],
        ResponseAdapter::Json,
    )
    .await
}

pub async fn signup(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    forward_json::<SignupRequest>(
        state,
        headers,
        Some(peer),
        ProxyAuth::User,
        Method::POST,
        "/signup",
        "POST:/signup",
        body,
        &["discord_id", "discord_user_id", "user_id", "participant_id"],
        ResponseAdapter::Json,
    )
    .await
}

pub async fn command_center(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    read_common_query(
        state,
        headers,
        Some(peer),
        "/command-center",
        query,
        ResponseAdapter::CommandCenter,
    )
    .await
}

pub async fn legacy_overview(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    read_common_query(
        state,
        headers,
        Some(peer),
        "/command-center",
        query,
        ResponseAdapter::LegacyOverview,
    )
    .await
}

pub async fn pool(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    let status = query.status.clone();
    read_common_query(
        state,
        headers,
        Some(peer),
        "/command-center",
        query,
        ResponseAdapter::Pool { status },
    )
    .await
}

pub async fn teams(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    forward_read(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        "/teams",
        None,
        ResponseAdapter::Teams,
    )
    .await
}

pub async fn coaches(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    forward_read(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        "/coaches",
        None,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn create_team(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    forward_json::<CreateTeamRequest>(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        Method::POST,
        "/teams",
        "POST:/teams",
        body,
        &[],
        ResponseAdapter::Json,
    )
    .await
}

pub async fn patch_team(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<TeamPatchRequest>(
        state,
        headers,
        Some(peer),
        Method::PATCH,
        "/teams",
        id,
        "",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn announce_team(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<AnnounceRequest>(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/teams",
        id,
        "announce",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn team_board(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/teams",
        id,
        "board",
        ResponseAdapter::Board,
    )
    .await
}

pub async fn team_timeline(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/teams",
        id,
        "timeline",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn suggest_roster(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<SuggestRosterRequest>(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/teams",
        id,
        "suggest",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn substitute(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<SubstituteRequest>(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/teams",
        id,
        "substitute",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn lagebild_refresh(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "team id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    ai_json::<EmptyRequest>(
        state,
        headers,
        Some(peer),
        &format!("{AI_LAGEBILDER_PREFIX}/{id}/refresh"),
        &format!("POST:/teams/{id}/lagebild/refresh"),
        body,
    )
    .await
}

pub async fn lagebild_corrections(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "team id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    ai_json::<LagebildCorrectionRequest>(
        state,
        headers,
        Some(peer),
        &format!("{AI_LAGEBILDER_PREFIX}/{id}/corrections"),
        &format!("POST:/teams/{id}/lagebild/corrections"),
        body,
    )
    .await
}

pub async fn patch_participant(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<ParticipantPatchRequest>(
        state,
        headers,
        Some(peer),
        Method::PATCH,
        "/participants",
        id,
        "",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn resync_participant_discord(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/participants",
        id,
        "resync-discord",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn history(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    read_common_query(
        state,
        headers,
        Some(peer),
        "/history",
        query,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_defaults(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    forward_read(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        "/match-requests/defaults",
        None,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_batches(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    read_common_query(
        state,
        headers,
        Some(peer),
        "/match-request-batches",
        query,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_batch(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/match-request-batches",
        id,
        "",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn legacy_match_request_summary(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/match-requests",
        id,
        "status-preview",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn planning_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let body = match parse_json_body::<PlanningCreateRequest>(&headers, &body, &[]) {
        Ok(body) => body,
        Err(err) => return error_response(err, &request_id),
    };
    if let Err(err) = body.validate() {
        return error_response(err, &request_id);
    }
    forward_serialized_json(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        ScrimUpstreamKind::Turnier,
        Method::POST,
        turnier_path("/match-request-batches", None),
        "POST:/match-request-batches",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn legacy_planning_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let body = match parse_json_body::<LegacyPlanningCreateRequest>(&headers, &body, &[]) {
        Ok(body) => match body.into_canonical() {
            Ok(body) => body,
            Err(err) => return error_response(err, &request_id),
        },
        Err(err) => return error_response(err, &request_id),
    };
    if let Err(err) = body.validate() {
        return error_response(err, &request_id);
    }
    forward_serialized_json(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        ScrimUpstreamKind::Turnier,
        Method::POST,
        turnier_path("/match-request-batches", None),
        "POST:/match-request-batches",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/match-requests",
        id,
        "",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_status_preview(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/match-requests",
        id,
        "status-preview",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn patch_match_request(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<MatchRequestPatch>(
        state,
        headers,
        Some(peer),
        Method::PATCH,
        "/match-requests",
        id,
        "",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_release(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/match-requests",
        id,
        "release",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_reminders(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/match-requests",
        id,
        "reminders",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_status_publication_create(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/match-requests",
        id,
        "status-publications",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_request_replacement_needs(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/match-requests",
        id,
        "replacement-needs",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn replacement_need_candidates(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/replacement-needs",
        id,
        "candidates",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn matches(
    State(state): State<AppState>,
    Query(query): Query<CommonQuery>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    read_common_query(
        state,
        headers,
        Some(peer),
        "/matches",
        query,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_create(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    forward_json::<MatchCreateRequest>(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        Method::POST,
        "/matches",
        "POST:/matches",
        body,
        &[],
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/matches",
        id,
        "",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_lobby_code(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_json::<MatchLobbyCodeRequest>(
        state,
        headers,
        Some(peer),
        Method::PUT,
        "/matches",
        id,
        "lobby-code",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn legacy_match_lobby_code(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "match id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let body = match parse_json_body::<LegacyMatchLobbyCodeRequest>(&headers, &body, &[]) {
        Ok(body) => body.into_canonical(),
        Err(err) => return error_response(err, &request_id),
    };
    forward_serialized_json(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        ScrimUpstreamKind::Turnier,
        Method::PUT,
        turnier_path(&format!("/matches/{id}/lobby-code"), None),
        &format!("PUT:/matches/{id}/lobby-code"),
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_id_create(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "match id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let body = match parse_json_body::<MatchIdCreateRequest>(&headers, &body, &[]) {
        Ok(body) => body,
        Err(err) => return error_response(err, &request_id),
    };
    if let Err(err) = body.validate() {
        return error_response(err, &request_id);
    }
    forward_serialized_json(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        ScrimUpstreamKind::Turnier,
        Method::POST,
        turnier_path(&format!("/matches/{id}/match-ids"), None),
        &format!("POST:/matches/{id}/match-ids"),
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn legacy_match_id_create(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "match id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let body = match parse_json_body::<LegacyMatchIdCreateRequest>(&headers, &body, &[]) {
        Ok(body) => body.into_canonical(),
        Err(err) => return error_response(err, &request_id),
    };
    if let Err(err) = body.validate() {
        return error_response(err, &request_id);
    }
    forward_serialized_json(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        ScrimUpstreamKind::Turnier,
        Method::POST,
        turnier_path(&format!("/matches/{id}/match-ids"), None),
        &format!("POST:/matches/{id}/match-ids"),
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_result_ref_patch(
    State(state): State<AppState>,
    Path((id, ref_id)): Path<(String, String)>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "match id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let ref_id = match safe_path_id(&ref_id, "result ref id") {
        Ok(ref_id) => ref_id,
        Err(err) => return error_response(err, &request_id),
    };
    forward_json::<ResultRefPatchRequest>(
        state,
        headers,
        Some(peer),
        ProxyAuth::Coach,
        Method::PATCH,
        &format!("/matches/{id}/result-refs/{ref_id}"),
        &format!("PATCH:/matches/{id}/result-refs/{ref_id}"),
        body,
        &[],
        ResponseAdapter::Json,
    )
    .await
}

pub async fn match_result_fetch(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/matches",
        id,
        "result-fetches",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn legacy_match_result(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/matches",
        id,
        "result-fetches",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn replacement_need_request_create(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/replacement-needs",
        id,
        "requests",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn replacement_request_patch(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::PATCH,
        "/replacement-requests",
        id,
        "",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn block_announcement_preview(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/blocks",
        id,
        "announcement-preview",
        ResponseAdapter::Json,
    )
    .await
}

pub async fn block_announcement_publication(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    body: Bytes,
) -> Response {
    id_capability_json(
        state,
        headers,
        Some(peer),
        Method::POST,
        "/blocks",
        id,
        "announcement-publications",
        body,
        ResponseAdapter::Json,
    )
    .await
}

pub async fn action_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> Response {
    id_read(
        state,
        headers,
        Some(peer),
        "/actions",
        id,
        "",
        ResponseAdapter::Json,
    )
    .await
}

async fn id_read(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    prefix: &str,
    id: String,
    suffix: &str,
    adapter: ResponseAdapter,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    forward_read(
        state,
        headers,
        peer,
        ProxyAuth::Coach,
        &joined_id_path(prefix, &id, suffix),
        None,
        adapter,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "explicit route matrix keeps id, method, and typed body visible"
)]
async fn id_json<T>(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    method: Method,
    prefix: &str,
    id: String,
    suffix: &str,
    body: Bytes,
    adapter: ResponseAdapter,
) -> Response
where
    T: DeserializeOwned + Serialize,
{
    let request_id = request_id();
    let id = match safe_path_id(&id, "id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let path = joined_id_path(prefix, &id, suffix);
    let route_key = format!("{}:{path}", method.as_str());
    forward_json::<T>(
        state,
        headers,
        peer,
        ProxyAuth::Coach,
        method,
        &path,
        &route_key,
        body,
        &[],
        adapter,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "explicit route matrix keeps id, method, and capability body forwarding visible"
)]
async fn id_capability_json(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    method: Method,
    prefix: &str,
    id: String,
    suffix: &str,
    body: Bytes,
    adapter: ResponseAdapter,
) -> Response {
    let request_id = request_id();
    let id = match safe_path_id(&id, "id") {
        Ok(id) => id,
        Err(err) => return error_response(err, &request_id),
    };
    let path = joined_id_path(prefix, &id, suffix);
    let route_key = format!("{}:{path}", method.as_str());
    forward_raw_json(
        state,
        headers,
        peer,
        ProxyAuth::Coach,
        method,
        &path,
        &route_key,
        body,
        &[],
        adapter,
    )
    .await
}

async fn read_common_query(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    suffix: &str,
    query: CommonQuery,
    adapter: ResponseAdapter,
) -> Response {
    let request_id = request_id();
    let query = match common_query_string(query) {
        Ok(query) => query,
        Err(err) => return error_response(err, &request_id),
    };
    forward_read(
        state,
        headers,
        peer,
        ProxyAuth::Coach,
        suffix,
        query,
        adapter,
    )
    .await
}

async fn forward_read(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    auth: ProxyAuth,
    suffix: &str,
    query: Option<String>,
    adapter: ResponseAdapter,
) -> Response {
    let request_id = request_id();
    let actor = match authenticate(&state, &headers, peer, auth).await {
        Ok(actor) => actor,
        Err(err) => return error_response(err, &request_id),
    };
    let route_key = format!("GET:{suffix}");
    forward_upstream(
        state,
        ScrimUpstreamKind::Turnier,
        Method::GET,
        turnier_path(suffix, query.as_deref()),
        &route_key,
        None,
        actor,
        request_id,
        None,
        adapter,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "explicit route matrix keeps auth, method, route key, and typed body visible"
)]
async fn forward_json<T>(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    auth: ProxyAuth,
    method: Method,
    suffix: &str,
    route_key: &str,
    body: Bytes,
    extra_forbidden_fields: &[&str],
    adapter: ResponseAdapter,
) -> Response
where
    T: DeserializeOwned + Serialize,
{
    let request_id = request_id();
    let body = match parse_json_body::<T>(&headers, &body, extra_forbidden_fields) {
        Ok(body) => body,
        Err(err) => return error_response(err, &request_id),
    };
    forward_serialized_json(
        state,
        headers,
        peer,
        auth,
        ScrimUpstreamKind::Turnier,
        method,
        turnier_path(suffix, None),
        route_key,
        body,
        adapter,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "capability routes must preserve upstream 501 semantics before local DTO shape checks"
)]
async fn forward_raw_json(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    auth: ProxyAuth,
    method: Method,
    suffix: &str,
    route_key: &str,
    body: Bytes,
    extra_forbidden_fields: &[&str],
    adapter: ResponseAdapter,
) -> Response {
    let request_id = request_id();
    let body = match parse_raw_json_body(&headers, &body, extra_forbidden_fields) {
        Ok(body) => body,
        Err(err) => return error_response(err, &request_id),
    };
    forward_serialized_json(
        state,
        headers,
        peer,
        auth,
        ScrimUpstreamKind::Turnier,
        method,
        turnier_path(suffix, None),
        route_key,
        body,
        adapter,
    )
    .await
}

async fn ai_json<T>(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    upstream_path: &str,
    route_key: &str,
    body: Bytes,
) -> Response
where
    T: DeserializeOwned + Serialize,
{
    let request_id = request_id();
    let body = match parse_json_body::<T>(&headers, &body, &[]) {
        Ok(body) => body,
        Err(err) => return error_response(err, &request_id),
    };
    forward_serialized_json(
        state,
        headers,
        peer,
        ProxyAuth::Coach,
        ScrimUpstreamKind::Ai,
        Method::POST,
        upstream_path.to_string(),
        route_key,
        body,
        ResponseAdapter::Json,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "serialized internal calls keep route key, upstream kind, and method explicit"
)]
async fn forward_serialized_json<T>(
    state: AppState,
    headers: HeaderMap,
    peer: Option<SocketAddr>,
    auth: ProxyAuth,
    kind: ScrimUpstreamKind,
    method: Method,
    upstream_path: String,
    route_key: &str,
    body: T,
    adapter: ResponseAdapter,
) -> Response
where
    T: Serialize,
{
    let request_id = request_id();
    if let Err(err) = require_mutation_security(&state, &headers) {
        return error_response(err, &request_id);
    }
    let actor = match authenticate(&state, &headers, peer, auth).await {
        Ok(actor) => actor,
        Err(err) => return error_response(err, &request_id),
    };
    let body = match serde_json::to_vec(&body) {
        Ok(body) if body.len() <= SCRIM_PROXY_MAX_REQUEST_BYTES => body,
        Ok(_) => {
            return error_response(
                AppError::http(
                    StatusCode::PAYLOAD_TOO_LARGE,
                    "Scrim request body is too large",
                ),
                &request_id,
            )
        }
        Err(err) => return error_response(AppError::Json(err), &request_id),
    };
    let idempotency_key = idempotency_key(&request_id);
    forward_upstream(
        state,
        kind,
        method,
        upstream_path,
        route_key,
        Some(body),
        actor,
        request_id,
        Some(idempotency_key),
        adapter,
    )
    .await
}

#[expect(
    clippy::too_many_arguments,
    reason = "upstream request construction keeps security-sensitive fields explicit"
)]
async fn forward_upstream(
    state: AppState,
    kind: ScrimUpstreamKind,
    method: Method,
    path_and_query: String,
    route_key: &str,
    body: Option<Vec<u8>>,
    actor: ScrimActorAssertion,
    request_id: String,
    idempotency_key: Option<String>,
    adapter: ResponseAdapter,
) -> Response {
    if state.cfg.scrim_backend_mode == ScrimBackendMode::Maintenance {
        return service_unavailable_response(&request_id);
    }
    let request = ScrimUpstreamRequest {
        kind,
        method,
        path_and_query,
        body,
        actor,
        request_id: request_id.clone(),
        idempotency_key,
    };
    match ScrimUpstreamClient::new(&state.cfg, &state.scrim_http)
        .send(request)
        .await
    {
        Ok(response) if browser_status_is_preserved(response.status) => {
            adapted_upstream_response(response, &request_id, adapter)
        }
        Ok(response) => {
            tracing::warn!(
                request_id = %request_id,
                route = route_key,
                class = "upstream_status",
                status = response.status.as_u16(),
                "Scrim-BFF-Upstream-Status wird nicht an Browser durchgereicht"
            );
            service_unavailable_response(&request_id)
        }
        Err(err) => {
            tracing::warn!(
                request_id = %request_id,
                route = route_key,
                class = err.class(),
                "Scrim-BFF-Upstream-Fehler"
            );
            upstream_error_response(err, &request_id)
        }
    }
}

fn adapted_upstream_response(
    response: ScrimUpstreamResponse,
    request_id: &str,
    adapter: ResponseAdapter,
) -> Response {
    if !response.status.is_success() {
        return upstream_response_to_browser(response, request_id);
    }
    let value = if response.body.is_empty() {
        Value::Null
    } else {
        match serde_json::from_slice::<Value>(&response.body) {
            Ok(value) => value,
            Err(err) => {
                tracing::warn!(%err, request_id = %request_id, "Scrim-Upstream lieferte ungueltiges JSON");
                return upstream_bad_gateway_response(request_id);
            }
        }
    };
    let adapted = match adapter {
        ResponseAdapter::Json => Ok(value),
        ResponseAdapter::CommandCenter => adapt_command_center(value),
        ResponseAdapter::Me => adapt_me(value),
        ResponseAdapter::Pool { status } => adapt_pool(value, status.as_deref()),
        ResponseAdapter::Teams => adapt_teams(value),
        ResponseAdapter::Board => adapt_board(value),
        ResponseAdapter::LegacyOverview => adapt_legacy_overview(value),
    };
    match adapted {
        Ok(adapted) => json_response(response.status, request_id, adapted),
        Err(err) => {
            tracing::warn!(request_id = %request_id, %err, "Scrim-Upstream-Shape passt nicht zum BFF-Vertrag");
            upstream_bad_gateway_response(request_id)
        }
    }
}

async fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
    auth: ProxyAuth,
) -> Result<ScrimActorAssertion, AppError> {
    let user = auth::require_authenticated_user(state, headers, peer).await?;
    if auth::parse_discord_user_id(&user.sub).is_err() {
        return Err(AppError::forbidden("Scrim requires Discord user login"));
    }
    if auth == ProxyAuth::Coach
        && !auth::is_active_coach(state, &user.sub)
            .await
            .unwrap_or(false)
    {
        return Err(AppError::forbidden("Coach only"));
    }
    Ok(ScrimActorAssertion::from_user(&user))
}

fn parse_json_body<T>(
    headers: &HeaderMap,
    body: &Bytes,
    extra_forbidden_fields: &[&str],
) -> Result<T, AppError>
where
    T: DeserializeOwned + Serialize,
{
    if body.len() > SCRIM_PROXY_MAX_REQUEST_BYTES {
        return Err(AppError::http(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Scrim request body is too large",
        ));
    }
    require_json_content_type(headers)?;
    let effective = if body.is_empty() {
        EMPTY_OBJECT.to_string().into_bytes()
    } else {
        body.to_vec()
    };
    let value: Value = serde_json::from_slice(&effective)?;
    reject_browser_actor_fields(&value, extra_forbidden_fields)?;
    let parsed: T = serde_json::from_value(value)?;
    Ok(parsed)
}

fn parse_raw_json_body(
    headers: &HeaderMap,
    body: &Bytes,
    extra_forbidden_fields: &[&str],
) -> Result<Value, AppError> {
    if body.len() > SCRIM_PROXY_MAX_REQUEST_BYTES {
        return Err(AppError::http(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Scrim request body is too large",
        ));
    }
    require_json_content_type(headers)?;
    let effective = if body.is_empty() {
        EMPTY_OBJECT.to_string().into_bytes()
    } else {
        body.to_vec()
    };
    let value: Value = serde_json::from_slice(&effective)?;
    reject_browser_actor_fields(&value, extra_forbidden_fields)?;
    Ok(value)
}

fn require_mutation_security(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    reject_browser_control_headers(headers)?;
    require_same_origin(state, headers)
}

fn require_json_content_type(headers: &HeaderMap) -> Result<(), AppError> {
    let Some(value) = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
    else {
        return Err(AppError::http(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Scrim mutations require application/json",
        ));
    };
    let essence = value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if essence == "application/json" || essence.ends_with("+json") {
        Ok(())
    } else {
        Err(AppError::http(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Scrim mutations require application/json",
        ))
    }
}

fn reject_browser_control_headers(headers: &HeaderMap) -> Result<(), AppError> {
    for name in [
        "x-actor-discord-id",
        "x-actor-display-name",
        "x-ddc-actor",
        "x-ddc-actor-user-id",
        "x-ddc-actor-display-name",
        "x-request-id",
        "idempotency-key",
        "x-idempotency-key",
    ] {
        if headers.contains_key(name) {
            return Err(AppError::bad_request(
                "Scrim control headers are generated by the server",
            ));
        }
    }
    Ok(())
}

fn reject_browser_actor_fields(
    value: &Value,
    extra_forbidden_fields: &[&str],
) -> Result<(), AppError> {
    let Some(object) = value.as_object() else {
        return Ok(());
    };
    let forbidden = [
        "actor",
        "actor_id",
        "actorId",
        "actor_user_id",
        "actorUserId",
        "source_user_id",
        "sourceUserId",
        "released_by_user_id",
        "releasedByUserId",
        "force",
        "force_create",
        "forceCreate",
        "force_publish",
        "forcePublish",
        "privileged",
        "admin",
        "as_admin",
        "asAdmin",
    ];
    if forbidden
        .iter()
        .chain(extra_forbidden_fields.iter())
        .any(|field| object.contains_key(*field))
    {
        return Err(AppError::bad_request(
            "Actor fields are generated by the server",
        ));
    }
    Ok(())
}

fn require_same_origin(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let Some(origin) = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
    else {
        return Err(AppError::bad_request("Scrim mutations require Origin"));
    };
    let host = direct_host_with_port(headers);
    if host.is_empty() || !origin_matches_host(&state.cfg.ddc_cookie_domain, origin, &host) {
        return Err(AppError::forbidden("Scrim mutation origin is not allowed"));
    }
    Ok(())
}

fn origin_matches_host(configured_domain: &str, origin: &str, host_header: &str) -> bool {
    let Ok(url) = url::Url::parse(origin) else {
        return false;
    };
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return false;
    }
    let Some(origin_host) = url.host_str().map(|value| value.to_ascii_lowercase()) else {
        return false;
    };
    let host_header = host_header.to_ascii_lowercase();
    let host_without_port = host_name_from_host(&host_header);
    if origin_host != host_without_port {
        return false;
    }
    if !allowed_same_origin_host(configured_domain, &origin_host) {
        return false;
    }
    let origin_port = url.port();
    let host_port = port_from_host(&host_header);
    if origin_port != host_port {
        return false;
    }
    matches!(url.scheme(), "https") || is_local_host(&origin_host) && url.scheme() == "http"
}

fn allowed_same_origin_host(configured_domain: &str, host: &str) -> bool {
    host == configured_domain || host == format!("www.{configured_domain}") || is_local_host(host)
}

fn is_local_host(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

fn request_id() -> String {
    generated_request_id()
}

fn validate_slots(slots: &[PlanningSlot]) -> Result<(), AppError> {
    if !(2..=5).contains(&slots.len()) {
        return Err(AppError::bad_request("Each pairing needs 2-5 slots"));
    }
    for slot in slots {
        if slot.from_minute > 1440 || slot.to_minute > 1440 || slot.from_minute >= slot.to_minute {
            return Err(AppError::bad_request("slot time range is invalid"));
        }
    }
    Ok(())
}

fn validate_small_label(value: &str, name: &str) -> Result<(), AppError> {
    if value.trim().is_empty() || !valid_query_value(value) {
        return Err(AppError::bad_request(format!("Invalid {name}")));
    }
    Ok(())
}

fn browser_status_is_preserved(status: StatusCode) -> bool {
    status.is_success()
        || matches!(
            status,
            StatusCode::BAD_REQUEST
                | StatusCode::FORBIDDEN
                | StatusCode::NOT_FOUND
                | StatusCode::METHOD_NOT_ALLOWED
                | StatusCode::CONFLICT
                | StatusCode::PAYLOAD_TOO_LARGE
                | StatusCode::UNPROCESSABLE_ENTITY
                | StatusCode::TOO_MANY_REQUESTS
                | StatusCode::NOT_IMPLEMENTED
        )
}

fn mutates(method: &Method) -> bool {
    matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    )
}

fn is_scrim_path(path: &str) -> bool {
    path == "/api/scrim"
        || path.starts_with("/api/scrim/")
        || path == "/api/scrims"
        || path.starts_with("/api/scrims/")
}

fn turnier_path(suffix: &str, query: Option<&str>) -> String {
    let mut path = format!("{TURNIER_PREFIX}{suffix}");
    if let Some(query) = query.filter(|query| !query.is_empty()) {
        path.push('?');
        path.push_str(query);
    }
    path
}

fn common_query_string(query: CommonQuery) -> Result<Option<String>, AppError> {
    let team_id = query
        .team_id
        .map(|id| safe_query_id(&id, "team id"))
        .transpose()?;
    let match_id = query
        .match_id
        .map(|id| safe_query_id(&id, "match id"))
        .transpose()?;
    query_string(&[
        ("status", query.status),
        ("team_id", team_id),
        ("match_id", match_id),
        (
            "limit",
            query.limit.map(|limit| limit.clamp(1, 200).to_string()),
        ),
    ])
}

fn query_string(pairs: &[(&str, Option<String>)]) -> Result<Option<String>, AppError> {
    let mut serializer = form_urlencoded::Serializer::new(String::new());
    let mut has_value = false;
    for (key, value) in pairs {
        let Some(value) = value.as_deref() else {
            continue;
        };
        if !valid_query_value(value) {
            return Err(AppError::bad_request("Invalid scrim query value"));
        }
        serializer.append_pair(key, value);
        has_value = true;
    }
    Ok(has_value.then(|| serializer.finish()))
}

fn valid_query_value(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':' | b',')
        })
}

fn safe_query_id(value: &str, name: &str) -> Result<String, AppError> {
    safe_id(value, name)
}

fn safe_path_id(value: &str, name: &str) -> Result<String, AppError> {
    safe_id(value, name)
}

fn safe_id(value: &str, name: &str) -> Result<String, AppError> {
    let value = value.trim();
    if !valid_id(value) {
        return Err(AppError::bad_request(format!("Invalid {name}")));
    }
    Ok(value.to_string())
}

fn valid_id(value: &str) -> bool {
    positive_decimal_id(value)
}

fn positive_decimal_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 20
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && value
            .trim_start_matches('0')
            .parse::<u64>()
            .ok()
            .is_some_and(|id| id > 0)
}

fn joined_id_path(prefix: &str, id: &str, suffix: &str) -> String {
    if suffix.is_empty() {
        format!("{prefix}/{id}")
    } else {
        format!("{prefix}/{id}/{suffix}")
    }
}

fn direct_host_with_port(headers: &HeaderMap) -> String {
    headers
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .split(',')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

fn port_from_host(host: &str) -> Option<u16> {
    if host.starts_with('[') {
        return host
            .split_once(']')
            .and_then(|(_, rest)| rest.strip_prefix(':'))
            .and_then(|port| port.parse().ok());
    }
    if host.matches(':').count() == 1 {
        return host
            .rsplit_once(':')
            .and_then(|(_, port)| port.parse().ok());
    }
    None
}

fn host_name_from_host(host: &str) -> String {
    if let Some(stripped) = host.strip_prefix('[') {
        return stripped.split(']').next().unwrap_or(stripped).to_string();
    }
    if host.matches(':').count() == 1 {
        host.rsplit_once(':')
            .map(|(host, _)| host)
            .unwrap_or(host)
            .to_string()
    } else {
        host.to_string()
    }
}

fn adapt_command_center(value: Value) -> Result<Value, String> {
    let participants = required_array(&value, "participants")?;
    let teams = required_array(&value, "teams")?;
    let operational_matches = required_array(&value, "matches")?;
    let batches = required_array(&value, "match_request_batches")?;
    let lagebild_refs = required_array(&value, "lagebild_refs")?;
    let attention = derive_attention(&batches, &operational_matches);
    let timeline = derive_timeline(&lagebild_refs, &operational_matches);
    Ok(json!({
        "attention": attention,
        "participants": participants,
        "teams": teams,
        "matches": batches,
        "match_request_batches": batches,
        "operational_matches": operational_matches,
        "timeline": timeline,
        "lagebild_refs": lagebild_refs,
    }))
}

fn adapt_legacy_overview(value: Value) -> Result<Value, String> {
    let teams = required_array(&value, "teams")?;
    let operational_matches = required_array(&value, "matches")?;
    let batches = required_array(&value, "match_request_batches")?;
    let lagebild_refs = required_array(&value, "lagebild_refs")?;
    Ok(json!({
        "teams": teams,
        "matches": operational_matches,
        "match_request_summaries": batches,
        "lagebilder": lagebild_refs,
        "suggested_block": value_by_keys(&value, &["suggested_block"]).unwrap_or(Value::Null),
    }))
}

fn adapt_me(value: Value) -> Result<Value, String> {
    let participant = value_by_keys(&value, &["participant", "me", "user"])
        .map(|participant| adapt_participant(&participant))
        .transpose()?
        .unwrap_or(Value::Null);
    let mut team = value_by_keys(&value, &["team"]).unwrap_or(Value::Null);
    let team_id = id_string(&team, "id");
    let members = raw_members(&value, &mut team)?
        .iter()
        .map(adapt_team_member_summary)
        .collect::<Result<Vec<_>, _>>()?;
    let team = if team.is_null() {
        Value::Null
    } else {
        adapt_team(&team)?
    };
    let next_match = adapt_next_match(
        value_by_keys(&value, &["next_match", "nextMatch"]),
        team_id.as_deref(),
    )?;
    Ok(json!({
        "participant": participant,
        "team": team,
        "members": members,
        "next_match": next_match,
    }))
}

fn adapt_pool(value: Value, status: Option<&str>) -> Result<Value, String> {
    let participants = array_or_key(&value, "participants")?;
    let memberships = if value.is_array() {
        HashMap::new()
    } else {
        let teams = value.get("teams").cloned().unwrap_or_else(|| json!([]));
        memberships_by_participant(&teams)?
    };
    participants
        .iter()
        .filter(|participant| participant_matches_status(participant, status))
        .map(|participant| {
            let membership = id_string(participant, "id").and_then(|id| memberships.get(&id));
            let fallback_team = participant.get("team").filter(|team| !team.is_null());
            let (team, member) = membership
                .map(|(team, member)| (Some(team), Some(member)))
                .unwrap_or((fallback_team, Some(participant)));
            adapt_pool_participant(participant, team, member)
        })
        .collect::<Result<Vec<_>, _>>()
        .map(Value::Array)
}

fn participant_matches_status(participant: &Value, status: Option<&str>) -> bool {
    status.is_none_or(|status| participant.get("status").and_then(Value::as_str) == Some(status))
}

fn adapt_teams(value: Value) -> Result<Value, String> {
    array_or_key(&value, "teams")?
        .iter()
        .map(adapt_team)
        .collect::<Result<Vec<_>, _>>()
        .map(Value::Array)
}

fn adapt_board(value: Value) -> Result<Value, String> {
    let mut team = value_by_keys(&value, &["team"]).ok_or_else(|| "missing team".to_string())?;
    let members = raw_members(&value, &mut team)?
        .iter()
        .map(adapt_board_member)
        .collect::<Result<Vec<_>, _>>()?;
    let overlap = weekly_overlap(&members)?;
    Ok(json!({
        "team": adapt_team(&team)?,
        "members": members,
        "overlap": overlap,
    }))
}

fn adapt_participant(value: &Value) -> Result<Value, String> {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(required_domain_id(value, "id")?));
    for key in [
        "display_name",
        "rank",
        "roles",
        "availability",
        "status",
        "source",
    ] {
        object.insert(key.to_string(), optional_field(value, key));
    }
    object.insert(
        "availability_slots".to_string(),
        normalize_weekly_availability(value.get("availability_slots"))?,
    );
    object.insert(
        "availability_confirmed".to_string(),
        json!(has_structured_availability(value)),
    );
    Ok(Value::Object(object))
}

fn adapt_pool_participant(
    participant: &Value,
    team: Option<&Value>,
    member: Option<&Value>,
) -> Result<Value, String> {
    let mut object = into_object(adapt_participant(participant)?)?;
    let discord_id = participant
        .get("discord_id")
        .or_else(|| member.and_then(|member| member.get("discord_id")));
    object.insert(
        "discord_linked".to_string(),
        json!(non_empty_string(discord_id)),
    );
    object.insert(
        "notes".to_string(),
        optional_field_from(participant, member, "notes"),
    );
    object.insert(
        "team".to_string(),
        team.map(adapt_team).transpose()?.unwrap_or(Value::Null),
    );
    object.insert(
        "role".to_string(),
        optional_field_from_member(member, "role"),
    );
    object.insert(
        "is_captain".to_string(),
        json!(member_bool(member, "is_captain")),
    );
    object.insert(
        "is_bench".to_string(),
        json!(member_bool(member, "is_bench")),
    );
    Ok(Value::Object(object))
}

fn adapt_team(value: &Value) -> Result<Value, String> {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(required_domain_id(value, "id")?));
    for key in ["name", "coach", "default_from", "default_to"] {
        object.insert(key.to_string(), optional_field(value, key));
    }
    for key in ["coach_discord_id", "discord_role_id", "discord_channel_id"] {
        object.insert(key.to_string(), optional_snowflake(value, key)?);
    }
    Ok(Value::Object(object))
}

fn adapt_team_member_summary(value: &Value) -> Result<Value, String> {
    Ok(json!({
        "participant_id": required_domain_id(value, "participant_id")?,
        "display_name": optional_field(value, "display_name"),
        "role": optional_field(value, "role"),
        "is_captain": value.get("is_captain").and_then(Value::as_bool).unwrap_or(false),
        "is_bench": value.get("is_bench").and_then(Value::as_bool).unwrap_or(false),
    }))
}

fn adapt_board_member(value: &Value) -> Result<Value, String> {
    Ok(json!({
        "participant_id": required_domain_id(value, "participant_id")?,
        "display_name": optional_field(value, "display_name"),
        "rank": optional_field(value, "rank"),
        "roles": optional_field(value, "roles"),
        "is_captain": value.get("is_captain").and_then(Value::as_bool).unwrap_or(false),
        "is_bench": value.get("is_bench").and_then(Value::as_bool).unwrap_or(false),
        "discord_linked": non_empty_string(value.get("discord_id")),
        "availability_confirmed": has_structured_availability(value),
        "availability": normalize_weekly_availability(value.get("availability_slots"))?,
        "notes": optional_field(value, "notes"),
    }))
}

fn adapt_next_match(value: Option<Value>, team_id: Option<&str>) -> Result<Value, String> {
    let Some(value) = value.filter(|value| !value.is_null()) else {
        return Ok(Value::Null);
    };
    Ok(json!({
        "id": required_domain_id(&value, "id")?,
        "opponent_team_name": value_by_keys(&value, &["opponent_team_name", "opponentTeamName"])
            .unwrap_or_else(|| derive_opponent_team_name(&value, team_id)),
        "when_text": value_by_keys(&value, &["when_text", "whenText"]).unwrap_or(Value::Null),
        "scheduled_at": optional_field(&value, "scheduled_at"),
        "status": optional_field(&value, "status"),
    }))
}

fn derive_opponent_team_name(value: &Value, team_id: Option<&str>) -> Value {
    let Some(team_id) = team_id else {
        return Value::Null;
    };
    let team_a = value.get("team_a").or_else(|| value.get("teamA"));
    let team_b = value.get("team_b").or_else(|| value.get("teamB"));
    match (team_a, team_b) {
        (Some(team_a), Some(team_b)) if id_string(team_a, "id").as_deref() == Some(team_id) => {
            optional_field(team_b, "name")
        }
        (Some(team_a), Some(team_b)) if id_string(team_b, "id").as_deref() == Some(team_id) => {
            optional_field(team_a, "name")
        }
        _ => Value::Null,
    }
}

fn array_or_key(value: &Value, key: &str) -> Result<Vec<Value>, String> {
    let array = if value.is_array() {
        value.clone()
    } else {
        required_array(value, key)?
    };
    array
        .as_array()
        .cloned()
        .ok_or_else(|| format!("missing array field: {key}"))
}

fn raw_members(value: &Value, team: &mut Value) -> Result<Vec<Value>, String> {
    if let Some(members) = value.get("members") {
        return members
            .as_array()
            .cloned()
            .ok_or_else(|| "members must be an array".to_string());
    }
    if let Some(team_object) = team.as_object_mut() {
        if let Some(members) = team_object.remove("members") {
            return members
                .as_array()
                .cloned()
                .ok_or_else(|| "team.members must be an array".to_string());
        }
    }
    Ok(Vec::new())
}

fn memberships_by_participant(teams: &Value) -> Result<HashMap<String, (Value, Value)>, String> {
    let mut memberships = HashMap::new();
    for team in teams
        .as_array()
        .ok_or_else(|| "teams must be an array".to_string())?
    {
        let Some(members) = team.get("members") else {
            continue;
        };
        for member in members
            .as_array()
            .ok_or_else(|| "team.members must be an array".to_string())?
        {
            if let Some(participant_id) = id_string(member, "participant_id") {
                memberships
                    .entry(participant_id)
                    .or_insert_with(|| (team.clone(), member.clone()));
            }
        }
    }
    Ok(memberships)
}

fn normalize_weekly_availability(raw: Option<&Value>) -> Result<Value, String> {
    let Some(Value::Object(slots)) = raw else {
        return Ok(unknown_weekly_availability());
    };
    let mut normalized = serde_json::Map::new();
    for day in WEEKDAYS {
        let slot = slots
            .get(day)
            .map(normalize_day_slot)
            .transpose()?
            .unwrap_or_else(unknown_day_slot);
        normalized.insert(day.to_string(), slot);
    }
    Ok(Value::Object(normalized))
}

fn normalize_day_slot(raw: &Value) -> Result<Value, String> {
    let object = raw
        .as_object()
        .ok_or_else(|| "availability day slot must be an object".to_string())?;
    let status = object
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_ascii_lowercase();
    let (status, from, to) = match status.as_str() {
        "available" => {
            let from = optional_minute(object.get("from"))?;
            let to = optional_minute(object.get("to"))?;
            if matches!((from, to), (Some(from), Some(to)) if from >= to) {
                return Err("available slot has invalid time range".to_string());
            }
            (
                "available",
                from.map(Value::from).unwrap_or(Value::Null),
                to.map(Value::from).unwrap_or(Value::Null),
            )
        }
        "unavailable" => ("unavailable", Value::Null, Value::Null),
        "unknown" => ("unknown", Value::Null, Value::Null),
        _ => return Err("availability day slot has invalid status".to_string()),
    };
    Ok(json!({ "status": status, "from": from, "to": to }))
}

fn unknown_weekly_availability() -> Value {
    let mut week = serde_json::Map::new();
    for day in WEEKDAYS {
        week.insert(day.to_string(), unknown_day_slot());
    }
    Value::Object(week)
}

fn unknown_day_slot() -> Value {
    json!({ "status": "unknown", "from": null, "to": null })
}

fn weekly_overlap(members: &[Value]) -> Result<Value, String> {
    let mut overlap = serde_json::Map::new();
    for day in WEEKDAYS {
        overlap.insert(day.to_string(), day_overlap(members, day)?);
    }
    Ok(Value::Object(overlap))
}

fn day_overlap(members: &[Value], day: &str) -> Result<Value, String> {
    let mut available = 0_u32;
    let mut unavailable = 0_u32;
    let mut unknown = 0_u32;
    let mut unavailable_ids = Vec::new();
    let mut unknown_ids = Vec::new();
    let mut window_from = 0_u16;
    let mut window_to = 1440_u16;
    let mut counted_members = 0_u32;

    for member in members {
        if member
            .get("is_bench")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            continue;
        }
        counted_members += 1;
        let participant_id = required_domain_id(member, "participant_id")?;
        let slot = member
            .get("availability")
            .and_then(|availability| availability.get(day))
            .ok_or_else(|| "member availability is incomplete".to_string())?;
        match slot
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
        {
            "available" => {
                available += 1;
                window_from = window_from.max(slot.get("from").and_then(value_u16).unwrap_or(0));
                window_to = window_to.min(slot.get("to").and_then(value_u16).unwrap_or(1440));
            }
            "unavailable" => {
                unavailable += 1;
                unavailable_ids.push(json!(participant_id));
            }
            "unknown" => {
                unknown += 1;
                unknown_ids.push(json!(participant_id));
            }
            _ => return Err("member availability has invalid status".to_string()),
        }
    }

    let has_window = available >= 1 && window_from < window_to;
    Ok(json!({
        "available": available,
        "unavailable": unavailable,
        "unknown": unknown,
        "window_from": has_window.then_some(window_from),
        "window_to": has_window.then_some(window_to),
        "full_squad": available == counted_members && has_window,
        "unavailable_ids": unavailable_ids,
        "unknown_ids": unknown_ids,
    }))
}

fn optional_minute(value: Option<&Value>) -> Result<Option<u16>, String> {
    let Some(value) = value.filter(|value| !value.is_null()) else {
        return Ok(None);
    };
    value_u16(value)
        .filter(|minute| *minute <= 1440)
        .map(Some)
        .ok_or_else(|| "minute must be an integer between 0 and 1440".to_string())
}

fn value_u16(value: &Value) -> Option<u16> {
    value.as_u64().and_then(|value| u16::try_from(value).ok())
}

fn required_domain_id(value: &Value, key: &str) -> Result<i32, String> {
    let raw = value
        .get(key)
        .ok_or_else(|| format!("missing id field: {key}"))?;
    let id = match raw {
        Value::String(value) if positive_decimal_id(value.trim()) => value
            .trim()
            .parse::<i64>()
            .map_err(|_| format!("invalid id field: {key}"))?,
        Value::Number(value) => value
            .as_i64()
            .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
            .ok_or_else(|| format!("invalid id field: {key}"))?,
        _ => return Err(format!("invalid id field: {key}")),
    };
    if (1..=i64::from(i32::MAX)).contains(&id) {
        Ok(id as i32)
    } else {
        Err(format!("id field out of browser range: {key}"))
    }
}

fn id_string(value: &Value, key: &str) -> Option<String> {
    let raw = value.get(key)?;
    match raw {
        Value::String(value) if positive_decimal_id(value.trim()) => Some(value.trim().to_string()),
        Value::Number(value) => value
            .as_u64()
            .filter(|value| *value > 0)
            .map(|value| value.to_string()),
        _ => None,
    }
}

fn optional_field(value: &Value, key: &str) -> Value {
    value.get(key).cloned().unwrap_or(Value::Null)
}

fn optional_field_from(primary: &Value, fallback: Option<&Value>, key: &str) -> Value {
    primary
        .get(key)
        .filter(|value| !value.is_null())
        .cloned()
        .or_else(|| fallback.and_then(|value| value.get(key)).cloned())
        .unwrap_or(Value::Null)
}

fn optional_field_from_member(member: Option<&Value>, key: &str) -> Value {
    member
        .and_then(|member| member.get(key))
        .cloned()
        .unwrap_or(Value::Null)
}

fn optional_snowflake(value: &Value, key: &str) -> Result<Value, String> {
    let Some(raw) = value.get(key).filter(|value| !value.is_null()) else {
        return Ok(Value::Null);
    };
    match raw {
        Value::String(value) => Ok(Value::String(value.clone())),
        Value::Number(value) => Ok(Value::String(value.to_string())),
        _ => Err(format!("invalid snowflake field: {key}")),
    }
}

fn has_structured_availability(value: &Value) -> bool {
    value
        .get("availability_slots")
        .is_some_and(|value| value.is_object())
}

fn non_empty_string(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

fn member_bool(member: Option<&Value>, key: &str) -> bool {
    member
        .and_then(|member| member.get(key))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn into_object(value: Value) -> Result<serde_json::Map<String, Value>, String> {
    match value {
        Value::Object(object) => Ok(object),
        _ => Err("expected object".to_string()),
    }
}

fn required_array(value: &Value, key: &str) -> Result<Value, String> {
    value
        .get(key)
        .filter(|candidate| candidate.is_array())
        .cloned()
        .ok_or_else(|| format!("missing array field: {key}"))
}

fn derive_timeline(lagebild_refs: &Value, operational_matches: &Value) -> Value {
    let mut items = Vec::new();
    if let Some(refs) = lagebild_refs.as_array() {
        items.extend(refs.iter().map(|entry| {
            json!({
                "kind": "lagebild_ref",
                "lagebild_ref": entry,
            })
        }));
    }
    if let Some(matches) = operational_matches.as_array() {
        items.extend(matches.iter().map(|entry| {
            json!({
                "kind": "operational_match",
                "match": entry,
            })
        }));
    }
    Value::Array(items)
}

fn derive_attention(batches: &Value, operational_matches: &Value) -> Value {
    let mut attention = Vec::new();
    collect_attention("match_request_batch", batches, &mut attention);
    collect_attention("operational_match", operational_matches, &mut attention);
    Value::Array(attention)
}

fn collect_attention(source: &str, items: &Value, attention: &mut Vec<Value>) {
    let Some(items) = items.as_array() else {
        return;
    };
    for item in items {
        if has_missing_response_signal(item) {
            attention.push(attention_item("missing_responses", source, item));
        }
        if has_replacement_signal(item) {
            attention.push(attention_item("replacement", source, item));
        }
        if has_error_signal(item) {
            attention.push(attention_item("error", source, item));
        }
    }
}

fn attention_item(kind: &str, source: &str, item: &Value) -> Value {
    json!({
        "kind": kind,
        "source": source,
        "id": item_id(item),
    })
}

fn item_id(item: &Value) -> Value {
    item.get("id").cloned().unwrap_or(Value::Null)
}

fn has_missing_response_signal(item: &Value) -> bool {
    non_empty_array_field(item, &["missing_responses", "missing_response_ids"])
        || positive_number_field(item, &["missing_response_count", "open_response_count"])
        || status_contains(
            item,
            &["missing_response", "missing response", "no_response"],
        )
}

fn has_replacement_signal(item: &Value) -> bool {
    truthy_field(item, &["replacement_needed", "needs_replacement"])
        || non_empty_array_field(item, &["replacement_needs", "replacement_need_ids"])
        || status_contains(item, &["replacement"])
}

fn has_error_signal(item: &Value) -> bool {
    non_empty_array_field(item, &["errors"])
        || truthy_field(item, &["has_error", "failed"])
        || status_contains(item, &["error", "failed"])
}

fn status_contains(item: &Value, needles: &[&str]) -> bool {
    item.get("status")
        .and_then(Value::as_str)
        .map(|status| {
            let status = status.to_ascii_lowercase();
            needles.iter().any(|needle| status.contains(needle))
        })
        .unwrap_or(false)
}

fn non_empty_array_field(item: &Value, keys: &[&str]) -> bool {
    keys.iter().any(|key| {
        item.get(*key)
            .and_then(Value::as_array)
            .is_some_and(|items| !items.is_empty())
    })
}

fn positive_number_field(item: &Value, keys: &[&str]) -> bool {
    keys.iter().any(|key| {
        item.get(*key)
            .and_then(Value::as_u64)
            .is_some_and(|value| value > 0)
    })
}

fn truthy_field(item: &Value, keys: &[&str]) -> bool {
    keys.iter()
        .any(|key| item.get(*key).and_then(Value::as_bool).unwrap_or(false))
}

fn value_by_keys(value: &Value, keys: &[&str]) -> Option<Value> {
    keys.iter()
        .find_map(|key| value.get(*key).filter(|value| !value.is_null()).cloned())
}

fn error_response(error: AppError, request_id: &str) -> Response {
    let (status, detail) = match error {
        AppError::Http(status, detail) => (status, detail),
        AppError::Db(err) => {
            tracing::error!(%err, "Scrim-BFF-Datenbankfehler");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error".to_string(),
            )
        }
        AppError::Json(err) => (StatusCode::BAD_REQUEST, err.to_string()),
        AppError::Reqwest(err) => {
            tracing::warn!(%err, "Scrim-BFF interner HTTP-Aufruf fehlgeschlagen");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Internal service is not reachable".to_string(),
            )
        }
    };
    json_response(
        status,
        request_id,
        json!({ "detail": detail, "request_id": request_id }),
    )
}

fn upstream_bad_gateway_response(request_id: &str) -> Response {
    json_response(
        StatusCode::BAD_GATEWAY,
        request_id,
        json!({
            "detail": "Scrim upstream failed",
            "request_id": request_id,
        }),
    )
}

fn json_response(status: StatusCode, request_id: &str, body: Value) -> Response {
    let mut response = (status, Json(body)).into_response();
    insert_request_id(response.headers_mut(), request_id);
    response
}

fn insert_request_id(headers: &mut HeaderMap, request_id: &str) {
    if let Ok(value) = HeaderValue::from_str(request_id) {
        headers.insert("X-Request-Id", value);
    }
}

async fn scrim_not_found() -> Response {
    let request_id = request_id();
    json_response(
        StatusCode::NOT_FOUND,
        &request_id,
        json!({
            "detail": "Scrim route not found",
            "request_id": request_id,
        }),
    )
}
