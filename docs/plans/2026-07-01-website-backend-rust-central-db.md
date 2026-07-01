# Website-Backend Rust Central-DB-Plan

Datum: 2026-07-01

## Ziel und Grenzen

Ziel ist die Korrektur des vorherigen Fehlplans: Der live gestartete Dienst
`deadlock-website-backend.service` nutzt standardmaessig das Rust-Binary
`builds/backend-rust/target/release/ddc-website-backend`. Der Python-Code unter
`builds/backend` bleibt nur Fallback und ist nicht Ziel dieser Umsetzung.

Dieser Plan beschreibt die spaetere Umstellung von `builds/backend-rust` von
lokaler SQLite-Datei `builds/backend/deadlock.db` auf die zentrale
TimescaleDB/Postgres-Instanz aus `central-postgres-sp1`.

Nicht Teil dieses Planungsschritts:

- keine Live-Service-Aenderung,
- kein Neustart,
- kein Datenbank-Schreibzugriff,
- kein Ausgeben oder Persistieren von Secrets,
- keine Aenderung am bestehenden Python-Fallback-Plan
  `docs/plans/2026-07-01-website-backend-central-db.md`.

## Quellen

Gelesene Quellen fuer diesen Plan:

- `WORKFLOW.md`
- `docs/plans/2026-07-01-website-backend-central-db.md`
- `/home/naniadm/Documents/Deadlock-Bots/rust/docs/_work/sp1/data-landscape.md`
- `/home/naniadm/Documents/Deadlock-Bots/rust/docs/plans/2026-06-30-sp1-phase3-consumer-rewrites.md`
- `/home/naniadm/Documents/Deadlock-Bots/rust/crates/dl-central-db/src/{lib.rs,pool.rs}`
- `/home/naniadm/Documents/Deadlock-Bots/rust/crates/dl-central-db/migrations/0001-0011`
- `builds/backend-rust/{Cargo.toml,README.md}`
- `builds/backend-rust/src/{main.rs,config.rs,app.rs,db.rs,auth.rs,rows.rs}`
- `builds/backend-rust/src/routes/{auth,coaching,meta,platform}.rs`
- `scripts/run_builds_backend.sh`

## Ausgangslage

- `scripts/run_builds_backend.sh` startet bei `WEBSITE_BACKEND_IMPL` Default
  `rust` das Binary `builds/backend-rust/target/release/ddc-website-backend`.
- `builds/backend-rust/Cargo.toml` nutzt `sqlx` aktuell nur mit Feature
  `sqlite`.
- `src/app.rs` haelt `sqlx::SqlitePool` im `AppState`.
- `src/db.rs` oeffnet `DB_PATH`, setzt SQLite-PRAGMAs, fuehrt DDL aus, ergaenzt
  Legacy-Spalten via `ALTER TABLE` und seedet Beispieldaten.
- `src/main.rs` loggt aktuell `db_path`.
- `src/rows.rs`, `routes/meta.rs` und `routes/coaching.rs` sind an
  `SqliteRow` gebunden.
- `routes/platform.rs` enthaelt dynamische SQLite-Updates mit `?`-Parametern
  und `sqlx::Sqlite`-Argumenttypen.
- Betroffene produktive DB-Routen liegen in:
  `src/auth.rs`, `src/routes/auth.rs`, `src/routes/meta.rs`,
  `src/routes/coaching.rs`, `src/routes/platform.rs`.

## Zentrales Schema

Die Website-Tabellen werden wie folgt auf zentrale Schemas gemappt:

