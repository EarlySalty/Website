#!/usr/bin/env bash
# Lokale Code-Qualität und Security-Prüfung
# Voraussetzung: npm ci in builds/frontend

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

run_check "Frontend TypeScript" \
  bash -c "cd builds/frontend && npx tsc --noEmit"

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ Alle lokalen Checks bestanden."
else
  echo "❌ Einige Checks sind fehlgeschlagen."
  exit 1
fi
