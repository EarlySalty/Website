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

`scripts/run_builds_backend.sh` loads Infisical secrets first, then starts
`builds/backend-rust/target/release/ddc-website-backend` by default. For the
Rust backend, `DEADLOCK_CENTRAL_DSN` must be exported by Infisical; the wrapper
fails fast when it is missing and never prints the value. There is no `DB_PATH`
runtime mode for the Rust backend anymore.

Set `WEBSITE_BACKEND_IMPL=python` only for rollback. The Python backend remains a
fallback path, not the target of the Central-Postgres migration.

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
