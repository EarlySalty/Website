#!/usr/bin/env bash
# Startet das Rust-Website-Backend ("Deadlock Meta"-API inkl. Coaching-Plattform)
# auf 127.0.0.1. Secrets kommen wie beim Bot aus Infisical (dl-infisical-env),
# damit u.a. TWITCH_INTERNAL_API_TOKEN (Coaching-Mirror) und Discord-OAuth verfuegbar sind.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../Website
RUST_BACKEND_BIN="${RUST_BACKEND_BIN:-$ROOT_DIR/builds/backend-rust/target/release/ddc-website-backend}"
INFISICAL_CONFIG_FILE="${INFISICAL_CONFIG_FILE:-$HOME/.config/deadlock-bots/infisical.conf}"

if [[ ! -f "$INFISICAL_CONFIG_FILE" ]]; then
  echo "Missing Infisical config: $INFISICAL_CONFIG_FILE" >&2
  exit 1
fi

set -a
source "$INFISICAL_CONFIG_FILE"
set +a

if [[ -n "${CREDENTIALS_DIRECTORY:-}" && -f "$CREDENTIALS_DIRECTORY/infisical-token" ]]; then
  INFISICAL_SERVICE_TOKEN="$(<"$CREDENTIALS_DIRECTORY/infisical-token")"
  export INFISICAL_SERVICE_TOKEN
fi

if [[ -z "${INFISICAL_SERVICE_TOKEN:-}" ]]; then
  echo "INFISICAL_SERVICE_TOKEN nicht gesetzt — weder in $INFISICAL_CONFIG_FILE noch via systemd-creds." >&2
  exit 1
fi

INFISICAL_LOADER="${INFISICAL_LOADER:-/home/naniadm/.local/bin/dl-infisical-env}"
if [[ "${DL_INFISICAL_READY:-0}" != "1" ]]; then
  if [[ ! -x "$INFISICAL_LOADER" ]]; then
    echo "Infisical loader nicht gefunden oder nicht ausführbar: $INFISICAL_LOADER" >&2
    exit 1
  fi
  export DL_INFISICAL_READY=1
  exec "$INFISICAL_LOADER" --profile all -- "$0" "$@"
fi
unset DL_INFISICAL_READY
unset INFISICAL_SERVICE_TOKEN

# Eigene oeffentliche OAuth-Rueck-Adresse (redirect_after im delegierten Flow):
# Der zentrale Broker (/callback/discord, 127.0.0.1:8766) leitet nach dem
# Discord-Login hierher zurueck. Caddy strippt /coaching, bevor das Backend die
# Anfrage sieht -> ohne diese Zeile baut das Backend die URL ohne /coaching-Praefix
# und der Broker landet auf einem 404. Die bei Discord registrierte URI bleibt
# unveraendert (/callback/discord); das hier ist nur die Rueckleitung an diesen Dienst.
# Scrim-Funktionen laufen ueber den Turnierdienst statt ueber das alte Website-Backend.
# Die beiden Basis-URLs haben in config.rs passende Loopback-Defaults (8900 turnier-bot,
# 8770 dl-bot-Broker); die Tokens kommen aus Infisical. Zurueck auf den alten Weg:
# diese Zeile auf "legacy" setzen und das Backend neu starten.
export SCRIM_BACKEND_MODE=proxy

export AUTH_PUBLIC_CALLBACK_URL="https://deutsche-deadlock-community.de/coaching/api/auth/discord/callback"
export DISCORD_ROLE_CONNECTION_CALLBACK_URL="https://deutsche-deadlock-community.de/coaching/api/auth/discord/linked-role/callback"

if [[ ! -x "$RUST_BACKEND_BIN" ]]; then
  echo "Rust Website Backend fehlt oder ist nicht ausführbar: $RUST_BACKEND_BIN" >&2
  exit 1
fi
if [[ -z "${DEADLOCK_CENTRAL_DSN:-}" ]]; then
  echo "DEADLOCK_CENTRAL_DSN fehlt nach Infisical-Export; Rust Website Backend startet nicht." >&2
  exit 1
fi
echo "Rust Website Backend: central DB DSN present: true" >&2
exec "$RUST_BACKEND_BIN"