| Bereich | SQLite / Rust-Code | Zentral |
|---|---|---|
| Auth/Admin | `meta_users` | `core.meta_users` |
| Heroes | `meta_heroes` | `tierlist.meta_heroes` |
| Builds | `meta_builds` | `tierlist.meta_builds` |
| Items | `meta_items` | `tierlist.meta_items` |
| Tierlists | `meta_tier_lists` | `tierlist.meta_tier_lists` |
| Votes | `meta_votes` | `tierlist.meta_votes` |
| Tier history | `meta_tier_history` | `tierlist.meta_tier_history` |
| Reports | `meta_reports` | `content.meta_reports` |
| Announcements | `meta_announcements` | `content.meta_announcements` |
| Patchnotes | `meta_patch_notes` | `patchnotes.meta_patch_notes` |
| Coaches | `coaches` | `coaching.coaches` |
| Coach reviews | `coach_reviews` | `coaching.coach_reviews` |
| Coaching requests | `coaching_requests` | `coaching.requests` |
| Coaching sessions | `coaching_sessions` | `coaching.sessions` |
| Coaching surveys | `coaching_surveys` | `coaching.surveys` |
| Coach applications | `coach_applications` | `coaching.coach_applications` |
| Coachees | `coachees` | `coaching.coachees` |
| Goals | `coaching_goals` | `coaching.goals` |
| Milestones | `coaching_milestones` | `coaching.milestones` |
| Session notes | `session_notes` | `coaching.session_notes` |
| Appointments | `coaching_appointments` | `coaching.appointments` |

Wichtige Spalten-/Typregeln:

- `core.meta_users.id` ist `BIGINT`; Website-User-IDs muessen beim DB-Zugriff
  als Discord-Snowflake nach `i64` geparst werden.
- `coaching.requests` nutzt `request_uid` als Primaerschluessel plus
  `website_request_id` und `bot_request_id`. API-Responses duerfen weiter `id`
  liefern, muessen intern aber ueber diese drei Felder sauber abbilden.
- Website-originierte Coaching-Requests setzen `request_uid` und
  `website_request_id`. Empfohlene Semantik: `request_uid == website_request_id`
  fuer neue Website-Writes, sofern ein read-only Check der migrierten Central-DB
  nichts Gegenteiliges zeigt.
- Bot-originierte Requests ohne Website-ID nutzen `bot_request_id` und einen
  kollisionsfreien `request_uid`, z.B. `bot:{bot_request_id}`.
- `coaching.sessions.request_id` aus der alten API wird intern zu
  `coaching.sessions.request_uid`; `website_request_id` und `bot_request_id`
  werden als Kompatibilitaetsspalten mitgefuehrt.
- JSON-Textfelder werden als `JSONB` geschrieben/gelesen:
  `abilities_json -> abilities`, `stats_json -> stats`,
  `ability_order_json -> ability_order`, `items_json -> items`,
  `tiers_json -> tiers`. Coaching-Felder wie `specialties_json`,
  `availability_json`, `main_heroes_json` behalten den Namen, sind aber `JSONB`.
- Booleans sind echte `BOOLEAN`: `is_public`, `is_active`,
  `would_recommend`, `achieved`.
- Zeiten sind `TIMESTAMPTZ`, `target_date` ist `DATE`. Besonders
  `reserved_until` darf nicht laenger als Integer-Epoch geschrieben werden.
- Alle produktiven Queries verwenden voll qualifizierte Tabellen
  (`schema.table`), kein `search_path`.
- Startup darf gegen Central keine DDL, keine `ALTER TABLE`s und keine Seed-Daten
  schreiben.

## Architekturentscheidung

Rust wird direkt auf `sqlx::PgPool` portiert. Die vorhandene SQLite-Abstraktion
wird nicht als generischer Kompatibilitaetsadapter umgebogen.

Zielzustand:

- `sqlx`-Features in `builds/backend-rust/Cargo.toml`: `postgres`,
  `runtime-tokio-rustls`, `chrono`, `json`, `macros`; `sqlite` entfernen.
- `dl-central-db` aus dem Schwester-Repo als Pfad-Dependency wiederverwenden,
  voraussichtlich:
  `../../../Deadlock-Bots/rust/crates/dl-central-db`.
