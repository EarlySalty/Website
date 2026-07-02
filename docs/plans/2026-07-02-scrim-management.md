# Scrim-Management — sauberes Domänenmodell statt Excel-Klon

Stand 2026-07-02. Ziel (User-Direktive): Die Scrim-Excel **ablösen**, nicht nachbauen. Daten leben nativ in der zentralen PG; Planung/Management passiert serverseitig so gut, dass die Excel überflüssig wird. Kein CSV-Import (Daten sind bereits als `availability`-JSON-Text in der DB).

Verwandt: `docs/plans/2026-07-02-sp2-scrim-visibility.md` (SP2, bereits live). Diese Arbeit ist die additive Management-Schicht darüber.

## Ist-Zustand (verifiziert 2026-07-02)

- Zentrale PG `scrim`-Schema: `participants(35)`, `teams(4)`, `team_members(24)`, `matches(2)`. Alle 4 Teams mit `discord_role_id` + `discord_channel_id` verdrahtet (Team 1/2 Coach Leo, Team 3/4 Coach Deniz).
- **Excel-Daten sind schon drin**: `participants.availability` (TEXT) enthält JSON mit **deutschen** Wochentag-Keys: `{"Mo":"19-20","Di":"Flexibel","Mi":"Geht nicht","Do":"Ab 14","Fr":"?","Sa":"10-24","So":"22:40"}`. Werte sind Freitext.
- Lifecycle `status`: `assigned`(24) / `new`(6) / `waitlist`(5). Nur „assigned" sind in `team_members`.
- **Migration `2026070230` bereits live** (Deadlock-Bots main bb695fe): `scrim.participants` hat additiv `availability_slots JSONB` + `notes TEXT` (beide nullable).
- Backend `builds/backend-rust` (axum + Runtime-`sqlx::query()`, `row.get()`): `src/routes/scrim.rs` mit `get_me`/`signup`/`pool`/`teams`/`patch_participant`. Auth `auth::require_authenticated_user -> User{ id:String(Discord-ID), role, display_name }`. Coach = `role=="admin"` ODER aktive `coaching.coaches`-Zeile. Fehler `AppError` → JSON `{"detail":"…"}`. Advisory-Key Participant-Upsert = `0x4451_0008_0004_0001i64`.
- Bot (`dl-squads`/`dl-community`) schreibt `scrim.*` mit **compile-checked `query!`** und liest `availability` (Legacy-Text). → Backend muss `availability`-Text konsistent halten und darf bestehende Spalten nicht brechen (additiv).
- Discord-Rollen: **bestehende Broker-API** `POST /internal/master/v1/discord/member/{add-role,remove-role}` (Auth `X-Internal-Token`). Kein DB→Discord-Reconciler. (= Welle T4, hier NICHT.)

## Kern-Idee: strukturierte Verfügbarkeit + Overlap

