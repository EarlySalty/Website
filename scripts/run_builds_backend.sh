#!/usr/bin/env bash
# Startet das Website-Backend (builds/backend, "Deadlock Meta"-API inkl. Coaching-Plattform)
# auf 127.0.0.1. Secrets kommen wie beim Bot aus Infisical (export_infisical_env.py),
# damit u.a. TWITCH_INTERNAL_API_TOKEN (Coaching-Mirror) und Discord-OAuth verfuegbar sind.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../Website
BACKEND_DIR="$ROOT_DIR/builds/backend"
INFISICAL_CONFIG_FILE="${INFISICAL_CONFIG_FILE:-$HOME/.config/deadlock-bots/infisical.env}"
EXPORT_SCRIPT="${INFISICAL_EXPORT_SCRIPT:-/home/naniadm/Documents/Deadlock-Bots/scripts/export_infisical_env.py}"

if [[ ! -f "$INFISICAL_CONFIG_FILE" ]]; then
  echo "Missing Infisical config: $INFISICAL_CONFIG_FILE" >&2
  exit 1
fi

set -a
source "$INFISICAL_CONFIG_FILE"
set +a

if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="${PYTHON_BIN:-$BACKEND_DIR/.venv/bin/python}"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

INFISICAL_RETRY_DELAY="${INFISICAL_RETRY_DELAY:-5}"
INFISICAL_MAX_ATTEMPTS="${INFISICAL_MAX_ATTEMPTS:-0}"
attempt=0
while true; do
  if INFISICAL_EXPORT="$("$PYTHON_BIN" "$EXPORT_SCRIPT" --format shell)"; then
    eval "$INFISICAL_EXPORT"
    break
  fi
  attempt=$((attempt + 1))
  if [[ "$INFISICAL_MAX_ATTEMPTS" -gt 0 && "$attempt" -ge "$INFISICAL_MAX_ATTEMPTS" ]]; then
    echo "Infisical secrets could not be loaded after $attempt attempt(s)." >&2
    exit 1
  fi
  echo "Infisical not ready for Website Backend, retrying in ${INFISICAL_RETRY_DELAY}s (attempt $attempt)." >&2
  sleep "$INFISICAL_RETRY_DELAY"
done

export PYTHONUNBUFFERED=1
cd "$BACKEND_DIR"
exec "$PYTHON_BIN" -m uvicorn app.main:app \
  --host "${WEBSITE_BACKEND_HOST:-127.0.0.1}" \
  --port "${WEBSITE_BACKEND_PORT:-8772}"