- Pool-Aufbau ueber `dl_central_db::{dsn_from_env, connect_pool}`.
- `DEADLOCK_CENTRAL_DSN` ist Pflicht fuer Rust-Prod-Start. Der Wert wird nie
  geloggt.
- `Config.db_path` wird fuer Rust-Prod entfernt oder auf Legacy-Fallback-Doku
  begrenzt; `main.rs` loggt keinen DB-Pfad mehr.
- Statische Queries werden bevorzugt mit `sqlx::query!`/`query_as!` umgesetzt.
- Wo dynamische Updates wegen whitelisted Feldern bleiben muessen, wird
  `sqlx::QueryBuilder<Postgres>` mit explizit typisierten Bindings verwendet.
  Kein globaler `?`-zu-`$n`-Stringkonverter.
- `rows.rs` wird von `SqliteRow` auf `PgRow` umgestellt und lernt `JSONB`,
  `BOOLEAN`, `TIMESTAMPTZ` und `DATE` API-kompatibel zu serialisieren.

## DAG

```
T0 Safety/Baseline
  |
  v
T1 Cargo + Pool + Config
  |
  v
T2 Row/JSON/Time Adapter
  |
  +--> T3 Auth/Core
  |
  +--> T4 Meta/Tierlist/Content/Patchnotes
  |
  +--> T5 Coaching Public
          |
          v
        T6 Coaching Platform Sync + ID-Semantik
          |
          v
        T7 Coaching Platform Workspace
  |
  v
T8 Tests + SQLX Offline/Compile Gate
  |
  v
T9 Runtime/Docs/Cutover-Runbook
  |
  v
T10 Review Gate + optionale Live-Freigabe
```

T0-T9 sind Code-/Dokuarbeit ohne Service-Neustart. T10 ist ein Review-Gate; der
eigentliche Live-Restart ist ein separater Freigabeschritt.

## Tickets

### T0 - Safety/Baseline

Dateien:

- `builds/backend-rust/src/**/*.rs`
- `builds/backend-rust/Cargo.toml`
- `scripts/run_builds_backend.sh`
- `builds/backend-rust/README.md`

Aufgaben:

- Alle produktiven SQLite-Sites per `rg` inventarisieren:
  `Sqlite`, `sqlite`, `PRAGMA`, `DB_PATH`, `CREATE TABLE`, `ALTER TABLE`,
  `meta_`, `coaching_`, `coaches`, `session_notes`.
- Eindeutig markieren, welche bestehenden uncommitted Dateien ausserhalb des
  Scopes liegen und nicht beruehrt werden.
- Keine Live-DB und keine Dienste anfassen.

Akzeptanz:

- Inventar ist im Implementierungs-PR nachvollziehbar.
- Keine Aenderung an Python-Fallback-Dateien, ausser spaeter explizit
  freigegeben.

### T1 - Cargo, Pool, Config

Abhaengig von: T0

Dateien:

- `builds/backend-rust/Cargo.toml`
- `builds/backend-rust/Cargo.lock`
- `builds/backend-rust/src/config.rs`
- `builds/backend-rust/src/db.rs`
- `builds/backend-rust/src/app.rs`
- `builds/backend-rust/src/main.rs`

Aufgaben:

- `sqlx` auf Postgres-Features umstellen.
- `dl-central-db` als lokale Pfad-Dependency einhaengen.
- `AppState.pool` auf `sqlx::PgPool` umstellen.
- `db::connect()` durch Central-Pool-Aufbau aus `DEADLOCK_CENTRAL_DSN`
  ersetzen.
- `db::init()` auf read-only Smoke-Check reduzieren oder entfernen.
- SQLite-DDL, `PRAGMA`, `ALTER TABLE` und Seed-Daten aus dem Rust-Startup
  entfernen.
- `db_path` aus Runtime-Logging entfernen.

Akzeptanz:

- Start ohne `DEADLOCK_CENTRAL_DSN` scheitert klar, ohne Secret-Wert.
- Rust-Prod-Code kann keine lokale SQLite-Datei mehr erstellen.
- Kein Startup-DDL gegen Central.

### T2 - Row/JSON/Time Adapter

Abhaengig von: T1

Dateien:

- `builds/backend-rust/src/rows.rs`
- ggf. neue kleine Helper-Module unter `builds/backend-rust/src/`
- `routes/{meta,coaching,platform}.rs`

Aufgaben:

- `SqliteRow` durch `PgRow` ersetzen.
- `rows::value_from_row` fuer `i64`, `f64`, `bool`, `String`,
  `serde_json::Value`, `chrono::DateTime<Utc>` und `chrono::NaiveDate`
  erweitern.
- JSONB-Werte in API-Responses als Objekt/Array erhalten, nicht als
  JSON-String doppelt encoden.
- Kompatibilitaetsalias erhalten:
  `abilities_json`, `stats_json`, `ability_order_json`, `items_json`,
  `tiers_json` bleiben in API-Responses verfuegbar, auch wenn Central andere
  Spaltennamen nutzt.
- `bind_json` fuer Postgres neu schreiben: JSON-Objekte/Arrays als JSONB,
  Booleans als Boolean, RFC3339-Zeitpunkte als `DateTime<Utc>` wo erwartet.

Akzeptanz:

- Keine Referenz auf `sqlx::sqlite` bleibt.
- API-JSON bleibt fuer Frontend/Bot kompatibel.

### T3 - Auth/Core

Abhaengig von: T2

Dateien:

- `builds/backend-rust/src/auth.rs`
- `builds/backend-rust/src/routes/auth.rs`
- `builds/backend-rust/src/routes/meta.rs` fuer Admin-User-Routen

Aufgaben:

- `meta_users` auf `core.meta_users` qualifizieren.
- Discord-ID-Strings vor DB-Zugriff nach `i64` parsen; invalid IDs klar
  ablehnen oder nicht DB-basiert behandeln.
- `auth::upsert_meta_user` als Postgres-Upsert schreiben:
  `INSERT ... ON CONFLICT (id) DO UPDATE`.
- Rolle beim Upsert erhalten, analog bisherigem Verhalten.
- `is_active_coach` auf `coaching.coaches` qualifizieren.
- Admin-User-Listen und Rollenupdates auf `core.meta_users` portieren.

Akzeptanz:

- Login/Callback kann User anlegen/aktualisieren.
- Rollen bleiben erhalten.
- Coach-Erkennung nutzt Central.

### T4 - Meta/Tierlist/Content/Patchnotes

Abhaengig von: T2

Status: umgesetzt am 2026-07-01. Verifikation: Build, Clippy und Fmt gruen;
keine Meta-Routentests vorhanden.

Dateien:

- `builds/backend-rust/src/routes/meta.rs`

Aufgaben:

- Tabellen qualifizieren:
  `tierlist.meta_heroes`, `tierlist.meta_builds`, `tierlist.meta_items`,
  `tierlist.meta_tier_lists`, `tierlist.meta_votes`,
  `tierlist.meta_tier_history`, `content.meta_reports`,
  `content.meta_announcements`, `patchnotes.meta_patch_notes`.
- JSONB-Spalten korrekt binden:
  `abilities`, `stats`, `ability_order`, `items`, `tiers`.
- Reads mit API-kompatiblen Aliasen formulieren, z.B.
  `abilities AS abilities_json`, `tiers AS tiers_json`.
- `is_public` und `is_active` als Boolean behandeln, nicht `0/1`.
- Joins voll qualifizieren, z.B. Reports gegen `tierlist.meta_builds`.
- Dynamische Vote-Up/Down-Updates durch zwei explizite Query-Zweige ersetzen.

Akzeptanz:

