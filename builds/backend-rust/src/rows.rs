use serde_json::{Map, Number, Value};
use sqlx::{sqlite::SqliteRow, Column, Row};

pub fn value_from_row(row: &SqliteRow, name: &str) -> Value {
    if let Ok(v) = row.try_get::<Option<i64>, _>(name) {
        return v.map(|n| Value::Number(n.into())).unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<f64>, _>(name) {
        return v
            .and_then(Number::from_f64)
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if let Ok(v) = row.try_get::<Option<String>, _>(name) {
        return v.map(Value::String).unwrap_or(Value::Null);
    }
    Value::Null
}

pub fn string(row: &SqliteRow, name: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(name).ok().flatten()
}

pub fn required_string(row: &SqliteRow, name: &str) -> String {
    string(row, name).unwrap_or_default()
}

pub fn i64(row: &SqliteRow, name: &str) -> Option<i64> {
    row.try_get::<Option<i64>, _>(name).ok().flatten()
}

pub fn f64(row: &SqliteRow, name: &str) -> Option<f64> {
    row.try_get::<Option<f64>, _>(name).ok().flatten()
}

pub fn row_json(row: &SqliteRow) -> Value {
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
