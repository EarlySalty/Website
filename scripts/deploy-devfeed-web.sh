#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="${1:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Nutzung: $0 <gemergter-main-sha>" >&2
  exit 2
fi

HEAD_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
BRANCH="$(git -C "$ROOT_DIR" branch --show-current)"
if [[ "$HEAD_SHA" != "$SHA" || "$BRANCH" != "main" ]]; then
  echo "DevFeed Web Deploy abgelehnt: Checkout ist nicht exakt der angegebene main SHA." >&2
  exit 3
fi

SOURCE="$ROOT_DIR/dl-devfeed"
BASE="/home/nathanael/Documents/Runtime/devfeed-web"
RELEASES="$BASE/releases"
RELEASE="$RELEASES/$SHA"
NEXT="$BASE/.current-$SHA"

test -f "$SOURCE/index.html"
test -f "$SOURCE/devfeed.js"
test -f "$SOURCE/devfeed.css"
test -f "$SOURCE/api-docs/index.html"

mkdir -p "$RELEASES"
if [[ ! -d "$RELEASE" ]]; then
  mkdir "$RELEASE"
  cp -a "$SOURCE/." "$RELEASE/"
fi

ln -s "$RELEASE" "$NEXT"
mv -Tf "$NEXT" "$BASE/current"

printf 'DevFeed Web deployed sha=%s
' "$SHA"