- Keine unqualifizierte `meta_*`-Tabelle bleibt in `meta.rs`.
- JSONB/Boolean-Reads liefern API-kompatible Responseformen.

### T5 - Coaching Public

Abhaengig von: T2 und T3

Status: umgesetzt am 2026-07-01, Kritiker-Pass ohne ID-Semantik-Befund.
Verifikation: Build, Clippy, Fmt und Wegwerf-Postgres-Testlauf gruen.

Dateien:

- `builds/backend-rust/src/routes/coaching.rs`

Aufgaben:

- `coaches`, `coach_reviews`, `coach_applications`, `coaching_requests`,
  `coaching_sessions`, `coaching_surveys` auf `coaching.*` qualifizieren.
- Spezialitaetssuche von `LIKE` auf Postgres-kompatibel portieren:
  kurzfristig `specialties_json::text ILIKE $1`, spaeter optional JSONB-Containment.
- Coach-/Application-Upserts mit JSONB fuer `specialties_json` und
  `availability_json`.
- Neue Website-Coaching-Requests in `coaching.requests` schreiben:
  `request_uid`, `website_request_id`, `discord_user_id`, gemeinsame Felder,
  `preferred_coach_id`, `ai_insights_json`, `status='pending'`.
- `request_from_row` so aliasen, dass externe `id` weiter funktioniert.
- `would_recommend` als Boolean schreiben.
- `CURRENT_TIMESTAMP` durch `now()` oder Rust-`DateTime<Utc>` konsistent
  ersetzen.

Akzeptanz:

- Public Coaching-API erzeugt keine SQLite-IDs/Spalten mehr.
- Neue Website-Requests sind in Central eindeutig und bot-kompatibel auffindbar.

### T6 - Coaching Platform Sync + ID-Semantik

Status (2026-07-02): erledigt.

Abhaengig von: T5

Dateien:

- `builds/backend-rust/src/routes/platform.rs`

Teilstatus (2026-07-01): `notifications_due`/`notifications_ack` bereits auf
`coaching.requests` portiert. Ein frischer Kritiker fand dabei einen echten
Cross-System-ID-Bug (Bot-only-Requests wurden als vermeintliche
Website-Requests dupliziert, da `request_created` jede Zeile meldete statt
nur website-originierte; `notifications_ack` matchte ueber drei ID-Spalten
ohne Cross-Column-Unique-Constraint). Gefixt: `request_created` meldet nur
noch Zeilen mit `website_request_id IS NOT NULL`, Ack matcht ausschliesslich
`website_request_id`. Mit Regressionstests belegt (Bot-Request unsichtbar im
Notification-Feed; Ack trifft bei ID-Kollision nur die Website-Zeile).

Abschluss (2026-07-02): Rest-T6 umgesetzt. `platform_sync`,
Overview/Queue/Coachees, Goals/Milestones/Notes,
My-/Coaches-/Appointments-/Profil-Endpunkte sowie die dynamischen
Update-Helper nutzen jetzt qualifizierte `coaching.*`-Tabellen und
Postgres-Parameter. `platform_sync` matcht Request-Referenzen in der
Reihenfolge `website_request_id`, `bot_request_id`, `request_uid`, legt
Bot-only-Requests als `bot:{bot_request_id}` an, schreibt Sessions mit
`request_uid`/`website_request_id`/`bot_request_id` statt alter
`request_id`-Spalte und normalisiert `reserved_until` aus Epoch oder
RFC3339 nach `DateTime<Utc>`. Queue-Responses liefern `reserved_until`
weiter als Epoch.

Aufgaben:

- `platform_sync` auf `coaching.requests` und `coaching.sessions` portieren.
- Matching-Reihenfolge festlegen:
  1. `website_request_id`, wenn vorhanden,
  2. `bot_request_id`, wenn vorhanden,
  3. `request_uid`.
