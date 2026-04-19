#!/usr/bin/env bash
# Lokale Code-Qualität und Security-Prüfung
# Voraussetzung: pip install ruff mypy bandit; npm ci in builds/frontend

set -euo pipefail

cd "$(dirname "$0")/.."

fail=0

run_check() {
  local name="$1"
  shift
  echo
  echo "=== $name ==="
  if "$@"; then
    echo "✅ $name: OK"
  else
    echo "❌ $name: FEHLGESCHLAGEN"
    fail=1
  fi
}

run_check "Ruff Lint" \
  ruff check builds/backend/ dl-landing/mcp-server/

run_check "Ruff Format" \
  ruff format builds/backend/ dl-landing/mcp-server/ --check

run_check "mypy Type Check" \
  mypy builds/backend/ dl-landing/mcp-server/ --ignore-missing-imports --no-error-summary

run_check "Bandit Security SAST" \
  bandit -r builds/backend dl-landing/mcp-server -ll -ii

run_check "Frontend ESLint" \
  bash -c "cd builds/frontend && npm run lint"

run_check "Frontend TypeScript" \
  bash -c "cd builds/frontend && npx tsc --noEmit"

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ Alle lokalen Checks bestanden."
else
  echo "❌ Einige Checks sind fehlgeschlagen."
  exit 1
fi
