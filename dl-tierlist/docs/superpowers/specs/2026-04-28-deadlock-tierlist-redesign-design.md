# Deadlock Tierlist – Redesign (Design)

Datum: 2026-04-28

Ziel: Klon des deathy-Style Tierlist-UIs (`deadlockmeta.com`), aber mit
**automatischer Tier-Einteilung aus deadlock-api Winrates** statt manueller
Pflege. Builds, Beschreibungen und „Players to Watch" werden weiterhin manuell
über ein Admin-UI gepflegt. Refresh alle 8h, immer auf Basis des aktuellen
Patches.

## 1. Architektur

### 1.1 Backend

Neuer Cog `tierlist_public` im Repo `Deadlock-Bots`, analog zu `turnier_public`
und `public_stats`. Wrappt eine `aiohttp.web.Application` auf einem dedizierten
Port (Vorschlag `8770`). Caddy mappt eine Subdomain (oder Subpath) auf den
Port.

- Datenbank: bestehende `data/deadlock.sqlite3` über `service.db`. Neue
  Tabellen mit Prefix `tierlist_*`.
- Auth Admin: bestehender `master_dash_session`-Cookie (Discord OAuth) wie im
  alten `API-CONTRACT.md` definiert. Wiederverwendung des Auth-Codes aus dem
  Bot.
- Hintergrund-Task: ein einzelner asyncio-Loop, alle 8h
  - aktuellen Patch via deadlock-api `/v1/patches` ermitteln (neuestes
    `pub_date`),
  - für jeden Skill-Bucket (`all`, `phantom_plus`, `eternus`)
    `/v1/analytics/hero-stats` mit passenden `min_average_badge` und
    `min_unix_timestamp = patch_pub_date` pullen,
  - Snapshot in `tierlist_snapshots` schreiben,
  - alten Snapshot bleibt liegen für WR-Change-Diff (siehe 3.4).

### 1.2 Frontend

Frontend bleibt im Repo `Website/dl-tierlist/` (Vite, Vanilla-JS, Multi-Page).

- `index.html` + `src/tierlist.js`: Tierliste, Variante B (siehe 4).
- `admin/index.html` + `src/admin.js`: komplett neu, siehe 5.
- `history/index.html` + `src/history.js`: zeigt WR-/Tier-Verlauf je Hero,
  passt sich an neue API-Response an.
- Hero-Bilder: bleiben lokal unter `public/heroes/<slug>.png`. Slug wird im
  Frontend aus `name` abgeleitet (`lowercase`, Spaces → `_`, `&` → `and`).
  Fallback: deadlock-api Asset-CDN.
- Caching: Frontend cached `/api/tierlist` per `lastUpdated`-Timestamp im
  LocalStorage, Stale-While-Revalidate.

### 1.3 Datenflüsse

```
deadlock-api /v1/patches      ─┐
                                ├──► tierlist refresher (8h)
deadlock-api /v1/analytics    ──┘          │
  /hero-stats                              ▼
                                tierlist_snapshots
                                tierlist_snapshot_heroes
                                           │
deadlock_heroes  (existing) ──┐            │
deadlock_hero_builds (existing)├─► /api/tierlist (joined)
tierlist_hero_meta            │            │
tierlist_streamers            │            ▼
tierlist_votes                ┘       Frontend
```

## 2. Datenmodell (neue Tabellen, alle Prefix `tierlist_`)

```sql
-- Globale Tierlist-Settings (KV, Singleton)
CREATE TABLE tierlist_settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Schlüssel: thresholds_json, refresh_interval_seconds, patch_override_unix,
--           description_text

-- Pro Hero: Beschreibung (Builds liegen schon in deadlock_hero_builds)
CREATE TABLE tierlist_hero_meta (
  hero_id INTEGER PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

-- Twitch-Streamer pro Hero ("Players to Watch")
CREATE TABLE tierlist_streamers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hero_id INTEGER NOT NULL,
  twitch_login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(hero_id, twitch_login)
);

-- WR-Snapshot pro Refresh, je Skill-Bucket
CREATE TABLE tierlist_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket TEXT NOT NULL,           -- 'all' | 'phantom_plus' | 'eternus'
  patch_id TEXT NOT NULL,         -- Patch-Identifier (pub_date ISO)
  patch_unix INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  UNIQUE(bucket, fetched_at)
);

CREATE TABLE tierlist_snapshot_heroes (
  snapshot_id INTEGER NOT NULL,
  hero_id INTEGER NOT NULL,
  matches INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  winrate REAL NOT NULL,
  PRIMARY KEY(snapshot_id, hero_id),
  FOREIGN KEY(snapshot_id) REFERENCES tierlist_snapshots(id) ON DELETE CASCADE
);

-- Build-Voting (kein Auth, 1 Vote pro Browser via LocalStorage)
CREATE TABLE tierlist_build_votes (
  build_id INTEGER PRIMARY KEY,   -- referenziert deadlock_hero_builds.build_id
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tierlist_snapshots_bucket_fetched
  ON tierlist_snapshots(bucket, fetched_at DESC);
CREATE INDEX idx_tierlist_snapshot_heroes_snapshot
  ON tierlist_snapshot_heroes(snapshot_id);
```

