use std::{future::Future, pin::Pin, sync::Arc, time::Duration};

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::config::Config;

pub type DynDiscordRoleBroker = Arc<dyn DiscordRoleBroker>;
pub type DiscordRoleBrokerFuture<'a, T = ()> =
    Pin<Box<dyn Future<Output = Result<T, DiscordRoleBrokerError>> + Send + 'a>>;

pub trait DiscordRoleBroker: Send + Sync {
    fn is_configured(&self) -> bool;

    fn apply_role<'a>(
        &'a self,
        operation: DiscordRoleOperation,
        request: DiscordRoleBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a>;

    fn create_role<'a>(
        &'a self,
        request: DiscordCreateRoleBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a, u64>;

    fn send_dm<'a>(&'a self, request: DiscordDmBrokerRequest) -> DiscordRoleBrokerFuture<'a>;

    fn send_rich_message<'a>(
        &'a self,
        request: DiscordRichMessageBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a, String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscordRoleOperation {
    Add,
    Remove,
}

impl DiscordRoleOperation {
    pub fn endpoint(self) -> &'static str {
        match self {
            Self::Add => "add-role",
            Self::Remove => "remove-role",
        }
    }

    pub fn idempotency_suffix(self) -> &'static str {
        match self {
            Self::Add => "add",
            Self::Remove => "remove",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiscordRoleBrokerRequest {
    pub guild_id: u64,
    pub user_id: u64,
    pub role_id: u64,
    pub reason: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscordCreateRoleBrokerRequest {
    pub guild_id: u64,
    pub name: String,
    pub mentionable: bool,
    pub reason: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiscordDmBrokerRequest {
    pub user_id: u64,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DiscordRichMessageBrokerRequest {
    pub channel_id: u64,
    pub content: Option<String>,
    pub embed: Value,
    pub allowed_role_ids: Vec<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscordRoleBrokerError {
    Unconfigured,
    Transport,
    HttpStatus,
    InvalidResponse,
    Rejected,
}

#[derive(Clone)]
pub struct ReqwestDiscordRoleBroker {
    client: Client,
    base: String,
    token: Option<String>,
}

impl ReqwestDiscordRoleBroker {
    pub fn from_config(cfg: &Config) -> Result<Self, reqwest::Error> {
        let client = Client::builder().timeout(Duration::from_secs(5)).build()?;
        Ok(Self {
            client,
            base: cfg.master_broker_base.clone(),
            token: cfg.master_broker_token.clone(),
        })
    }
}

impl DiscordRoleBroker for ReqwestDiscordRoleBroker {
    fn is_configured(&self) -> bool {
        self.token.is_some()
    }

    fn apply_role<'a>(
        &'a self,
        operation: DiscordRoleOperation,
        request: DiscordRoleBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a> {
        Box::pin(async move {
            let Some(token) = self.token.as_deref() else {
                return Err(DiscordRoleBrokerError::Unconfigured);
            };
            let request =
                build_discord_role_request(&self.client, &self.base, token, operation, &request)
                    .map_err(|_| DiscordRoleBrokerError::Transport)?;
            let response = self
                .client
                .execute(request)
                .await
                .map_err(|_| DiscordRoleBrokerError::Transport)?;
            if response.status() != StatusCode::OK {
                return Err(DiscordRoleBrokerError::HttpStatus);
            }
            let response = response
                .json::<DiscordRoleBrokerResponse>()
                .await
                .map_err(|_| DiscordRoleBrokerError::InvalidResponse)?;
            if response.ok {
                Ok(())
            } else {
                Err(DiscordRoleBrokerError::Rejected)
            }
        })
    }

    fn create_role<'a>(
        &'a self,
        request: DiscordCreateRoleBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a, u64> {
        Box::pin(async move {
            let Some(token) = self.token.as_deref() else {
                return Err(DiscordRoleBrokerError::Unconfigured);
            };
            let request =
                build_discord_create_role_request(&self.client, &self.base, token, &request)
                    .map_err(|_| DiscordRoleBrokerError::Transport)?;
            let response = self
                .client
                .execute(request)
                .await
                .map_err(|_| DiscordRoleBrokerError::Transport)?;
            if response.status() != StatusCode::OK {
                return Err(DiscordRoleBrokerError::HttpStatus);
            }
            let response = response
                .json::<DiscordCreateRoleBrokerResponse>()
                .await
                .map_err(|_| DiscordRoleBrokerError::InvalidResponse)?;
            if !response.ok {
                return Err(DiscordRoleBrokerError::Rejected);
            }
            response
                .result
                .filter(|result| result.role_id > 0)
                .map(|result| result.role_id)
                .ok_or(DiscordRoleBrokerError::InvalidResponse)
        })
    }

    fn send_dm<'a>(&'a self, request: DiscordDmBrokerRequest) -> DiscordRoleBrokerFuture<'a> {
        Box::pin(async move {
            let Some(token) = self.token.as_deref() else {
                return Err(DiscordRoleBrokerError::Unconfigured);
            };
            let request = build_discord_dm_request(&self.client, &self.base, token, &request)
                .map_err(|_| DiscordRoleBrokerError::Transport)?;
            let response = self
                .client
                .execute(request)
                .await
                .map_err(|_| DiscordRoleBrokerError::Transport)?;
            if response.status() != StatusCode::OK {
                return Err(DiscordRoleBrokerError::HttpStatus);
            }
            let response = response
                .json::<DiscordRoleBrokerResponse>()
                .await
                .map_err(|_| DiscordRoleBrokerError::InvalidResponse)?;
            if response.ok {
                Ok(())
            } else {
                Err(DiscordRoleBrokerError::Rejected)
            }
        })
    }

    fn send_rich_message<'a>(
        &'a self,
        request: DiscordRichMessageBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a, String> {
        Box::pin(async move {
            let Some(token) = self.token.as_deref() else {
                return Err(DiscordRoleBrokerError::Unconfigured);
            };
            let request =
                build_discord_rich_message_request(&self.client, &self.base, token, &request)
                    .map_err(|_| DiscordRoleBrokerError::Transport)?;
            let response = self
                .client
                .execute(request)
                .await
                .map_err(|_| DiscordRoleBrokerError::Transport)?;
            if response.status() != StatusCode::OK {
                return Err(DiscordRoleBrokerError::HttpStatus);
            }
            let response = response
                .json::<DiscordRichMessageBrokerResponse>()
                .await
                .map_err(|_| DiscordRoleBrokerError::InvalidResponse)?;
            if !response.ok {
                return Err(DiscordRoleBrokerError::Rejected);
            }
            response
                .result
                .map(|result| result.message_id)
                .filter(|message_id| !message_id.is_empty())
                .ok_or(DiscordRoleBrokerError::InvalidResponse)
        })
    }
}

pub fn build_discord_role_request(
    client: &Client,
    base: &str,
    token: &str,
    operation: DiscordRoleOperation,
    payload: &DiscordRoleBrokerRequest,
) -> Result<reqwest::Request, reqwest::Error> {
    let url = format!(
        "{}/internal/master/v1/discord/member/{}",
        base.trim_end_matches('/'),
        operation.endpoint()
    );
    client
        .post(url)
        .header("X-Internal-Token", token)
        .json(payload)
        .build()
}

pub fn build_discord_create_role_request(
    client: &Client,
    base: &str,
    token: &str,
    payload: &DiscordCreateRoleBrokerRequest,
) -> Result<reqwest::Request, reqwest::Error> {
    #[derive(Serialize)]
    struct CreateRolePayload<'a> {
        guild_id: u64,
        name: &'a str,
        mentionable: bool,
        reason: Option<&'a str>,
    }

    let url = format!(
        "{}/internal/master/v1/discord/role/create",
        base.trim_end_matches('/')
    );
    let body = CreateRolePayload {
        guild_id: payload.guild_id,
        name: &payload.name,
        mentionable: payload.mentionable,
        reason: payload.reason.as_deref(),
    };
    let mut request = client.post(url).header("X-Internal-Token", token);
    if let Some(idempotency_key) = payload.idempotency_key.as_deref() {
        request = request.header("X-Idempotency-Key", idempotency_key);
    }
    request.json(&body).build()
}

pub fn build_discord_dm_request(
    client: &Client,
    base: &str,
    token: &str,
    payload: &DiscordDmBrokerRequest,
) -> Result<reqwest::Request, reqwest::Error> {
    let url = format!(
        "{}/internal/master/v1/discord/send-dm",
        base.trim_end_matches('/')
    );
    client
        .post(url)
        .header("X-Internal-Token", token)
        .json(payload)
        .build()
}

pub fn build_discord_rich_message_request(
    client: &Client,
    base: &str,
    token: &str,
    payload: &DiscordRichMessageBrokerRequest,
) -> Result<reqwest::Request, reqwest::Error> {
    let url = format!(
        "{}/internal/master/v1/discord/send-rich-message",
        base.trim_end_matches('/')
    );
    client
        .post(url)
        .header("X-Internal-Token", token)
        .json(payload)
        .build()
}

#[derive(Deserialize)]
struct DiscordRoleBrokerResponse {
    ok: bool,
}

#[derive(Deserialize)]
struct DiscordCreateRoleBrokerResponse {
    ok: bool,
    result: Option<DiscordCreateRoleBrokerResult>,
}

#[derive(Deserialize)]
struct DiscordCreateRoleBrokerResult {
    role_id: u64,
}

#[derive(Deserialize)]
struct DiscordRichMessageBrokerResponse {
    ok: bool,
    result: Option<DiscordRichMessageBrokerResult>,
}

#[derive(Deserialize)]
struct DiscordRichMessageBrokerResult {
    message_id: String,
}

#[cfg(test)]
mod tests {
    use reqwest::{Client, Method};
    use serde_json::Value;

    use super::*;

    #[test]
    fn discord_role_request_sets_header_and_json_body() {
        let client = Client::new();
        let request = build_discord_role_request(
            &client,
            "http://127.0.0.1:8770/",
            "unit-token",
            DiscordRoleOperation::Add,
            &DiscordRoleBrokerRequest {
                guild_id: 128,
                user_id: 456,
                role_id: 789,
                reason: Some("test reason".to_string()),
                idempotency_key: Some("scrim-1-789-add".to_string()),
            },
        )
        .expect("request builds");

        assert_eq!(request.method(), Method::POST);
        assert_eq!(
            request.url().as_str(),
            "http://127.0.0.1:8770/internal/master/v1/discord/member/add-role"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Internal-Token")
                .and_then(|value| value.to_str().ok()),
            Some("unit-token")
        );

        let body = request
            .body()
            .and_then(|body| body.as_bytes())
            .expect("json body");
        let body: Value = serde_json::from_slice(body).expect("json body parses");
        assert_eq!(body["guild_id"], 128);
        assert_eq!(body["user_id"], 456);
        assert_eq!(body["role_id"], 789);
        assert_eq!(body["reason"], "test reason");
        assert_eq!(body["idempotency_key"], "scrim-1-789-add");
    }

    #[test]
    fn discord_create_role_request_sets_header_and_json_body() {
        let client = Client::new();
        let request = build_discord_create_role_request(
            &client,
            "http://127.0.0.1:8770/",
            "unit-token",
            &DiscordCreateRoleBrokerRequest {
                guild_id: 128,
                name: "Auswechselspieler".to_string(),
                mentionable: true,
                reason: Some("Scrim-Reserve".to_string()),
                idempotency_key: Some("scrim-reserve-role-create".to_string()),
            },
        )
        .expect("request builds");

        assert_eq!(request.method(), Method::POST);
        assert_eq!(
            request.url().as_str(),
            "http://127.0.0.1:8770/internal/master/v1/discord/role/create"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Internal-Token")
                .and_then(|value| value.to_str().ok()),
            Some("unit-token")
        );
        assert_eq!(
            request
                .headers()
                .get("X-Idempotency-Key")
                .and_then(|value| value.to_str().ok()),
            Some("scrim-reserve-role-create")
        );

        let body = request
            .body()
            .and_then(|body| body.as_bytes())
            .expect("json body");
        let body: Value = serde_json::from_slice(body).expect("json body parses");
        assert_eq!(body["guild_id"], 128);
        assert_eq!(body["name"], "Auswechselspieler");
        assert_eq!(body["mentionable"], true);
        assert_eq!(body["reason"], "Scrim-Reserve");
        assert!(body.get("idempotency_key").is_none());
    }

    #[test]
    fn discord_dm_request_sets_header_and_json_body() {
        let client = Client::new();
        let request = build_discord_dm_request(
            &client,
            "http://127.0.0.1:8770/",
            "unit-token",
            &DiscordDmBrokerRequest {
                user_id: 456,
                content: "Willkommen!".to_string(),
            },
        )
        .expect("request builds");

        assert_eq!(request.method(), Method::POST);
        assert_eq!(
            request.url().as_str(),
            "http://127.0.0.1:8770/internal/master/v1/discord/send-dm"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Internal-Token")
                .and_then(|value| value.to_str().ok()),
            Some("unit-token")
        );

        let body = request
            .body()
            .and_then(|body| body.as_bytes())
            .expect("json body");
        let body: Value = serde_json::from_slice(body).expect("json body parses");
        assert_eq!(body["user_id"], 456);
        assert_eq!(body["content"], "Willkommen!");
    }

    #[test]
    fn discord_rich_message_request_sets_header_and_json_body() {
        let client = Client::new();
        let request = build_discord_rich_message_request(
            &client,
            "http://127.0.0.1:8770/",
            "unit-token",
            &DiscordRichMessageBrokerRequest {
                channel_id: 123,
                content: Some("<@&456>".to_string()),
                embed: serde_json::json!({"title": "Aufruf"}),
                allowed_role_ids: vec![456],
            },
        )
        .expect("request builds");

        assert_eq!(request.method(), Method::POST);
        assert_eq!(
            request.url().as_str(),
            "http://127.0.0.1:8770/internal/master/v1/discord/send-rich-message"
        );
        assert_eq!(
            request
                .headers()
                .get("X-Internal-Token")
                .and_then(|value| value.to_str().ok()),
            Some("unit-token")
        );

        let body = request
            .body()
            .and_then(|body| body.as_bytes())
            .expect("json body");
        let body: Value = serde_json::from_slice(body).expect("json body parses");
        assert_eq!(body["channel_id"], 123);
        assert_eq!(body["content"], "<@&456>");
        assert_eq!(body["embed"]["title"], "Aufruf");
        assert_eq!(body["allowed_role_ids"], serde_json::json!([456]));
    }
}
