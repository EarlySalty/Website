# DDC Website Backend (Rust)

Rust replacement for the former FastAPI backend behind `127.0.0.1:8772`.

## Runtime

The service keeps the same public API prefix as the Python backend and connects
to the central Postgres/TimescaleDB database:

- public reverse proxy path: `/coaching/api/*`
- local bind: `WEBSITE_BACKEND_HOST` / `WEBSITE_BACKEND_PORT`
- database: `DEADLOCK_CENTRAL_DSN` is required
- auth cookie/session envs: `AUTH_*`
- internal bot auth: `TWITCH_INTERNAL_API_TOKEN`, `MASTER_BROKER_TOKEN`, or `COACHING_BOT_TOKEN`
- Discord Linked Role: `DISCORD_OAUTH_CLIENT_ID`, `DISCORD_OAUTH_CLIENT_SECRET`,
  a bot token via `DISCORD_ROLE_CONNECTION_BOT_TOKEN`/`DISCORD_TOKEN`, and
  `DB_MASTER_KEY_V1` for encrypted OAuth token storage. The public callback can
  be overridden with `DISCORD_ROLE_CONNECTION_CALLBACK_URL`; the OAuth authorize
  endpoint defaults to `https://discord.com/oauth2/authorize` and can be
  overridden with `DISCORD_OAUTH_AUTHORIZE_BASE`.

### Linked-Role-Provider (zwei Discord-Applications)

Es gibt zwei getrennte Provider hinter einem Codepfad. Jeder braucht seine
eigene Application; fehlen die Werte, antwortet nur dieser Provider mit
"nicht konfiguriert", der andere laeuft weiter.

- Steam-App (`/linked-role/steam`): `DISCORD_STEAM_APP_ID`,
  `DISCORD_STEAM_CLIENT_ID`, `DISCORD_STEAM_CLIENT_SECRET`,
  `DISCORD_STEAM_BOT_TOKEN`, `DISCORD_STEAM_CALLBACK_URL`. Ohne eigene Werte
  faellt die Kette auf die Master-App (`DISCORD_OAUTH_*`) zurueck, damit der
  bereits live laufende Steam-Flow nicht abreisst.
- Creator-App (`/linked-role/creator`): `DISCORD_CREATOR_APP_ID`,
  `DISCORD_CREATOR_CLIENT_ID`, `DISCORD_CREATOR_CLIENT_SECRET`,
  `DISCORD_CREATOR_BOT_TOKEN`, `DISCORD_CREATOR_CALLBACK_URL`. Kein Fallback:
  die Creator-Metadaten gehoeren einer anderen Application.
- `TWITCH_ANALYTICS_DSN`: read-only Quelle der Creator-Merkmale (Partnerstatus,
  Twitch-Login, Autorisierung unserer Twitch-App). Fehlt sie, kann kein
  Creator-Zustand berechnet werden — der Start loggt das als Fehler.
- Folgeziele nach dem Callback: `LINKED_ROLE_STEAM_LINK_URL`,
  `LINKED_ROLE_TWITCH_AUTH_URL`, `LINKED_ROLE_CREATOR_INFO_URL`
  (Default `https://deutsche-deadlock-community.de/streamer`).
- `DISCORD_ROLE_CONNECTION_CREATOR_RECONCILE_SECONDS` (Default 3600): Takt, in
  dem der Sync-Worker alle aktiven Creator-Tokens erneut einstellt. Fuer Steam
  kommt der Anlass aus einem DB-Trigger, den Creator-Zustand aendert dagegen
  die fremde Twitch-Datenbank ohne Ereignis.

Die beiden oeffentlichen Routen brauchen einen Caddy-Block (`@linked_roles` in
`Caddy/hosts/v50671/Caddyfile`). Der muss **vor** dem Backend live sein, sonst
laeuft Discords Callback in einen 404.

#### Deploy-Reihenfolge (nicht vertauschbar)

1. Caddy-Block installieren und reloaden.
2. `dl-central-migrate` auf der zentralen DB laufen lassen (Migration
   `2026081301_discord_role_connection_provider` aus `Deadlock-Bots`).
3. Erst danach das neue Binary tauschen und den Dienst neu starten.

Das Backend prueft die `provider`-Spalte beim Start und bricht ab, wenn sie
fehlt — bewusst, weil es ohne sie stumm falsche Zeilen schreiben wuerde. In die
andere Richtung gilt: nach der Migration laeuft das **alte** Binary nicht mehr
(SQLSTATE 42P10 auf `ON CONFLICT`). Ein Rollback per Binary-Swap allein reicht
also nicht; der Rueckweg steht im Kopf der Migrationsdatei.

`scripts/run_builds_backend.sh` loads Infisical secrets first, then starts
`builds/backend-rust/target/release/ddc-website-backend`. For the
Rust backend, `DEADLOCK_CENTRAL_DSN` must be exported by Infisical; the wrapper
fails fast when it is missing and never prints the value. There is no `DB_PATH`
runtime mode for the Rust backend anymore.

The removed Python backend is no longer available as a runtime fallback.

## Cutover Runbook

Pre-review checks:

```bash
bash -n scripts/run_builds_backend.sh
cd builds/backend-rust
cargo fmt --check
cargo check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

Read-only database checks must use the throwaway Central test wrapper, for
example `/home/naniadm/Documents/Deadlock-Bots/rust/scripts/central_test_db.sh`.
Do not point verification commands at a live or production DSN.

After review approval only:

```bash
systemctl --user restart deadlock-website-backend.service
```

## Verification

```bash
cargo fmt --check
cargo check
cargo build --release
```

After restart:

```bash
curl -fsS http://127.0.0.1:8772/api/health
```