Keine Migration-für-Migration nötig: die Tabellen werden im
`service.db.connect()`-Setup angelegt (gleiches Pattern wie `deadlock_heroes`).

## 3. Tier-Logik & Refresh

### 3.1 Tier-Schwellen (default)

```
S+   ≥ 52.0 %  Overpowered
S    50.0 – 52.0 %  Meta-Defining
A    48.0 – 50.0 %  Strong Picks
B    46.0 – 48.0 %  Viable
C    < 46.0 %  Situational
```

Pro Bucket gleicher Schwellensatz, aber Schwellen sind in
`tierlist_settings.thresholds_json` änderbar. Heroes mit
`matches < min_matches` (default 500) landen in einem versteckten
`insufficient_data`-Bucket und tauchen nicht in der Tierliste auf.

### 3.2 Skill-Bucket-Mapping

Vereinfachte Buckets, Mapping zu `min_average_badge` der API:

| UI-Label    | bucket         | min_avg_badge | max_avg_badge |
|-------------|----------------|---------------|---------------|
| All Skill   | `all`          | 0             | 116           |
| Phantom +   | `phantom_plus` | 80            | 116           |
| Eternus     | `eternus`      | 100           | 116           |

(Konkrete Schwellen ggf. anpassen, als Konstanten im Code, nicht in DB.)

### 3.3 Refresh-Loop

Pseudocode:

```python
async def refresh_loop():
    while not stopping:
        try:
            patch = await fetch_current_patch()       # /v1/patches[0]
            for bucket in ("all", "phantom_plus", "eternus"):
                stats = await fetch_hero_stats(
                    min_avg_badge=BUCKET_BADGE[bucket][0],
                    max_avg_badge=BUCKET_BADGE[bucket][1],
                    min_unix=patch.pub_unix,
                )
                snapshot_id = insert_snapshot(bucket, patch, stats)
                insert_snapshot_heroes(snapshot_id, stats)
            prune_old_snapshots()  # je Bucket nur die letzten 30 behalten
        except Exception:
            log.exception("tierlist refresh failed")
        await sleep(refresh_interval_seconds)         # default 8h
```

Patch-Override aus `tierlist_settings.patch_override_unix` überschreibt
`patch.pub_unix`, falls gesetzt.

### 3.4 Winrate-Change

Δ-WR pro Hero = `wr_aktuell − wr_vorheriger_snapshot_gleicher_bucket`. Falls
es noch keinen vorherigen Snapshot gibt → `null` (Frontend zeigt „—" statt
Pfeil).

## 4. Frontend – Tierliste (`index.html`)

