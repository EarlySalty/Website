use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    Http(StatusCode, String),
    Db(sqlx::Error),
    Json(serde_json::Error),
    Reqwest(reqwest::Error),
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn http(status: StatusCode, detail: impl Into<String>) -> Self {
        Self::Http(status, detail.into())
    }

    pub fn bad_request(detail: impl Into<String>) -> Self {
        Self::http(StatusCode::BAD_REQUEST, detail)
    }

    pub fn unauthorized(detail: impl Into<String>) -> Self {
        Self::http(StatusCode::UNAUTHORIZED, detail)
    }

    pub fn forbidden(detail: impl Into<String>) -> Self {
        Self::http(StatusCode::FORBIDDEN, detail)
    }

    pub fn not_found(detail: impl Into<String>) -> Self {
        Self::http(StatusCode::NOT_FOUND, detail)
    }

    pub fn service_unavailable(detail: impl Into<String>) -> Self {
        Self::http(StatusCode::SERVICE_UNAVAILABLE, detail)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Http(status, detail) => {
                (status, Json(json!({ "detail": detail }))).into_response()
            }
            AppError::Db(err) => {
                tracing::error!(%err, "Datenbankfehler");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "detail": "Database error" })),
                )
                    .into_response()
            }
            AppError::Json(err) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "detail": err.to_string() })),
            )
                .into_response(),
            AppError::Reqwest(err) => {
                tracing::warn!(%err, "Interner HTTP-Aufruf fehlgeschlagen");
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({ "detail": "Internal service is not reachable" })),
                )
                    .into_response()
            }
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(value: sqlx::Error) -> Self {
        Self::Db(value)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(value: reqwest::Error) -> Self {
        Self::Reqwest(value)
    }
}
