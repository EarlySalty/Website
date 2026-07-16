# Website-Backend – Workflow

## Aktueller Stand

Das aktive Website-Backend liegt unter `builds/backend-rust`. Das frühere
FastAPI-/SQLite-Backend ist entfernt und steht nicht mehr als Fallback zur
Verfügung.

Der Rust-Dienst:

- läuft lokal auf `127.0.0.1:8772`,
- nutzt die zentrale Postgres-Datenbank über `DEADLOCK_CENTRAL_DSN`,
- wird durch `deadlock-website-backend.service` gestartet,
- lädt Secrets ausschließlich über `scripts/run_builds_backend.sh` aus
  Infisical.

Das öffentliche `/builds/`-Portal ist davon getrennt: Caddy liefert dort
`dl-tierlist/dist` aus und leitet dessen API an den Dienst auf Port `8771`
weiter.

## Projektstruktur

```text
builds/
├── backend-rust/  # Rust/Axum, SQLx, zentrale Postgres-Datenbank
├── frontend/      # React/Vite-Frontend für die Website-Anwendungen
└── WORKFLOW.md
```

## Lokal prüfen

```bash
cd /home/naniadm/Documents/Website/builds/backend-rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --release
```

DB-Tests dürfen nur gegen die Wegwerf-Testdatenbank laufen. Die Scrim-Tests
erwarten zusätzlich `DATABASE_URL_TEST`:

```bash
cd /home/naniadm/Documents/Deadlock-Bots/rust
./scripts/central_test_db.sh bash -lc \
  'unset SQLX_OFFLINE; export DATABASE_URL_TEST="$CENTRAL_TEST_DSN" DATABASE_URL="$CENTRAL_TEST_DSN"; cargo test --manifest-path /home/naniadm/Documents/Website/builds/backend-rust/Cargo.toml --all-features'
```

## Produktion

Nach einem verifizierten Release-Build wird der User-Service neu gestartet:

```bash
cd /home/naniadm/Documents/Website/builds/backend-rust
cargo build --release
systemctl --user restart deadlock-website-backend.service
curl -fsS http://127.0.0.1:8772/api/health
```

Der Dienst soll nicht direkt gestartet werden. Der systemd-Service ruft den
Infisical-Wrapper auf und stellt damit die benötigte Laufzeitkonfiguration
bereit.

Weitere Betriebsdetails stehen in `builds/backend-rust/README.md`.