Der Excel-schlagende Mehrwert ist die **Team-Overlap-Rechnung** („wann kann das ganze Team?"). Dafür wird der Freitext in Zeitfenster normalisiert.

### WeeklyAvailability (Wire-Format, exakt)
Immer alle 7 Tage, Keys englisch/stabil (`mon,tue,wed,thu,fri,sat,sun`).
```jsonc
{
  "mon": { "status": "available", "from": 1140, "to": 1200 },
  "tue": { "status": "available", "from": null, "to": null },   // ganztägig verfügbar
  "wed": { "status": "unavailable", "from": null, "to": null },
  "thu": { "status": "available", "from": 840,  "to": null },   // ab 14:00, offenes Ende
  "fri": { "status": "unknown",   "from": null, "to": null },
  "sat": { "status": "available", "from": 600,  "to": 1440 },
  "sun": { "status": "available", "from": null, "to": null }
}
```
- `status ∈ {"available","unavailable","unknown"}`.
- `from`/`to` = Minuten seit Mitternacht `0..=1440`; **immer vorhanden**, `null` wenn nicht gesetzt. Bei `available` ohne `from`/`to` = ganztägig. `to=1440` = Mitternacht.
- Serde: Enum `#[serde(rename_all="lowercase")]`; `from`/`to` als `Option<u16>` (serialisiert zu `null`, NICHT weggelassen).

### Effektive Verfügbarkeit
`effective(slots: Option<Json>, legacy_text: Option<&str>) -> WeeklyAvailability`:
1. `slots` vorhanden → deserialisieren (fehlende Tage → `unknown`).
2. sonst `legacy_text` per `parse_legacy` interpretieren.
3. sonst alle 7 Tage `unknown`.
`availability_confirmed = slots IS NOT NULL` (unterscheidet self-service-gepflegt von Legacy-Schätzung).

### parse_legacy(text) — Best-Effort-Parser für den Excel-Freitext
Input = der Legacy-`availability`-Text = JSON mit **deutschen** Keys `{"Mo":…,"Di":…,"Mi":…,"Do":…,"Fr":…,"Sa":…,"So":…}` → mappe Mo→mon … So→sun. Pro Tageswert (case-insensitive, getrimmt), **Reihenfolge der Prüfung**:
1. leer / `"?"` → `unknown`.
2. enthält `"geht nicht"` / `"nein"` / `"keine zeit"` → `unavailable`.
3. `"flexibel"`, `"immer"`, `"immer zeit"`, `"jederzeit"`, `"optimal"` → `available` ganztägig (from/to null).
4. Bereich `A-B` (auch `A - B`), A/B ∈ 0..24 → `available` from=A*60, to=B*60 (24→1440).
5. `HH:MM` einzeln → `available` from=HH*60+MM, to=null.
6. `ab N` / `ab N:MM` → `available` from=N*60(+MM), to=null.
7. bloße Zahl `N` (0..24) → `available` from=N*60, to=null.
8. enthält `"abend"` → `available` from=1080 (18:00), to=null. `"nachmittag"` → from=840. `"mittag"` → from=720.
9. sonst (nicht-leer, unerkannt) → `available` ganztägig (Excel-Autor meinte „kann"; Legacy-Fallback, Spieler korrigiert per Self-Service).
Unit-Tests MÜSSEN exakt diese realen Werte abdecken: `"Flexibel"`,`"19-20"`,`"15-24"`,`"16-22"`,`"10-17"`,`"Ab 8"`,`"Ab 14"`,`"22:40"`,`"20:30"`,`"19"`,`"Geht nicht"`,`""`,`"?"`,`"so abends"`,`"Immer Zeit"`,`"optimal"`.

### Overlap (pro Team-Board, über **nicht-Bank**-Mitglieder)
Pro Tag über Mitglieder mit `is_bench=false`:
- `available`/`unavailable`/`unknown` = Anzahl je status.
- `window_from = max(from_i)` (fehlendes from = 0), `window_to = min(to_i)` (fehlendes to = 1440), nur über `available`-Mitglieder.
- gültiges gemeinsames Fenster ⇔ `available>=1 && window_from < window_to`; sonst `window_from=window_to=null`.
- `full_squad = (available == Anzahl gewerteter Mitglieder) && Fenster gültig`.
- `unavailable_ids`/`unknown_ids` = participant_ids (für UI „wer blockt").

## API-Vertrag (T2)

Alle Antworten = explizite serde-Structs. Additive Erweiterung; bestehende Routen/Signaturen bleiben.

1. **GET `/api/scrim/me`** (User) — `ScrimParticipant` bekommt zusätzlich `availability_slots: WeeklyAvailability` (effektiv) + `availability_confirmed: bool`. `availability` (Legacy-Text) bleibt.
2. **PUT `/api/scrim/me/availability`** (User) — Body = `WeeklyAvailability`. Schreibt in einer Tx unter Advisory-Lock `0x4451_0008_0004_0001`: `availability_slots` (kanonisch) **und** einen gerenderten Legacy-`availability`-Text (deutsche Keys, menschenlesbar: ganztägig→`"Flexibel"`, from+to→`"HH:MM-HH:MM"`, nur from→`"ab HH:MM"`, unavailable→`"Geht nicht"`, unknown→`""`), `updated_at=now()`. Kein Teilnehmer für den User → 404 `"Bitte zuerst zum Scrim-Pool anmelden."`. Antwort = aktualisierter `ScrimParticipant`. Idempotent.
3. **GET `/api/scrim/pool?status=`** (Coach) — `ScrimPoolParticipant` bekommt zusätzlich `availability_slots` (effektiv) + `availability_confirmed: bool` + `discord_linked: bool` (`discord_id IS NOT NULL`) + `notes: Option<String>`.
4. **GET `/api/scrim/teams/{id}/board`** (Coach) — neu:
```jsonc
{ "team": ScrimTeam,
  "members": [ { "participant_id":i32, "display_name":String, "rank":Option, "roles":Option,
                 "is_captain":bool, "is_bench":bool, "discord_linked":bool,
                 "availability_confirmed":bool, "availability":WeeklyAvailability, "notes":Option } ],
  "overlap": { "mon":DayOverlap, …, "sun":DayOverlap } }
```
Team nicht gefunden → 404 `"Team nicht gefunden."`. `overlap` über nicht-Bank-Mitglieder.
5. **PATCH `/api/scrim/participants/{id}`** (Coach) — Body additiv erweitern: `notes?:String`, `rank?:String`, `roles?:String` (zusätzlich zu `status?/team_id?/is_bench?/is_captain?`). `notes`/`rank`/`roles` per `COALESCE` nur setzen wenn im Body. Antwort = erweiterter `ScrimPoolParticipant`. (Discord-Sync = T4, hier noch nicht.)

`DayOverlap`-Wire: `{ available:u32, unavailable:u32, unknown:u32, window_from:Option<u16>, window_to:Option<u16>, full_squad:bool, unavailable_ids:Vec<i32>, unknown_ids:Vec<i32> }`.

## Tests mit Zähnen (Pflicht)
- **Unit** (immer): `parse_legacy` für alle o. g. realen Werte; `overlap` für ≥4 Mitglieder-Sets (alle verfügbar→Fenster; Schnitt zweier Fenster; kein gemeinsames Fenster; unavailable/unknown-Zählung + ids; full_squad true/false).
- **Integration** (gated `DATABASE_URL_TEST`, Guard `assert_throwaway_database_url`): `SCRIM_TEST_DDL` um `availability_slots JSONB` + `notes TEXT` erweitern. Seeds mit gemischt (einer mit `availability_slots`, einer nur Legacy-Text, einer ohne beides). Prüfen: `me` liefert effektive Slots + `availability_confirmed`; `PUT availability` round-trip (schreibt Slots+gerenderten Text, 2× = idempotent, gleiche Zeile); `board` Overlap korrekt auf gemischten Daten; `pool` enthält neue Felder; PATCH `notes` persistiert.
- **Drift**: `ALTER TABLE scrim.participants DROP COLUMN availability_slots` → `board`- bzw. `pool`-Handler MUSS 500 liefern (beweist echte Spalten-Nutzung, kein Grün-Waschen).
- **JSON-Shape**: erweiterte Structs serialisieren, exakte Keys/Typen asserten (Frontend-Vertrag), inkl. `WeeklyAvailability`/`DayOverlap`.

## Leitplanken
- Additiv: keine bestehende Route/Signatur/Response-Semantik brechen; `discord_id IS NULL` (Seed-Roster) sauber behandeln.
- Runtime-`sqlx::query()` + `row.get()`; JSONB via `sqlx::types::Json<…>` oder `serde_json::Value` + `serde_json::from_value`.
- PUT-availability-Write unter demselben Advisory-Key wie Signup.
- Legacy-`availability`-Text bei jedem Slots-Write mitpflegen (Bot/Legacy-Konsistenz).
- Deutsche user-sichtbare Strings final wie oben vorgegeben.
- **NICHT `WORKFLOW.md` anfassen.** Codex committet/pusht nicht.

## Folge-Wellen (nicht T2)
- **T3 Frontend**: Pool-Redesign, Team-Board mit Overlap-Heatmap, Self-Service-Verfügbarkeits-Editor.
- **T4 Discord-Rollen-Sync**: PATCH-Team-Zuweisung → Broker add/remove-role (nur bei `discord_linked`), fail-open, Sync-Status in Response. Wiring verifiziert (siehe unten).
- **Später**: Match-Scheduling (Termin/Gegner setzen; `matches` existiert bereits).

## T4 — Broker-Wiring (verifiziert 2026-07-02)

- **Endpoint**: `POST {base}/internal/master/v1/discord/member/add-role` bzw. `.../remove-role`, Header `X-Internal-Token: <token>`.
- **Broker-Adresse**: default `http://127.0.0.1:8770` (Bot bindet via `MASTER_BROKER_HOST`/`MASTER_BROKER_PORT`, dl-core-Default Port 8770). Website-Config additiv: `MASTER_BROKER_BASE` (default `http://127.0.0.1:8770`).
- **Token (Env-Kette, erster Treffer)**: `MASTER_BROKER_TOKEN` → `MAIN_BOT_INTERNAL_TOKEN` → `TWITCH_INTERNAL_API_TOKEN`. Kein Default. Website-seitig `MASTER_BROKER_TOKEN` (+ Fallback) laden.
- **Muster vorhanden**: `builds/backend-rust/src/config.rs` hat bereits `dashboard_internal_api_base` (`DASHBOARD_INTERNAL_API_BASE`, default `http://127.0.0.1:8766`) + reqwest-Client mit `X-Internal-Token`-Header (siehe `routes/coaching.rs`, `routes/auth.rs`) — 1:1 als Vorlage nutzen.
- **Request-Body**: `{ guild_id:u64, user_id:u64, role_id:u64, reason?:string, idempotency_key?:string }`.
- **Response**: `{ ok:bool, request_id:string, idempotency_key:string|null, cached:bool, result:value|null, error:{code,message}|null }`.
- **Status**: 200 ok · 400 bad · 401 unauth (Token) · 403 forbidden (**Allowlist**: guild/role nicht erlaubt) · 500+ Discord-Op fehlgeschlagen.
- **Guild-ID**: `1289721245281292288` (Bot: `dl-voice::MAIN_GUILD_ID`, hardcoded; Website-seitig als Config `SCRIM_GUILD_ID` mit diesem Default).
- **Team-Rollen-IDs**: Team 1 `1521163175318388847`, Team 2 `1521163233245794465`, Team 3 `1521163300480483498`, Team 4 `1521163334211338391` (in `scrim.teams.discord_role_id` gepflegt → aus DB lesen, nicht hardcoden).
- **ALLOWLIST-VORBEDINGUNG**: Broker prüft Rollen-Allowlist (`MASTER_BROKER_ALLOWED_ROLE_IDS`/`…_ROLE_ALLOWLIST_IDS`). `permits = !enabled || ids.contains(id)` → Env ungesetzt = alles erlaubt; gesetzt = nur gelistete. Vor T4-Go per echtem Test-Grant prüfen, ob die 4 Team-Rollen passieren; falls nicht, Broker-Env um die Team-Rollen-IDs erweitern.
- **Sync-Semantik**: nur bei `discord_id IS NOT NULL`; neue Team-Rolle add, alte Team-Rolle(n) remove; **fail-open** auf DB (Zuweisung committet immer), Sync-Ergebnis als Feld in der PATCH-Response (`{ok, detail}`) + manueller Re-Sync-Endpoint/Button.
