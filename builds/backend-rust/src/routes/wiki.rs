use axum::{
    extract::{Path, Query},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};

const SHELL: &str = include_str!("../../../../dl-wiki/shell.html");
const CSS: &str = include_str!("../../../../dl-wiki/wiki.css");
const CONFIG: &str = include_str!("../../config/wiki.json");
const PORTRAITS: &str = include_str!("../../../../dl-wiki/portraits.json");
const CATEGORIES: &[(&str, &str)] = &[
    ("helden", "Helden"),
    ("items", "Items"),
    ("faehigkeiten", "Fähigkeiten"),
    ("mechaniken", "Mechaniken"),
    ("karte", "Karte"),
    ("updates", "Updates"),
    ("wissen", "Weiteres Spielwissen"),
];
const SHARDS: &[(&str, &str)] = &[
    ("deadlock-data", "hero"),
    ("deadlock-data", "hero-dossier"),
    ("deadlock-data", "item"),
    ("deadlock-data", "item-card"),
    ("deadlock-data", "item-special"),
    ("deadlock-data", "ability"),
    ("deadlock-data", "ability-card"),
    ("deadlock-data", "item-component-tree"),
    ("deadlock-data", "json-attribute-data"),
    ("deadlock-data", "json-generic-data"),
    ("deadlock-data", "json-midtown-metadata"),
    ("deadlock-data", "json-misc-data"),
    ("deadlock-data", "json-soul-unlock-data"),
    ("deadlock-data", "patchnote-structured"),
    ("deadlock-data", "patchnote-wikitext"),
    ("deadlock-data", "resource-lookup"),
    ("deadlock-wiki", "wiki-page"),
];