- Bot-only Requests ohne Website-ID mit kollisionsfreiem `request_uid` anlegen.
- Sessions mit `request_uid`, `website_request_id` und `bot_request_id`
  schreiben, nicht mit alter Spalte `request_id`.
- `reserved_until` aus Bot-Payload als `TIMESTAMPTZ` normalisieren:
  Integer-Epoch und RFC3339-String akzeptieren, intern `DateTime<Utc>`.
- Queue-Responses bei Bedarf weiter mit API-Feld `reserved_until` als Epoch
  liefern, damit bestehende Frontend-Logik nicht bricht.
- `notifications_due` und `notifications_ack` auf `request_uid`/
  `website_request_id` umstellen und `preferred_coach_id` ohne
  `table_columns()`-Fallback lesen.

Akzeptanz:

- Bot- und Website-Requests werden nicht dupliziert.
- Notification-Ack markiert die richtige zentrale Request-Zeile.
- Belegt durch Central-Postgres-Integrationstests fuer Bot-Request-Anlage/
  Update, Session-Sync mit Epoch/RFC3339-`reserved_until` und
  Goals/Milestones/Notes/Appointments-Smoke.

### T7 - Coaching Platform Workspace

Abhaengig von: T6

Dateien:

- `builds/backend-rust/src/routes/platform.rs`

Aufgaben:

- Restliche Plattformtabellen qualifizieren:
  `coaching.coachees`, `coaching.goals`, `coaching.milestones`,
  `coaching.session_notes`, `coaching.appointments`, `coaching.coaches`.
- `update_known_fields`, `run_update`, `run_update_by_i64` auf
  `QueryBuilder<Postgres>` und feste Table-/Column-Whitelists umbauen.
- `main_heroes_json` als JSONB schreiben.
- `target_date` als `DATE` parsen.
- `achieved` als Boolean schreiben.
- Appointment-Zeiten als `DateTime<Utc>` schreiben und vergleichen.
- Dynamische `NOT IN`-Liste in `coaches_sync` mit `QueryBuilder<Postgres>`
  typsicher binden.

Akzeptanz:

- Keine dynamischen SQLite-`?`-Updates bleiben.
- Alle Plattform-Workflows schreiben Central-typkonform.

Status (2026-07-02): erledigt. Platform-Update-Helfer nutzen
`QueryBuilder<Postgres>` mit festen Table-/Column-Whitelists; JSONB, DATE,
Boolean und TIMESTAMPTZ werden typisiert gebunden, `coaches_sync` bindet
`NOT IN` typsicher.

### T8 - Tests + SQLX Gate

Abhaengig von: T4 und T7

Dateien:

- bestehende Tests in `builds/backend-rust/src/app.rs`
- neue Tests unter `builds/backend-rust/tests/` falls sinnvoll
- `.sqlx/` oder dokumentierter Offline-Cache, falls im Repo gewollt

Aufgaben:

- Tests von Temp-SQLite-Datei auf echte Wegwerf-Postgres-Test-DB oder
  klar getrennten Test-DSN umstellen.
- Produktions-DSN nicht fuer schreibende Tests verwenden.
- Mindestens abdecken:
  - Auth-Upsert erhaelt Rolle,
  - Hero/Build JSONB Roundtrip,
  - Website-Coaching-Request erzeugt `request_uid`/`website_request_id`,
  - `platform_sync` ist idempotent fuer `bot_request_id`,
  - Appointment Notification due/ack,
  - Boolean-Felder `is_public`, `would_recommend`, `achieved`,
  - `reserved_until` und `scheduled_at` Zeittypen.
- `cargo fmt --check`
- `cargo check`
- `cargo test`
- `cargo clippy --all-targets -- -D warnings`
- `cargo build --release`

Akzeptanz:

- Tests laufen ohne Zugriff auf produktive Central-Daten.
- `SQLX_OFFLINE=true cargo check` ist moeglich, sofern Offline-Cache genutzt wird.

