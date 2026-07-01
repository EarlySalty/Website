# Website-Backend Central-DB-Wiring-Plan

Datum: 2026-07-01

## Ziel und Grenzen

Ziel ist nur der dringende Python/FastAPI-Fix fuer `builds/backend`: die lokale SQLite-Datei `builds/backend/deadlock.db` darf nach dem Cutover nicht mehr die schreibende Quelle fuer Website-/Coaching-Daten sein. Das Backend soll stattdessen die zentrale TimescaleDB/Postgres-Instanz ueber die Infisical-Env `DEADLOCK_CENTRAL_DSN` nutzen.

Nicht Teil dieses Schritts: Rust-Port / `dl-etage`, Live-Service-Aenderung, Secret-Ausgabe, Datenbank-Schreibzugriff, automatische Reconciliation ohne Review.

## Ausgangslage

- Backend: FastAPI/Uvicorn in `builds/backend/app/main.py`.
- Aktuelle DB-Schicht: `builds/backend/app/database.py` nutzt `aiosqlite`, Raw-SQL und eine globale persistente SQLite-Connection.
- Konfiguration: `DB_PATH`, Default `builds/backend/deadlock.db`.
- `requirements.txt` enthaelt zwar `sqlalchemy==2.0.31`, der Python-Code nutzt aber kein ORM.
- Startup legt Tabellen per `CREATE TABLE IF NOT EXISTS` lokal an und fuegt Sample-Daten ein, wenn `meta_heroes` leer ist.
- SQLite-spezifisch im Code: `?`-Parameter, `PRAGMA table_info`, `INTEGER` als Boolean, JSON als Textspalten mit `_json`-Suffix, `reserved_until` teils als Unix-Epoch.
- Zentral-Schema-Referenz: `/home/naniadm/Documents/Deadlock-Bots/rust/crates/dl-central-db/migrations/0001-0011`, besonders `0004_coaching_scrim.sql`, `0006_tierlist.sql`, `0010_activity_moderation_content_patchnotes.sql`, `0002_sp1_schemas_and_core.sql`.

## Betroffene Tabellen / Modelle

Website-SQLite-Tabelle -> zentrale Tabelle:

| Bereich | SQLite / Code | Zentral |
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

Wichtige Spaltenunterschiede:

- `coaching_requests.id` ist zentral nicht 1:1 gleich benannt: zentrale PK ist `coaching.requests.request_uid`, dazu gibt es `website_request_id` und `bot_request_id`. Die Python-API muss weiter ein `id` liefern, intern aber eindeutig auf `request_uid`/`website_request_id` mappen.
- `coaching_sessions.request_id` muss auf `coaching.sessions.request_uid` bzw. bei Website-Herkunft auf `website_request_id` abgestimmt werden.
- JSON-Textspalten werden zentral `JSONB`: `abilities_json -> abilities`, `stats_json -> stats`, `ability_order_json -> ability_order`, `items_json -> items`, `tiers_json -> tiers`, `specialties_json`, `availability_json`, `main_heroes_json`.
- Boolean-Felder werden zentral echte `BOOLEAN`: `is_public`, `is_active`, `would_recommend`, `achieved`.
- Zeitfelder werden zentral `TIMESTAMPTZ` bzw. `DATE`; `reserved_until` darf nicht als Integer weitergeschrieben werden.
- `core.meta_users.id` ist `BIGINT`; Website-Code nutzt aktuell String-Discord-IDs und muss beim DB-Zugriff casten.

## Umstiegsentscheidung

Kein ORM-Port fuer diesen Fix. Der geringste Umbau ist ein schmaler Wechsel von `aiosqlite` auf `asyncpg`, weil der Code bereits Raw-SQL nutzt und SQLAlchemy im Code nicht etabliert ist.

Konkreter Zielzustand:

- `requirements.txt`: `asyncpg` ergaenzen; `aiosqlite` nur fuer Tests/Alt-Fallback entfernen oder isolieren, sobald Tests portiert sind.
- `app/database.py`: asyncpg-Pool aus `DEADLOCK_CENTRAL_DSN` initialisieren. DSN nie loggen.
- Kein `CREATE TABLE`/Sample-Data auf Startup gegen Postgres; Migrationen bleiben Quelle der Wahrheit.
- `init_db()` nur noch Pool-Aufbau plus optionaler read-only Schema-Smoke-Check auf erwartete Tabellen.
- Kleine DB-Adapter-Schicht bereitstellen, die fuer die bestehenden Router `execute`, `fetchone`, `fetchall`, `commit`, `close` kompatibel kapselt.
- SQL schrittweise explizit auf zentrale Schemas bringen. Ein globales Regex-Umschreiben ist nur als Zwischenhilfe akzeptabel, nicht als dauerhafte Logik fuer kritische Writes.

## Ticket-Liste

### P0 - Scope- und Safety-Guards

- In `app/database.py` bei `WEBSITE_BACKEND_IMPL=python` fuer Produktion hart auf `DEADLOCK_CENTRAL_DSN` pruefen.
- `DB_PATH` nicht mehr als Produktions-Fallback verwenden.
- Logs pruefen: keine DSN-Ausgabe, keine Secret-Env-Dumps.
- Startup darf zentral keine DDL/Sample-Daten schreiben.

Akzeptanz: Start ohne `DEADLOCK_CENTRAL_DSN` scheitert klar, ohne Secret-Wert auszugeben.

### P1 - asyncpg-Adapter

- asyncpg-Pool mit Lifecycle an FastAPI-Lifespan haengen.
- Row-Kompatibilitaet fuer `row["col"]`, `row[0]`, `row.keys()` erhalten.
- Query-Helfer fuer `$1`-Parameter nutzen; bestehende `?`-Queries entweder gezielt portieren oder innerhalb des Adapters deterministisch konvertieren.
- `PRAGMA table_info` durch `information_schema.columns` ersetzen.

Akzeptanz: Router koennen ohne API-Signaturwechsel `get_db()` weiter nutzen oder minimal angepasst werden.

### P2 - Tabellen- und Spaltenmapping

- Alle `meta_*`-Router auf `core`, `tierlist`, `content`, `patchnotes` qualifizieren.
- Coaching-Router auf `coaching.*` qualifizieren.
- JSONB-Spalten mit klaren Casts oder asyncpg-Codecs schreiben.
- Reads so aliasen, dass bestehende Pydantic-Modelle kompatibel bleiben, z.B. `request_uid AS id`, `abilities AS abilities_json`.

Akzeptanz: Keine unqualifizierten Website-SQLite-Tabellennamen bleiben in produktivem SQL.

### P3 - Coaching-ID-Semantik

- Fuer Website-originierte Requests: `request_uid` und `website_request_id` eindeutig definieren; empfohlen: bestehende Website-ID als `request_uid` und `website_request_id` setzen, solange kein zentraler UUID-Generator vorgegeben ist.
- Fuer Bot-originierte Syncs: `bot_request_id` als Integer schreiben, `request_uid` nicht aus String-Konvertierung kollidieren lassen.
- Session-Zuordnung ueber `request_uid` bevorzugen; `website_request_id` nur fuer Backward-Kompatibilitaet nutzen.

Akzeptanz: Bot- und Website-Coaching-Requests werden nicht als getrennte Duplikate angelegt.

### P4 - Typmigration im Python-Code

- Boolean-Felder als `bool` schreiben/lesen, nicht `0/1`.
- `reserved_until` von Epoch auf timezone-aware `datetime` mappen.
- `scheduled_at`, `target_date` und Notify-Felder auf zentrale Typen normalisieren.
- JSON-Helper robust machen: akzeptiert sowohl String aus SQLite-Tests als auch `dict/list` aus Postgres.

Akzeptanz: API-Responses bleiben kompatibel; DB-Writes passen zu Postgres-Typen.

### P5 - Reconciliation vor Cutover

Vor jedem produktiven Umschalten muss es ein separates Reconciliation-Artefakt geben. Nicht blind ueberschreiben.

Vorgehen:

1. ETL-Snapshot-Grenze exakt festhalten: erwarteter Stand ist 2026-06-30/2026-07-01 aus `central-postgres-sp1`; falls kein eindeutiger Timestamp existiert, pro Tabelle `created_at`/`updated_at`-Maxima aus Central und SQLite vergleichen.
2. Vor Cutover Schreibfenster schliessen: Website-Backend kurz in Wartung oder Dienst stoppen, dann finale SQLite-Backup-Kopie erstellen.
3. Dry-run-Script bauen, das SQLite und Central nur liest und pro Tabelle ausgibt:
   - Row-Count,
   - PK-Mengen-Diff,
   - Hash ueber fachliche Spalten,
   - neue/geaenderte SQLite-Zeilen seit Snapshot,
   - Konflikte gleicher PK mit unterschiedlichem Inhalt.
4. Tabellen ohne `updated_at` voll vergleichen, nicht nur nach Timestamp filtern.
5. Review-Entscheidung pro Konflikt:
   - Central fehlt, SQLite neu: gezieltes Insert in Central.
   - Beide vorhanden, identisch: nichts tun.
   - Beide vorhanden, unterschiedlich: manuelle Entscheidung, kein automatisches Overwrite.
6. Apply-Script nur idempotent und nur nach Review-Freigabe ausfuehren.
7. Nach Apply erneut Dry-run: Diffs muessen leer oder bewusst dokumentiert sein.

Betroffene Reconciliation-Tabellen sind alle oben gelisteten 21 Website-Tabellen, mit Fokus auf nach dem ETL neu beschriebene Coaching-Tabellen: `coaching_requests`, `coaching_sessions`, `coachees`, `coaches`, `session_notes`, `coaching_appointments`, `coaching_goals`, `coaching_milestones`.

### P6 - Tests

- Bestehende Tests in `builds/backend/tests` von direkter `aiosqlite`-Connection auf Adapter-Fixtures umstellen.
- Mindestens testen:
  - Coaching-Request erzeugen,
  - Bot-Sync idempotent,
  - Appointment-Notify-Poll und Markierung,
  - Auth-Rolle aus `core.meta_users`,
  - JSONB/Boolean/Timestamp-Konvertierungen.
- Fuer lokale Tests entweder Testcontainer/Postgres-Test-DSN oder Adapter-Fake verwenden; Produktionscode darf nicht still auf SQLite zurueckfallen.

Akzeptanz: Pytest laeuft ohne Zugriff auf produktive Postgres-Daten.

### P7 - systemd / Runtime

- `deadlock-website-backend.service` bzw. `scripts/run_builds_backend.sh` muss `DEADLOCK_CENTRAL_DSN` aus Infisical im Prozess-Env haben.
- `DB_PATH` aus der Produktiv-Konfiguration entfernen oder ignorieren.
- Falls der Python-Fix live gehen soll, `WEBSITE_BACKEND_IMPL=python` setzen; der aktuelle Wrapper startet sonst standardmaessig das Rust-Binary.
- Optional `Environment=WEBSITE_BACKEND_IMPL=python` in der User-Unit setzen; Secret selbst bleibt in Infisical, nicht in Unit-Dateien.
- Neustart erst nach Review/Freigabe: `systemctl --user restart deadlock-website-backend.service`.

Akzeptanz: Prozess nutzt `DEADLOCK_CENTRAL_DSN`; es gibt keine neue Schreibverbindung zu `builds/backend/deadlock.db`.

### P8 - Rollback

- Vor Cutover SQLite-Backup behalten.
- Rollback ist Service-Konfig zurueck auf alten Stand plus Backup-Datei; nur als Notfall, weil danach erneut Divergenz entstehen wuerde.
- Nach erfolgreichem Cutover lokale SQLite-Datei nicht loeschen, sondern read-only archivieren.

## Offene Punkte fuer Review

- Final festlegen, ob `request_uid == website_request_id` fuer Website-originierte Requests akzeptiert ist.
- Klaeren, ob Nicht-Coaching-`meta_*` weiterhin von der Website aktiv beschreibbar sein sollen oder in Central read-only behandelt werden.
- Entscheiden, ob Tests mit echtem lokalen Postgres/Testcontainer laufen duerfen oder ein Adapter-Fake genuegt.