#[derive(Deserialize)]
struct WikiConfig {
    snapshot_root: PathBuf,
}
#[derive(Default, Deserialize)]
pub struct Params {
    q: Option<String>,
    category: Option<String>,
    page: Option<usize>,
}
#[derive(Clone)]
struct Entry {
    title: String,
    kind: String,
    category: String,
    slug: String,
    external_id: String,
    data: Value,
    source_url: Option<String>,
    fetched_at: Option<String>,
    search_text: String,
}
struct Snapshot {
    root: PathBuf,
    status: Value,
    entries: Vec<Entry>,
}
static CACHE: OnceLock<Mutex<Option<Arc<Snapshot>>>> = OnceLock::new();

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
fn safe_url(value: &str) -> Option<String> {
    let url = url::Url::parse(value).ok()?;
    matches!(url.scheme(), "https" | "http").then(|| url.to_string())
}
fn clean_text(text: &str) -> String {
    let mut result = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '<'
            && chars
                .peek()
                .is_some_and(|next| next.is_ascii_alphabetic() || *next == '/' || *next == '!')
        {
            for next in chars.by_ref() {
                if next == '>' {
                    break;
                }
            }
            result.push(' ');
        } else if c == '{' && chars.peek() == Some(&'g') {
            let mut token = String::new();
            for next in chars.by_ref() {
                if next == '}' {
                    break;
                }
                token.push(next);
            }
            if let Some(key) = token.split('\'').nth(1) {
                result.push_str(match key {
                    "SpiritDamage" => "Geistschaden",
                    "SpiritDPS" => "Geistschaden pro Sekunde",
                    "Stun" => "betäubt",
                    "Heals" => "heilt",
                    "Pulling" => "zieht",
                    "Reload" => "Nachladen",
                    "MoveSpeed" => "Bewegungstempo",
                    _ => key,
                });
            }
        } else {
            result.push(c);
        }
    }
    result
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn slug(text: &str) -> String {
    let mut out = String::new();
    for c in text.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').to_string()
}
fn attribute(marker: &str, key: &str) -> Option<String> {
    let start = marker.find(&format!("{key}="))? + key.len() + 1;
    let mut stream = serde_json::Deserializer::from_str(&marker[start..]).into_iter::<String>();
    stream.next()?.ok()
}
fn metadata(block: &str, key: &str) -> Option<String> {
    block.lines().find_map(|line| {
        line.strip_prefix(&format!("- {key}: `"))
            .and_then(|s| s.strip_suffix('`'))
            .map(str::to_string)
    })
}
fn category(kind: &str) -> &'static str {
    match kind {
        "hero" | "hero_dossier" => "helden",
        "item" | "item_card" | "item_special" | "item_component_tree" => "items",
        "ability" | "ability_card" => "faehigkeiten",
        "wiki_page"
        | "json_attribute_data"
        | "json_generic_data"
        | "json_misc_data"
        | "json_soul_unlock_data" => "mechaniken",
        "json_midtown_metadata" => "karte",
        "patchnote_structured" | "patchnote_wikitext" | "patchnote" => "updates",
        _ => "wissen",
    }
}
fn parse_shard(content: &str) -> Result<Vec<Entry>, String> {
    let mut entries = Vec::new();
    for block in content.split("<!-- game-wiki-entry ").skip(1) {
        let marker = block.split(" -->").next().ok_or("marker")?;
        let kind = attribute(marker, "entity_type").ok_or("entity_type")?;
        let source = attribute(marker, "source").ok_or("source")?;
        if !matches!(source.as_str(), "deadlock_data" | "deadlock_wiki") {
            return Err("source".into());
        }
        let title = attribute(marker, "title").ok_or("title")?;
        let external_id = attribute(marker, "external_id").ok_or("external_id")?;
        let payload = block
            .split_once("````json\n")
            .and_then(|(_, s)| s.split_once("\n````").map(|(p, _)| p))
            .ok_or("payload")?;
        let data: Value = serde_json::from_str(payload).map_err(|_| "json")?;
        if !data.is_object() {
            return Err("payload-object".into());
        }
        entries.push(Entry {
            title,
            category: category(&kind).into(),
            slug: format!("{}-{}", slug(&kind), slug(&external_id)),
            external_id,
            kind,
            data,
            source_url: metadata(block, "Source URL").and_then(|u| safe_url(&u)),
            fetched_at: metadata(block, "Fetched At"),
            search_text: String::new(),
        });
    }
    Ok(entries)
}
fn load_snapshot() -> Result<Arc<Snapshot>, String> {
    let config: WikiConfig = serde_json::from_str(CONFIG).map_err(|_| "config")?;
    let root = fs::canonicalize(config.snapshot_root).map_err(|_| "snapshot")?;
    let cache = CACHE.get_or_init(|| Mutex::new(None));
    let mut guard = cache.lock().map_err(|_| "cache")?;
    if let Some(snapshot) = guard.as_ref().filter(|s| s.root == root) {
        return Ok(snapshot.clone());
    }
    let status: Value =
        serde_json::from_slice(&fs::read(root.join("status.json")).map_err(|_| "status")?)
            .map_err(|_| "status-json")?;
    if status["state"] != "ready" || status["schema_version"] != 1 {
        return Err("not-ready".into());
    }
    let mut entries = Vec::new();
    for (source, shard) in SHARDS {
        let count_key = format!("{}/{}", source.replace('-', "_"), shard.replace('-', "_"));
        let expected = status["counts"][&count_key].as_u64().unwrap_or(0) as usize;
        let path = root.join("pages").join(source).join(format!("{shard}.md"));
        if !path.exists() {
            if expected == 0 {
                continue;
            }
            return Err("missing-shard".into());
        }
        let path = fs::canonicalize(path).map_err(|_| "shard")?;
        if !path.starts_with(&root) {
            return Err("path".into());
        }
        let data = fs::read_to_string(&path).map_err(|_| "read")?;
        let parsed = parse_shard(&data)?;
        if parsed.len() != expected {
            return Err("shard-count".into());
        }
        entries.extend(parsed);
    }
    if entries.is_empty() || status["entries"].as_u64() != Some(entries.len() as u64) {
        return Err("empty".into());
    }
    let mut grouped: BTreeMap<(String, String), Entry> = BTreeMap::new();
    for entry in entries {
        let key = (entry.category.clone(), entry.external_id.clone());
        if let Some(existing) = grouped.get_mut(&key) {
            if entry.kind == "hero_dossier" {
                let stats = existing.data.clone();
                *existing = entry;
                existing.data["stats"] = stats;
            } else if existing.kind == "hero_dossier" && entry.kind == "hero" {
                existing.data["stats"] = entry.data;
            } else if entry.kind.ends_with("card") {
                existing.data["card"] = entry.data;
            } else if existing.kind.ends_with("card") {
                let card = existing.data.clone();
                *existing = entry;
                existing.data["card"] = card;
            } else if existing.kind == "patchnote_structured" {
                existing.data["wikitext"] = entry.data;
            } else {
                existing.data[format!("zusatz_{}", entry.kind)] = entry.data;
            }
        } else {
            grouped.insert(key, entry);
        }
    }
    let mut entries = grouped.into_values().collect::<Vec<_>>();
    for entry in &mut entries {
        entry.search_text = format!(
            "{} {} {}",
            entry.title,
            entry.external_id,
            clean_text(&entry.data.to_string())
        )
        .to_lowercase();
    }
    entries.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    let snapshot = Arc::new(Snapshot {
        root,
        status,
        entries,
    });
    *guard = Some(snapshot.clone());
    Ok(snapshot)
}
fn label(key: &str) -> String {
    match key {
        "MaxHealth" => "Lebenspunkte",
        "BaseHealthRegen" => "Lebensregeneration",
        "MoveSpeed" => "Bewegungstempo",
        "Stamina" => "Ausdauer",
        "Cost" => "Kosten in Seelen",
        "Tier" => "Stufe",
        "Activation" => "Aktivierung",
        "WeaponDamage" => "Waffenschaden",
        "BulletDamage" => "Kugelschaden",
        "AbilityCooldown" | "Cooldown" => "Abklingzeit",
        "AbilityDuration" | "Duration" => "Dauer",
        "Damage" => "Schaden",
        "DPS" => "Schaden pro Sekunde",
        "Radius" => "Radius",
        "Range" => "Reichweite",
        "BulletLifestealPercent" => "Lebensraub durch Kugeln (%)",
        "BonusFireRate" => "Feuerrate (%)",
        "BonusClipSizePercent" => "Magazingröße (%)",
        "HeavyMeleeDamage" => "Schwerer Nahkampfschaden",
        "LightMeleeDamage" => "Leichter Nahkampfschaden",
        "SpiritPower" => "Geistkraft",
        "IsSelectable" => "Auswählbar",
        "IsDisabled" => "Deaktiviert",
        "InDevelopment" => "In Entwicklung",
        "InHeroLabs" => "Hero Labs",
        _ => key,
    }
    .into()
}
fn value_text(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(clean_text(s)),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(if *b { "Ja" } else { "Nein" }.into()),
        _ => None,
    }
}
fn description(data: &Value) -> Option<(String, bool)> {
    let text = data
        .get("Description")
        .or_else(|| data.get("description"))?
        .as_str()?;
    if text.trim().is_empty() {
        return None;
    }
    Some((
        clean_text(text),
        data.pointer("/_wiki_description_source/language")
            .and_then(Value::as_str)
            == Some("german"),
    ))
}
fn render_fields(data: &Value) -> String {
    let Some(object) = data.as_object() else {
        return String::new();
    };
    let mut rows = String::new();
    if let Some(value) = data.get("Value").and_then(value_text) {
        let key = data
            .get("Key")
            .or_else(|| data.get("Name"))
            .and_then(Value::as_str)
            .unwrap_or("Wert");
        rows.push_str(&format!(
            "<tr><th scope=\"row\">{}</th><td>{}{}</td></tr>",
            escape(&label(key)),
            escape(&value),
            match data.get("Type").and_then(Value::as_str) {
                Some("cooldown" | "duration" | "charge_cooldown") => " s",
                Some("radius" | "range") => " m",
                _ => "",
            }
        ));
        if data.get("UsageFlags").and_then(Value::as_str) == Some("ConditionallyApplied") {
            rows.push_str("<tr><th scope=\"row\">Bedingung</th><td>Wird nur unter der im Effekt beschriebenen Bedingung angewendet.</td></tr>");
        }
    }
    for (key, value) in object {
        if key.starts_with('_')
            || matches!(
                key.as_str(),
                "Key"
                    | "Name"
                    | "Description"
                    | "DescKey"
                    | "HeroKey"
                    | "HeroName"
                    | "Slot"
                    | "card"
                    | "stats"
                    | "wikitext"
                    | "Value"
                    | "Type"
                    | "UsageFlags"
                    | "extract"
            )
        {
            continue;
        }
        if let Some(text) = value_text(value) {
            if text.len() <= 250 {
                let unit = if key.contains("Cooldown") || key.ends_with("Duration") {
                    " s"
                } else {
                    ""
                };
                rows.push_str(&format!(
                    "<tr><th scope=\"row\">{}</th><td>{}{}</td></tr>",
                    escape(&label(key)),
                    escape(&text),
                    unit
                ));
            } else {
                rows.push_str(&format!("<tr><th scope=\"row\">{}</th><td><p class=\"wiki-description\">{}</p></td></tr>", escape(&label(key)), escape(&text)));
            }
        } else if let Some(value) = value.get("Value").and_then(value_text) {
            let unit = if key.contains("Cooldown") || key.ends_with("Duration") {
                " s"
            } else {
                ""
            };
            rows.push_str(&format!(
                "<tr><th scope=\"row\">{}</th><td>{}{}</td></tr>",
                escape(&label(key)),
                escape(&value),
                unit
            ));
        }
    }
    if rows.is_empty() {
        String::new()
    } else {
        format!("<div class=\"wiki-table-wrap\"><table class=\"wiki-table\"><caption>Werte aus den Spieldaten</caption><tbody>{rows}</tbody></table></div>")
    }
}
fn render_description(data: &Value) -> String {
    description(data).map(|(text, german)| format!("{}<p class=\"wiki-description\"{}>{}</p>", if german { "" } else { "<p class=\"wiki-card-meta\">Originalbeschreibung; eine deutsche Fassung fehlt in dieser Quelle.</p>" }, if german { "" } else { " lang=\"en\"" }, escape(&text))).unwrap_or_default()
}
fn public_data(data: &Value) -> Value {
    match data {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .filter(|(key, _)| {
                    !key.starts_with('_')
                        && !matches!(
                            key.as_str(),
                            "raw_path"
                                | "source_raw_path"
                                | "root"
                                | "snapshot"
                                | "snapshot_id"
                                | "source_document_id"
                                | "payload_hash"
                        )
                })
                .map(|(key, value)| (key.clone(), public_data(value)))
                .collect(),
        ),
        Value::Array(array) => Value::Array(array.iter().map(public_data).collect()),
        _ => data.clone(),
    }
}
fn original_text(text: &str) -> String {
    let mut out = String::new();
    for paragraph in text.split("\n\n").filter(|p| !p.trim().is_empty()) {
        let paragraph = paragraph.trim();
        if paragraph.starts_with("==") && paragraph.ends_with("==") {
            out.push_str(&format!(
                "<h3>{}</h3>",
                escape(&clean_text(paragraph.trim_matches('=').trim()))
            ));
        } else {
            out.push_str(&format!(
                "<p class=\"wiki-description\" lang=\"en\">{}</p>",
                escape(&clean_text(paragraph))
            ));
        }
    }
    out
}
fn render_nested(data: &Value, depth: usize) -> String {
    if depth > 8 {
        return String::new();
    }
    let mut out = String::new();
    if let Some(object) = data.as_object() {
        for (key, value) in object {
            if key.starts_with('_')
                || matches!(key.as_str(), "stats" | "card" | "abilities" | "wikitext")
                || value_text(value).is_some()
                || value.get("Value").is_some()
            {
                continue;
            }
            if value.is_object() {
                let content = render_description(value)
                    + &render_fields(value)
                    + &render_nested(value, depth + 1);
                if !content.is_empty() {
                    out.push_str(&format!(
                        "<section class=\"wiki-section\"><h3>{}</h3>{}</section>",
                        escape(&label(key)),
                        content
                    ));
                }
            } else if let Some(array) = value.as_array() {
                for item in array {
                    if item.is_object() {
                        let title = item
                            .get("Name")
                            .or_else(|| item.get("Key"))
                            .and_then(Value::as_str)
                            .unwrap_or(key);
                        out.push_str(&format!(
                            "<section class=\"wiki-section\"><h3>{}</h3>{}{}</section>",
                            escape(&label(title)),
                            render_description(item) + &render_fields(item),
                            render_nested(item, depth + 1)
                        ));
                    } else if let Some(text) = value_text(item) {
                        out.push_str(&format!(
                            "<p class=\"wiki-description\">{}</p>",
                            escape(&text)
                        ));
                    }
                }
            }
        }
    }
    out
}
fn entry_url(entry: &Entry) -> String {
    format!("/wiki/{}/{}/", entry.category, entry.slug)
}
fn portrait(entry: &Entry) -> Option<String> {
    let data: Vec<Value> = serde_json::from_str(PORTRAITS).ok()?;
    data.iter()
        .find(|item| {
            item["key"].as_str() == Some(&entry.external_id)
                && item["title"].as_str() == Some(&entry.title)
        })
        .and_then(|item| item["url"].as_str())
        .filter(|url| {
            url.starts_with('/')
                && !url.starts_with("//")
                && !url.contains("..")
                && !url.chars().any(char::is_control)
        })
        .map(str::to_string)
}
fn portrait_html(entry: &Entry) -> String {
    portrait(entry).map(|url| format!("<img src=\"{}\" alt=\"{}\" width=\"256\" height=\"256\" loading=\"lazy\" decoding=\"async\">", escape(&url), escape(&entry.title))).unwrap_or_default()
}
fn title_for_category(category: &str) -> Option<&'static str> {
    CATEGORIES
        .iter()
        .find(|(key, _)| *key == category)
        .map(|(_, title)| *title)
}
fn date(text: Option<&str>) -> String {
    text.and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.format("%d.%m.%Y").to_string())
        .unwrap_or_else(|| "unbekannt".into())
}
fn shell(
    title: &str,
    main: &str,
    aside: &str,
    query: &str,
    data_date: &str,
    canonical: &str,
) -> String {
    let values = [("PAGE_TITLE", escape(title)), ("PAGE_HEADING", escape(title)), ("META_DESCRIPTION", escape("Helden, Items, Fähigkeiten und Updates: das Spielwissen der Deutschen Deadlock Community.")), ("MAIN_CONTENT", main.into()), ("ASIDE_CONTENT", aside.into()), ("SEARCH_QUERY", escape(query)), ("DATA_DATE", escape(data_date)), ("PAGE_CLASS", "wiki-page".into()), ("CANONICAL_URL", escape(canonical))];
    let mut output = String::new();
    let mut rest = SHELL;
    while let Some((before, tail)) = rest.split_once("{{") {
        output.push_str(before);
        if let Some((key, next)) = tail.split_once("}}") {
            if let Some((_, value)) = values.iter().find(|(name, _)| *name == key) {
                output.push_str(value);
            }
            rest = next;
        } else {
            output.push_str("{{");
            rest = tail;
            break;
        }
    }
    output.push_str(rest);
    output
}
fn unavailable() -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, Html(shell("Wiki vorübergehend nicht erreichbar", "<div class=\"wiki-error\"><p>Das Spielwissen ist gerade nicht erreichbar. Versuche es später erneut.</p><a href=\"/wiki/\">Erneut öffnen</a></div>", "", "", "nicht verfügbar", "https://deutsche-deadlock-community.de/wiki/"))).into_response()
}
fn invalid() -> Response {
    (StatusCode::BAD_REQUEST, Html(shell("Ungültige Suche", "<p class=\"wiki-error\">Die Suche darf höchstens 120 Zeichen enthalten. Wähle eine vorhandene Kategorie und eine Seite zwischen 1 und 10000.</p>", "", "", "", "https://deutsche-deadlock-community.de/wiki/"))).into_response()
}
fn sidebar(snapshot: &Snapshot, active: Option<&str>) -> String {
    let mut content = "<nav aria-label=\"Wiki-Bereiche\"><a class=\"wiki-category-link\" href=\"/wiki/\">Alles durchsuchen</a>".to_string();
    for (category, label) in CATEGORIES {
        let count = snapshot
            .entries
            .iter()
            .filter(|e| e.category == *category)
            .count();
        content.push_str(&format!(
            "<a class=\"wiki-category-link{}\" href=\"/wiki/{}/\">{} <span>{}</span></a>",
            if active == Some(category) {
                " is-active"
            } else {
                ""
            },
            category,
            label,
            count
        ));
    }
    content.push_str("</nav><section class=\"wiki-provenance\"><h2>Wissensstand</h2>");
    content.push_str(&format!(
        "<p>{} Quelleneinträge, zusammengefasst in {} Artikeln.</p>",
        snapshot.status["entries"].as_u64().unwrap_or(0),
        snapshot.entries.len()
    ));
    content.push_str(&format!(
        "<p>Spieldaten vom {}. Importiert am {}.</p>",
        date(
            snapshot
                .status
                .pointer("/provenance/deadlock_data/revisions")
                .and_then(Value::as_object)
                .and_then(|m| m.values().filter_map(Value::as_str).max())
        ),
        date(
            snapshot
                .status
                .pointer("/provenance/deadlock_data/latest_fetched_at")
                .and_then(Value::as_str)
        )
    ));
    content.push_str(&format!("<p>Ergänzende Wiki-Texte: Stand {}. Diese Texte können älter sein als die Spieldaten.</p></section>", date(snapshot.status.pointer("/provenance/deadlock_wiki/latest_fetched_at").and_then(Value::as_str))));
    content
}
async fn page(params: Params, category: Option<String>, detail: Option<String>) -> Response {
    let query = params.q.unwrap_or_default();
    let page_number = params.page.unwrap_or(1);
    let category = category.or(params.category.filter(|s| !s.is_empty()));
    if query.chars().count() > 120
        || query.chars().any(char::is_control)
        || !(1..=10000).contains(&page_number)
    {
        return invalid();
    }
    if category
        .as_deref()
        .is_some_and(|c| title_for_category(c).is_none())
    {
        return (
            StatusCode::NOT_FOUND,
            Html(shell(
                "Bereich nicht gefunden",
                "<p>Dieser Wiki-Bereich existiert nicht.</p><a href=\"/wiki/\">Zur Übersicht</a>",
                "",
                "",
                "",
                "https://deutsche-deadlock-community.de/wiki/",
            )),
        )
            .into_response();
    }
    if detail.as_ref().is_some_and(|slug| {
        slug.is_empty()
            || slug.len() > 200
            || !slug
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    }) {
        return (StatusCode::NOT_FOUND, Html(shell("Artikel nicht gefunden", "<h1>Artikel nicht gefunden</h1><p>Dieser Artikel existiert nicht.</p><a href=\"/wiki/\">Zur Übersicht</a>", "", "", "", "https://deutsche-deadlock-community.de/wiki/"))).into_response();
    }
    let snapshot = match tokio::task::spawn_blocking(load_snapshot).await {
        Ok(Ok(s)) => s,
        _ => return unavailable(),
    };
    let mut aside = sidebar(&snapshot, category.as_deref());
    let data_date = date(
        snapshot
            .status
            .pointer("/provenance/deadlock_data/latest_fetched_at")
            .and_then(Value::as_str),
    );
    let mut main = String::new();
    let title;
    let canonical;
    if let Some(detail) = detail {
        let Some(entry) = snapshot
            .entries
            .iter()
            .find(|e| Some(e.category.as_str()) == category.as_deref() && e.slug == detail)
        else {
            return (
                StatusCode::NOT_FOUND,
                Html(shell(
                    "Artikel nicht gefunden",
                    "<p>Dieser Artikel existiert nicht.</p><a href=\"/wiki/\">Zur Übersicht</a>",
                    &aside,
                    &query,
                    &data_date,
                    "https://deutsche-deadlock-community.de/wiki/",
                )),
            )
                .into_response();
        };
        title = entry.title.clone();
        canonical = format!("https://deutsche-deadlock-community.de{}", entry_url(entry));
        main.push_str(&format!("<nav class=\"wiki-breadcrumbs\" aria-label=\"Brotkrumennavigation\"><a href=\"/wiki/\">Wiki</a> / <a href=\"/wiki/{}/\">{}</a></nav><article class=\"wiki-article\">", entry.category, title_for_category(&entry.category).unwrap_or("Wissen")));
        main.push_str(&format!("<h1>{}</h1>", escape(&title)));
        main.push_str(&portrait_html(entry));
        aside = format!("<nav class=\"wiki-toc\" aria-label=\"Artikelinhalt\"><h2>In diesem Artikel</h2><a href=\"#werte\">Werte</a><a href=\"#spielwissen\">Spielwissen</a><a href=\"#quelle\">Quelle und Stand</a></nav>{aside}");
        main.push_str("<nav class=\"wiki-toc\" aria-label=\"Artikelabschnitte\"><a href=\"#werte\">Werte</a><a href=\"#spielwissen\">Spielwissen</a><a href=\"#quelle\">Quelle und Stand</a></nav>");
        main.push_str(&render_description(&entry.data));
        main.push_str("<section class=\"wiki-infobox\" id=\"werte\"><h2>Werte</h2>");
        main.push_str(&render_fields(
            entry.data.get("stats").unwrap_or(&entry.data),
        ));
        main.push_str(
            "</section><section class=\"wiki-section\" id=\"spielwissen\"><h2>Spielwissen</h2>",
        );
        if let Some(abilities) = entry.data.get("abilities").and_then(Value::as_array) {
            for ability in abilities {
                let data = ability.get("mechanics").unwrap_or(ability);
                let name = ability
                    .get("name")
                    .or_else(|| data.get("Name"))
                    .and_then(Value::as_str)
                    .unwrap_or("Fähigkeit");
                main.push_str(&format!(
                    "<section class=\"wiki-section\"><h2>{}</h2>{}{}{}</section>",
                    escape(name),
                    render_description(data),
                    render_fields(data),
                    render_nested(data, 0)
                ));
            }
        }
        main.push_str(&render_nested(&entry.data, 0));
        if let Some(card) = entry.data.get("card") {
            main.push_str(&format!(
                "<section class=\"wiki-section\"><h2>Weitere Werte</h2>{}{}</section>",
                render_fields(card),
                render_nested(card, 0)
            ));
        }
        if entry.kind == "wiki_page" {
            let text = entry
                .data
                .pointer("/query/pages")
                .and_then(Value::as_object)
                .map(|pages| {
                    pages
                        .values()
                        .filter_map(|p| p.get("extract").and_then(Value::as_str))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_default();
            if !text.is_empty() {
                main.push_str(&format!(
                    "<p>Originaltext des Deadlock Wiki; Stand {}.</p>{}",
                    date(entry.fetched_at.as_deref()),
                    original_text(&text)
                ));
            }
        }
        main.push_str(&format!("<details class=\"wiki-section\"><summary>Alle strukturierten Spielwerte</summary><pre>{}</pre></details>", escape(&serde_json::to_string_pretty(&public_data(&entry.data)).unwrap_or_default())));
        main.push_str("</section>");
        main.push_str(&format!(
            "<section class=\"wiki-source\" id=\"quelle\"><h2>Quelle und Stand</h2><p>Abgerufen am {}.</p>",
            date(entry.fetched_at.as_deref())
        ));
        if let Some(url) = &entry.source_url {
            main.push_str(&format!(
                "<a href=\"{}\" rel=\"noopener noreferrer\">Originalquelle öffnen</a>",
                escape(url)
            ));
        }
        main.push_str("</section></article>");
    } else {
        title = category
            .as_deref()
            .and_then(title_for_category)
            .unwrap_or("Deadlock Wiki")
            .into();
        canonical = format!(
            "https://deutsche-deadlock-community.de/wiki/{}",
            category
                .as_ref()
                .map(|c| format!("{c}/"))
                .unwrap_or_default()
        );
        main.push_str(&format!("<h1>{}</h1>", escape(&title)));
        if category.is_none() && query.is_empty() && page_number == 1 {
            main.push_str("<section class=\"wiki-hero\"><p class=\"wiki-kicker\">Das Wissen zum Spiel</p><p class=\"wiki-lead\">Schlag Helden, Fähigkeiten und Items nach. Finde Werte, Wirkungen und frühere Änderungen an einem Ort.</p><div class=\"wiki-grid wiki-category-grid\">");
            for (key, label) in CATEGORIES {
                let count = snapshot
                    .entries
                    .iter()
                    .filter(|e| e.category == *key)
                    .count();
                main.push_str(&format!("<a class=\"wiki-card\" href=\"/wiki/{key}/\"><h2>{label}</h2><p class=\"wiki-category-count\">{count} Einträge</p></a>"));
            }
            main.push_str("</div></section><h2>Alle Einträge</h2>");
            main.push_str("<section class=\"wiki-section\"><h2>Helden entdecken</h2><div class=\"wiki-hero-gallery\">");
            for entry in snapshot
                .entries
                .iter()
                .filter(|e| e.category == "helden" && portrait(e).is_some())
                .take(12)
            {
                main.push_str(&format!(
                    "<a class=\"wiki-card wiki-portrait-card\" href=\"{}\">{}<h3>{}</h3></a>",
                    entry_url(entry),
                    portrait_html(entry),
                    escape(&entry.title)
                ));
            }
            main.push_str("</div><a href=\"/wiki/helden/\">Alle Helden ansehen</a></section>");
        }
        let terms = query
            .to_lowercase()
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let found = snapshot
            .entries
            .iter()
            .filter(|e| category.as_ref().is_none_or(|c| c == &e.category))
            .filter(|e| terms.iter().all(|t| e.search_text.contains(t)))
            .collect::<Vec<_>>();
        main.push_str(&format!(
            "<p class=\"wiki-result-count\">{} Einträge{}</p>",
            found.len(),
            if query.is_empty() {
                String::new()
            } else {
                format!(" für „{}“", escape(&query))
            }
        ));
        if found.is_empty() {
            main.push_str("<p class=\"wiki-empty\">Keine passenden Einträge gefunden. Versuche einen Heldennamen, Itemnamen oder eine Fähigkeit.</p>");
        }
        main.push_str("<div class=\"wiki-grid\">");
        for entry in found.iter().skip((page_number - 1) * 36).take(36) {
            let summary = description(&entry.data)
                .map(|(s, _)| s.chars().take(145).collect::<String>())
                .unwrap_or_default();
            main.push_str(&format!("<a class=\"wiki-card{}\" href=\"{}\">{}<h2 class=\"wiki-card-title\">{}</h2><p class=\"wiki-card-meta\">{}</p><p>{}</p></a>",if entry.category == "helden" { " wiki-portrait-card" } else { "" },entry_url(entry),portrait_html(entry),escape(&entry.title),title_for_category(&entry.category).unwrap_or("Wissen"),escape(&summary)));
        }
        main.push_str("</div><nav class=\"wiki-pagination\" aria-label=\"Ergebnisseiten\">");
        let base = category
            .as_ref()
            .map(|c| format!("/wiki/{c}/"))
            .unwrap_or_else(|| "/wiki/".into());
        let encoded = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("q", &query)
            .finish();
        if page_number > 1 {
            main.push_str(&format!(
                "<a href=\"{}?{}&amp;page={}\">Vorherige Seite</a>",
                base,
                escape(&encoded),
                page_number - 1
            ));
        }
        if page_number * 36 < found.len() {
            main.push_str(&format!(
                "<a href=\"{}?{}&amp;page={}\">Nächste Seite</a>",
                base,
                escape(&encoded),
                page_number + 1
            ));
        }
        main.push_str("</nav>");
    }
    Html(shell(&title, &main, &aside, &query, &data_date, &canonical)).into_response()
}
pub async fn index(Query(params): Query<Params>) -> Response {
    page(params, None, None).await
}
pub async fn category_page(Path(category): Path<String>, Query(params): Query<Params>) -> Response {
    page(params, Some(category), None).await
}
pub async fn article(
    Path((category, slug)): Path<(String, String)>,
    Query(params): Query<Params>,
) -> Response {
    page(params, Some(category), Some(slug)).await
}
pub async fn stylesheet() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "text/css; charset=utf-8")], CSS)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_markup_is_text_and_links_are_checked() {
        assert_eq!(
            escape(&clean_text(
                "<img src=x onerror=alert(1)>Hallo <span>Welt</span>"
            )),
            " Hallo  Welt "
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        );
        assert!(safe_url("javascript:alert(1)").is_none());
        assert!(safe_url("//example.org").is_none());
        assert_eq!(
            escape("{{MAIN_CONTENT}}<script>"),
            "{{MAIN_CONTENT}}&lt;script&gt;"
        );
        assert!(shell(
            "{{MAIN_CONTENT}}",
            "SAFE",
            "",
            "",
            "",
            "https://example.org"
        )
        .contains("{{MAIN_CONTENT}}"));
    }
    #[test]
    fn malformed_payloads_and_private_metadata_are_rejected() {
        let shard = "<!-- game-wiki-entry source=\"deadlock_data\" entity_type=\"hero\" external_id=\"hero_atlas\" title=\"Abrams\" -->\n````json\n42\n````";
        assert!(parse_shard(shard).is_err());
        let projected = public_data(
            &serde_json::json!({"Name":"Abrams", "_deadlock_data":{"raw_path":"PRIVATE"},"nested":{"source_raw_path":"PRIVATE","Value":25}}),
        );
        assert!(!projected.to_string().contains("PRIVATE"));
        assert!(render_fields(&serde_json::json!({"Key":"BonusFireRate","Value":25,"UsageFlags":"ConditionallyApplied"})).contains("Feuerrate (%)"));
        assert!(
            original_text("== Mechanik ==\n\nEin <script>feindlicher</script> Text")
                .contains("<h3>Mechanik</h3>")
        );
    }
    #[tokio::test]
    #[ignore = "Live-Abnahme benötigt den veröffentlichten Brain-Snapshot auf diesem Host"]
    async fn render_live_articles_and_search() {
        use axum::body::to_bytes;
        let dir = std::env::temp_dir().join("ddc-wiki-live-abnahme");
        fs::create_dir_all(&dir).expect("Abnahmeordner");
        let snapshot = load_snapshot().expect("Brain-Snapshot");
        for (name, category) in [
            ("Abrams", "helden"),
            ("Warden", "helden"),
            ("Active Reload", "items"),
            ("Ability", "mechaniken"),
        ] {
            let entry = snapshot
                .entries
                .iter()
                .find(|e| e.title == name && e.category == category)
                .expect("echter Artikel");
            let response = page(
                Params::default(),
                Some(category.into()),
                Some(entry.slug.clone()),
            )
            .await;
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = to_bytes(response.into_body(), 8 * 1024 * 1024)
                .await
                .expect("Artikelbody");
            let html = String::from_utf8(bytes.to_vec()).expect("HTML");
            assert!(html.contains(&format!("<h1>{name}</h1>")));
            assert!(!html.contains("/home/nathanael"));
            assert!(html.contains("id=\"quelle\""));
            if category == "helden" {
                assert!(html.contains("Lebenspunkte"));
            }
            if name == "Ability" {
                assert!(html.contains("An ability is a unique skill"));
            }
            fs::write(dir.join(format!("{}.html", slug(name))), html).expect("Abnahme-HTML");
        }
        let response = page(
            Params {
                q: Some("Warden".into()),
                ..Default::default()
            },
            None,
            None,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let html = String::from_utf8(
            to_bytes(response.into_body(), 8 * 1024 * 1024)
                .await
                .expect("Suchbody")
                .to_vec(),
        )
        .expect("HTML");
        assert!(html.contains("Warden"));
        fs::write(dir.join("suche.html"), html).expect("Such-HTML");
        let response = page(Params::default(), None, None).await;
        let html = String::from_utf8(
            to_bytes(response.into_body(), 8 * 1024 * 1024)
                .await
                .expect("Startbody")
                .to_vec(),
        )
        .expect("HTML");
        assert!(html.contains("wiki-hero-gallery"));
        assert!(html.contains("Nächste Seite"));
        fs::write(dir.join("index.html"), html).expect("Start-HTML");
        let response = page(
            Params {
                page: Some(2),
                ..Default::default()
            },
            None,
            None,
        )
        .await;
        let html = String::from_utf8(
            to_bytes(response.into_body(), 8 * 1024 * 1024)
                .await
                .expect("Seite-2-Body")
                .to_vec(),
        )
        .expect("HTML");
        assert!(html.contains("Vorherige Seite"));
        fs::write(dir.join("seite-2.html"), html).expect("Seite-2-HTML");
    }
    #[test]
    #[ignore = "Live-Abnahme benötigt den veröffentlichten Brain-Snapshot auf diesem Host"]
    fn real_snapshot_is_consistent_and_has_current_hero_data() {
        let snapshot = load_snapshot().expect("aktuellen Brain-Snapshot lesen");
        assert_eq!(snapshot.status["state"], "ready");
        let abrams = snapshot
            .entries
            .iter()
            .find(|e| e.kind == "hero_dossier" && e.title == "Abrams")
            .expect("Abrams");
        assert!(abrams.data["abilities"]
            .as_array()
            .is_some_and(|a| a.len() >= 4));
        assert!(abrams.data["stats"].is_object());
        assert!(snapshot.entries.iter().any(|e| e.category == "items"));
        assert!(snapshot.entries.iter().all(|e| !e.slug.contains('/')
            && e.source_url.as_ref().is_none_or(|u| safe_url(u).is_some())));
    }
    #[tokio::test]
    async fn excessive_queries_and_unknown_paths_fail() {
        assert_eq!(
            page(
                Params {
                    q: Some("x".repeat(121)),
                    ..Default::default()
                },
                None,
                None
            )
            .await
            .status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            page(Params::default(), Some("../private".into()), None)
                .await
                .status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            page(
                Params::default(),
                Some("helden".into()),
                Some("../private".into())
            )
            .await
            .status(),
            StatusCode::NOT_FOUND
        );
    }
}