- Header: Brand-Logo links, Nav („Tierliste" / „Verlauf" / „Admin"), rechts
  Skill-Bucket-Dropdown (`All / Phantom+ / Eternus`).
- Sub-Header: „Aktueller Patch: <Datum> · Zuletzt aktualisiert: <Datum>"
- Suchfeld + Toggle „Grid / List".
- Tier-Bänder (Variante B):
  - Header oben: `S+ — OVERPOWERED · ≥ 52% WR`, Farbverlauf passend zum Tier.
  - Body: Hero-Karten (~108px breit) mit Hero-Bild, Name, Pills:
    - Pill 1: Winrate (`54.2%`)
    - Pill 2: Δ-WR farbig (grün `+1.4`, rot `-0.3`, grau `±0.0`, „—"
      wenn null)
- Klick auf Hero-Karte → Detail-Panel öffnet sich direkt unter dem Tier-Band:
  - Hero-Bild + Name als Headline,
  - Beschreibung (aus `tierlist_hero_meta.description`),
  - „Recommended Builds": Liste, je Build:
    - Build-Name + Author, Klick öffnet Steam-Build-Link / kopiert Code,
    - 👍 und 👎 mit Counter (LocalStorage merkt Stimme),
  - „Players to Watch": Twitch-Buttons (lila), Klick öffnet Twitch-Stream,
    Live-Indikator wäre nice-to-have (späterer Schritt).
- Suchfeld filtert Heroes über alle Tiers, dimmt Nicht-Treffer.
- Static Fallback: bei Backend-Down zeigt Frontend Toast und nutzt
  `public/data/tierlist.json` (Last-Known-Good).

## 5. Frontend – Admin (`admin/index.html`)

Login-Screen, falls `master_dash_session` fehlt → Discord-OAuth-Login.

Nach Login:

### 5.1 Tab „Heroes"

Liste aller `deadlock_heroes` (links). Pro Hero (rechts) Editor:

- Beschreibung (Textarea, Markdown erlaubt für **fett**, _kursiv_, Links).
- Builds: read-only Liste aus `deadlock_hero_builds` (bleibt im Build-Bot
  gepflegt) — hier nur Sort-Order / Active-Toggle änderbar, keine neuen
  Builds anlegen (das macht der Build-Bot).
- Players to Watch: Eingabefeld („Twitch-Login"), Liste mit Drag&Drop-Sort
  und Active-Toggle.
- „Speichern"-Button → `PUT /api/admin/hero/{hero_id}`.

### 5.2 Tab „Settings"

- Tier-Schwellen (5 Inputs, Vorschau live).
- `min_matches`-Filter für „Insufficient Data".
- Refresh-Intervall (Sekunden).
- Patch-Override (Datum, optional) + „Patch automatisch erkennen"-Toggle.
- Globale Beschreibung („About this tier list"), wird auf Frontend angezeigt.
- „Refresh jetzt"-Button → triggert Refresh manuell.

## 6. HTTP-API

Alle Pfade unter `/api/`. JSON in/out. Auth über `master_dash_session`-Cookie
für `*/admin/*`. Fehler-Format: `{ "error": "<code>", "message": "<text>" }`.

### 6.1 Public

- `GET /api/heroes` — Mapping `hero_id → {name, slug, image_url}`.
- `GET /api/tierlist?bucket=all` — aktuelle Tierliste mit allen Tiers, je
  Hero `{wr, wr_change, matches, build_ids[], streamer_ids[], description}`.
- `GET /api/tierlist/history?bucket=all` — Verlauf (z.B. letzte 30
  Snapshots, je Hero Tier-Wechsel und WR-Punkte).
- `POST /api/builds/{build_id}/vote` — `{ "vote": "up"|"down" }`,
  rate-limit 1 / IP / 5s, kein Login.

### 6.2 Admin

- `GET /api/admin/me` — `{id, username}` oder `401`.
- `PUT /api/admin/hero/{hero_id}` — `{description, streamers, builds_meta}`
  speichert Beschreibung, Streamer-Liste und Build-Sortierung.
- `GET/PUT /api/admin/settings` — Tier-Schwellen, Refresh-Intervall,
  Patch-Override, About-Text.
- `POST /api/admin/refresh` — sofortiger Refresh.

## 7. Caddy / Deployment

- Cog läuft im Prozess des `deadlock-master.service`.
- Caddyfile-Block:
  ```
  tierlist.<domain> {
    reverse_proxy 127.0.0.1:8770
  }
  ```
- Frontend (`Website/dl-tierlist/dist/`) wird wie bisher gebaut + von Caddy
  als statisches Site deployt; ruft `/api/...` über CORS-freie Same-Site
  oder über Subpath, abhängig von Domain-Setup.

## 8. Testing

- Backend-Tests in `Deadlock-Bots/tests/`:
  - `test_tierlist_refresh.py`: gemockter API-Client, prüft Snapshot-Schema,
    Tier-Zuordnung, Δ-WR-Berechnung, Insufficient-Data-Bucket.
  - `test_tierlist_endpoints.py`: aiohttp-Test-Client, prüft Public-
    Endpunkte (200/Schema), Admin-Endpunkte (401 ohne Cookie, 200 mit).
- Frontend: keine automatischen Tests, manuell verifizieren über `vite dev`
  + Browser:
  - Tierliste lädt, Δ-WR-Pfeile korrekt, Skill-Bucket-Toggle wechselt,
  - Hero-Klick öffnet Detail-Panel, Build-Vote bleibt auch nach Reload,
  - Admin-Login + Beschreibung speichern + sofort sichtbar im Frontend,
  - Static-Fallback funktioniert (Backend abschalten).

## 9. Out of scope

- Authentifiziertes User-Voting (1 Vote/Browser via LocalStorage reicht).
- Live-Twitch-Status (Player-Live-Indicator) — später.
- Patch-Diff (alte vs. neue Tierliste pro Patch) — `history.html` zeigt nur
  Verlauf des aktuellen Patches.
- Mehrsprachigkeit; Frontend bleibt deutsch.

## 10. Risiken / offene Punkte

- deadlock-api Rate-Limits: bei 8h-Intervall + 3 Buckets = 3 Calls / Tag,
  unkritisch. Falls API mal 5xx liefert, Snapshot überspringen statt
  abbrechen.
- `deadlock_heroes` enthält evtl. nicht alle Heroes der API (Build-Bot
  pflegt nur Heroes mit Build). Lösung: bei unbekannter `hero_id` aus
  API-Stats wird Fallback-Name + Slug aus deadlock-api Asset-API gezogen
  (späteres Feature) — initial werden unbekannte Heroes ignoriert.
- Caddy-Subdomain muss vom Nutzer eingerichtet werden.
