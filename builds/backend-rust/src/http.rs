use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

pub fn json(value: Value) -> Response {
    axum::Json(value).into_response()
}

pub fn no_content(headers: HeaderMap) -> Response {
    (StatusCode::NO_CONTENT, headers).into_response()
}

pub fn redirect(location: &str, headers: HeaderMap) -> Response {
    let mut response = (StatusCode::FOUND, headers).into_response();
    response.headers_mut().insert(
        header::LOCATION,
        HeaderValue::from_str(location).unwrap_or_else(|_| HeaderValue::from_static("/")),
    );
    response
}