Status (2026-07-02): erledigt. Wegwerf-Postgres-Testlauf via
`central_test_db.sh` mit explizitem Backend-`cd` gruen; 14 Rust-Tests decken
Auth-Rollenerhalt, JSONB, Request-IDs, Platform-Sync-Idempotenz,
Appointment-Due/Ack, Boolean- und Zeittyp-Roundtrips ab. `fmt`, `check`,
`clippy`, `release build` und `SQLX_OFFLINE=true cargo check` gruen.

### T9 - Runtime/Docs/Cutover-Runbook

Abhaengig von: T8

Dateien:

- `builds/backend-rust/README.md`
- `scripts/run_builds_backend.sh`
- ggf. neues Runbook unter `docs/`

Aufgaben:

- README von SQLite-`DB_PATH` auf Central-Postgres aktualisieren.
- Wrapper pruefen: Infisical exportiert `DEADLOCK_CENTRAL_DSN`, aber der Wert
  wird nie ausgegeben.
- Optionaler Readiness-Smoke: nur Counts/Booleans loggen, keine DSN.
- Rollback-Doku: `WEBSITE_BACKEND_IMPL=python` bleibt Fallback, aber Python ist
  nicht Ziel der Central-Rust-Umsetzung.
- Cutover-Befehl erst nach Review:
  `systemctl --user restart deadlock-website-backend.service`.

Akzeptanz:

- Runtime-Doku beschreibt den tatsaechlichen Rust-Default.
- Kein Secret steht in Unit-Dateien, Doku oder Logs.

### T10 - Review Gate + optionale Live-Freigabe

Abhaengig von: T9

Aufgaben:

- Separater Review der geaenderten Rust-Dateien.
- Read-only Central-Checks vor Live-Freigabe:
  - erwartete Schemas/Tabellen vorhanden,
  - Website-Tabellen haben erwartete Row-Counts oder bewusst dokumentierte Diffs,
  - keine neuen Writes in `builds/backend/deadlock.db` seit letztem Snapshot,
  - `coaching.requests` enthaelt keine offensichtlichen Duplikate zwischen
    `request_uid`, `website_request_id`, `bot_request_id`.
- Erst nach Review und Freigabe: Build deployen und User-Service neu starten.

Akzeptanz:

- Keine Live-Aenderung vor expliziter Freigabe.
- Rollback-Pfad ist dokumentiert.

## Kritiker-Checkliste

- Jede Tabelle ist voll qualifiziert und dem Mapping oben entsprechend.
- Keine `SqlitePool`, `SqliteRow`, `sqlx::Sqlite`, `PRAGMA`, `DB_PATH`-Prod-Nutzung
  bleibt im Rust-Backend.
- Keine Startup-DDL/Seed-Daten gegen Central.
- Keine Secret-Werte in Logs, Fehlern, Doku oder Tests.
- `request_uid`/`website_request_id`/`bot_request_id` verhindern Duplikate.
- JSONB wird nicht doppelt als String encodiert.
- Booleans sind Booleans, keine `0/1`-Vergleiche.
- `TIMESTAMPTZ`/`DATE` werden mit chrono-Typen behandelt, nicht als freie Strings.
- Dynamische SQL-Stellen haben Whitelists und typed Bindings.
- Tests schreiben nie in produktive Central-DB.

## Offene Punkte fuer Review

- Bestaetigen, ob neue Website-Requests `request_uid == website_request_id`
  nutzen sollen oder ob die ETL bereits ein anderes Prefix-/UID-Format gesetzt
  hat.
- Entscheiden, ob `dl-central-db` als Cross-Repo-Pfad-Dependency akzeptiert ist
  oder ob ein kleines lokales Central-Pool-Modul bevorzugt wird.
- Festlegen, wo der `sqlx` Offline-Cache fuer `builds/backend-rust` liegen soll.
- Festlegen, welche lokale Test-Postgres-Instanz fuer schreibende Tests genutzt
  werden darf.
