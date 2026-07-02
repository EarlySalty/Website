use std::{future::Future, pin::Pin, sync::Arc, time::Duration};

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use crate::config::Config;

pub type DynDiscordRoleBroker = Arc<dyn DiscordRoleBroker>;
pub type DiscordRoleBrokerFuture<'a> =
    Pin<Box<dyn Future<Output = Result<(), DiscordRoleBrokerError>> + Send + 'a>>;

pub trait DiscordRoleBroker: Send + Sync {
    fn is_configured(&self) -> bool;

    fn apply_role<'a>(
        &'a self,
        operation: DiscordRoleOperation,
        request: DiscordRoleBrokerRequest,
    ) -> DiscordRoleBrokerFuture<'a>;
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

#[derive(Deserialize)]
struct DiscordRoleBrokerResponse {
    ok: bool,
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
}
