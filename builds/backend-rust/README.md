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

`scripts/run_builds_backend.sh` loads Infisical secrets first, then starts
`builds/backend-rust/target/release/ddc-website-backend` by default. Set
`WEBSITE_BACKEND_IMPL=python` only for rollback.

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
