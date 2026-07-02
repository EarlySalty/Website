# SP2 — Scrim-Sichtbarkeit (Mein Team / Web-Anmeldung / Coach-Pool)

Stand 2026-07-02. Teil der zentralen-Postgres-Migration (Spec: `Deadlock-Bots/rust/docs/specs/2026-06-30-central-postgres-migration-design.md`). Der Coaching-Backend-Port nach Rust/PG ist bereits live (`builds/backend-rust`). SP2 = die drei offenen Slice-1-Features als **additive** Schicht auf dem existierenden `scrim`-Schema.

## Ist-Zustand (verifiziert)

- Backend `builds/backend-rust` (axum + sqlx `PgPool`): Router in `src/app.rs` (`fn router`), Domänen-Module in `src/routes/`, Auth via `auth::require_authenticated_user(&state,&headers,peer) -> AppResult<User>` (`User{ id: String = Discord-ID, role, display_name, ... }`), Fehler via `error::{AppResult, AppError}` (JSON `{"detail": "..."}`), DB via `state.pool`. Queries aktuell Runtime-`sqlx::query()`.
- `scrim`-Schema (zentrale PG) ist befüllt (35 participants, 4 teams, 24 team_members, 2 matches), aber **ohne FKs**; `participants.discord_id` ist **BIGINT nullable, ohne FK zu `core.users`** (Seed-Roster hat `discord_id = NULL`).
- Bot-Seite (`Deadlock-Bots` `dl-squads` + Reaktions-Hook) schreibt bereits per sqlx nach `scrim.participants` — nicht Teil von SP2.

## Scope

**In:** `/api/scrim/*`-Routen (Backend) + 3 Frontend-Seiten (`dl-coaching`).
**Out (bewusst):** RSVP/Matching-Cockpit/MiniMax (= Slice 2); Coaching-Rolle-1-Woche S1-07 (= separater Bot-Task); neuer `dl-etage`-Dienst (Coaching lebt in `backend-rust`, wird nicht umgebogen).

## API-Vertrag (exakte Shapes — Frontend-Typen müssen 1:1 matchen)

Antworten als **explizite `serde`-Structs** (kein ad-hoc `json!`), damit der Vertrag hart ist.

### GET /api/scrim/me  (Auth: User)
Teilnehmer per `discord_id == user.id.parse::<i64>()`. Kein Eintrag → alle Felder leer (kein 404).
```
{ participant: { id:i32, display_name, rank?, roles?, availability?, status, source } | null,
  team: { id:i32, name, coach?, discord_channel_id:i64? } | null,
  members: [ { participant_id:i32, display_name, role?, is_captain:bool, is_bench:bool } ],
  next_match: { id:i32, opponent_team_name?, when_text?, scheduled_at?, status } | null }
```
`next_match` = frühestes `scrim.matches` mit `status='planned'`, in dem das Team `team_a_id` oder `team_b_id` ist; `opponent_team_name` = Name des jeweils anderen Teams.

### POST /api/scrim/signup  (Auth: User)
Body `{ rank?, roles?, availability? }`. **Upsert** in `scrim.participants` keyed auf `discord_id` — **denselben Conflict-Target/Unique-Index verwenden, den der Bot-Upsert nutzt** (vorher `\d scrim.participants` prüfen; NICHT neue Upsert-Semantik erfinden). Neu → `display_name = user.display_name`, `discord_id`, `source='web_form'`, `status='new'`, `rank_source='self'`, `rank_verified=false`. Bestehend → Profilfelder aktualisieren, `status`/`source` NICHT überschreiben. Antwort = der Teilnehmer.

### GET /api/scrim/pool?status=<opt>  (Auth: Coach)
Array aller `scrim.participants` (+ optionale Team-Zuordnung), Filter nach `status` wenn gesetzt.

### PATCH /api/scrim/participants/{id}  (Auth: Coach)
Body `{ status?, team_id?, is_bench?, is_captain? }`. Ändert `participants.status` und/oder `team_members` (Zuweisung/Bench/Captain). Antwort = aktualisierter Teilnehmer.

### Coach-Check (M-02, hart)
`is_coach = user.role == "admin" ODER aktive Zeile in `coaching.coaches` für die Discord-ID`. **Keine Discord-Guild-Rollen.** Struktur von `coaching.coaches` vorher verifizieren (`\d coaching.coaches`).

## Tickets

### T1 — Backend `src/routes/scrim.rs` (additiv)
- Neues Modul, in `routes/mod.rs` (`pub mod scrim;`) + `app.rs` registriert. Bestehende Coaching-Routen NICHT anfassen.
- 4 Endpoints oben, serde-Response-Structs, `is_coach`-Helper.
- **Tests mit Zähnen** (Pflicht):
  1. Integrationstest gegen echtes Wegwerf-Test-PG (Muster: `Deadlock-Bots/rust/scripts/central_test_db.sh`): echtes `scrim`-Schema anlegen (DDL exakt wie live), Fixtures rein, jeden Handler ausführen, Response-Shape asserten.
  2. **Negativtest**: die echte Handler-SQL läuft gegen das Schema — bei entfernter/umbenannter Pflichtspalte MUSS der Test rot werden (beweist Drift-Erkennung, nicht Grün-Waschen).
  3. JSON-Shape-Test: Response-Struct serialisieren, exakte Keys+Typen asserten (Frontend-Vertrag).
- Verifikation (Claude, extern): `cargo build` + `cargo clippy -p <crate> -- -D warnings` (scoped) + `cargo test` (scoped) grün; `git diff` reviewt.

### T2 — Frontend `dl-coaching`
- `src/pages/MyScrimPage.tsx` (`/me/scrims`), `ScrimSignupPage.tsx` (`/scrims/signup`), `ScrimPoolPage.tsx` (`/scrims`).
- `src/api/client.ts`: `export const scrims = {...}` + TS-Interfaces **exakt** zum Backend-JSON (das war die Bug-Klasse).
- Routen in `src/App.tsx`, Nav in `src/components/Layout.tsx` (Pool/Signup coach- bzw. user-sichtbar platzieren).
- Deutsche user-sichtbare Texte: Codex setzt `"Platzhalter"` + meldet Datei:Zeile — **finale Texte schreibt Claude**.
- Verifikation: `npm run build` (tsc) grün.

## Prozess (pro Ticket)
Codex (gpt-5.5, effort xhigh) baut → **frischer** Codex-Kritiker → Codex-Rework → Claude verifiziert extern (build/clippy/test bzw. tsc + Diff-Review) → Claude committet die **nur** ticket-relevanten Dateien + pusht. **NICHT `WORKFLOW.md` anfassen.** Codex committet nicht auf `main`, pusht nicht selbst.

## Leitplanken
- Additiv: keine bestehende Route/Signatur brechen.
- `discord_id`-Lookups müssen mit `NULL` (Seed-Roster) sauber leerlaufen.
- Upsert-Conflict-Target = exakt der des Bot-Upserts.
- Antworten = serde-Structs; Frontend-Typen gespiegelt.
