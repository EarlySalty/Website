use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Map, Number, Value};
use sqlx::{postgres::PgRow, Column, Row};

pub type DbRow = PgRow;

pub fn value_from_row(row: &DbRow, name: &str) -> Value {
    if let Ok(v) = row.try_get::<Option<Value>, _>(name) {
        return v.unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<bool>, _>(name) {
        return v.map(Value::Bool).unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<i64>, _>(name) {
        return v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(name) {
        return v
            .map(|n| Value::Number(i64::from(n).into()))
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(name) {
        return v
            .and_then(Number::from_f64)
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<f32>, _>(name) {
        return v
            .and_then(|n| Number::from_f64(f64::from(n)))
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<DateTime<Utc>>, _>(name) {
        return v
            .map(|dt| Value::String(dt.to_rfc3339()))
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<NaiveDate>, _>(name) {
        return v
            .map(|date| Value::String(date.to_string()))
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.map(Value::String).unwrap_or(Value::Null);
    }
    Value::Null
}

pub fn string(row: &DbRow, name: &str) -> Option<String> {
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<DateTime<Utc>>, _>(name) {
        return v.map(|dt| dt.to_rfc3339());
    }
    if let Ok(v) = row.try_get::<Option<NaiveDate>, _>(name) {
        return v.map(|date| date.to_string());
    }
    if let Ok(v) = row.try_get::<Option<Value>, _>(name) {
        return v.map(|json| json.to_string());
    }
    if let Ok(v) = row.try_get::<Option<i64>, _>(name) {
        return v.map(|n| n.to_string());
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(name) {
        return v.map(|n| n.to_string());
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(name) {
        return v.map(|n| n.to_string());
    }
    if let Ok(v) = row.try_get::<Option<bool>, _>(name) {
        return v.map(|b| b.to_string());
    }
    None
}

pub fn required_string(row: &DbRow, name: &str) -> String {
    string(row, name).unwrap_or_default()
}

pub fn i64(row: &DbRow, name: &str) -> Option<i64> {
    if let Ok(v) = row.try_get::<Option<i64>, _>(name) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(name) {
        return v.map(i64::from);
    }
    if let Ok(v) = row.try_get::<Option<bool>, _>(name) {
        return v.map(|b| if b { 1 } else { 0 });
    }
    if let Ok(v) = row.try_get::<Option<DateTime<Utc>>, _>(name) {
        return v.map(|dt| dt.timestamp());
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.and_then(|raw| raw.parse::<i64>().ok());
    }
    None
}

pub fn f64(row: &DbRow, name: &str) -> Option<f64> {
    if let Ok(v) = row.try_get::<Option<f64>, _>(name) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<f32>, _>(name) {
        return v.map(f64::from);
    }
    if let Some(v) = i64(row, name) {
        return Some(v as f64);
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.and_then(|raw| raw.parse::<f64>().ok());
    }
    None
}

pub fn bool(row: &DbRow, name: &str) -> Option<bool> {
    if let Ok(v) = row.try_get::<Option<bool>, _>(name) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<i64>, _>(name) {
        return v.map(|n| n != 0);
    }
    if let Ok(v) = row.try_get::<Option<i32>, _>(name) {
        return v.map(|n| n != 0);
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.and_then(|raw| match raw.to_ascii_lowercase().as_str() {
            "true" | "t" | "1" | "yes" => Some(true),
            "false" | "f" | "0" | "no" => Some(false),
            _ => None,
        });
    }
    None
}

pub fn json_value(row: &DbRow, name: &str) -> Option<Value> {
    if let Ok(v) = row.try_get::<Option<Value>, _>(name) {
        return v;
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.and_then(|raw| serde_json::from_str::<Value>(&raw).ok());
    }
    None
}

pub fn json_or(row: &DbRow, names: &[&str], fallback: Value) -> Value {
    names
        .iter()
        .find_map(|name| json_value(row, name))
        .unwrap_or(fallback)
}

pub fn row_json(row: &DbRow) -> Value {
    let mut obj = Map::new();
    for column in row.columns() {
        let name = column.name();
        obj.insert(name.to_string(), value_from_row(row, name));
    }
    Value::Object(obj)
}

pub fn parse_json_or(value: Option<String>, fallback: Value) -> Value {
    value
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .unwrap_or(fallback)
}
