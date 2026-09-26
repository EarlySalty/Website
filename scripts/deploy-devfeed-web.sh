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
if [[ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)" ]]; then
  echo "DevFeed Web Deploy abgelehnt: Checkout enthält uncommittete Dateien." >&2
  exit 3
fi

SOURCE="$ROOT_DIR/dl-devfeed"
LANDING_DIST="$ROOT_DIR/dl-landing/dist"
BASE="/home/nathanael/Documents/Runtime/devfeed-web"
RELEASES="$BASE/releases"
RELEASE="$RELEASES/$SHA"

SITEMAP_NEXT=""
RELEASE_STAGE=""
SWITCH_STAGE=""
cleanup() {
  if [[ -n "$SITEMAP_NEXT" && -f "$SITEMAP_NEXT" ]]; then rm -f -- "$SITEMAP_NEXT"; fi
  if [[ -n "$RELEASE_STAGE" && -d "$RELEASE_STAGE" ]]; then rm -rf -- "$RELEASE_STAGE"; fi
  if [[ -n "$SWITCH_STAGE" && -d "$SWITCH_STAGE" ]]; then rm -rf -- "$SWITCH_STAGE"; fi
}
trap cleanup EXIT

test -f "$SOURCE/index.html"
test -f "$SOURCE/devfeed.js"
test -f "$SOURCE/devfeed.css"
test -f "$SOURCE/api-docs/index.html"
test -d "$LANDING_DIST"

# Caddy serves /sitemap.xml from the landing build, not from dl-landing/public.
# Generate from this main checkout without changing its tracked source sitemap.
SITEMAP_NEXT="$(mktemp "$LANDING_DIST/.sitemap.xml.XXXXXX")"
node "$ROOT_DIR/scripts/build-sitemap.mjs" "$SITEMAP_NEXT"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/</loc>' "$SITEMAP_NEXT"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/api-docs/</loc>' "$SITEMAP_NEXT"
chmod 644 "$SITEMAP_NEXT"

mkdir -p "$RELEASES"
if [[ ! -f "$RELEASE/.complete" ]] || [[ "$(cat "$RELEASE/.complete")" != "$SHA" ]]; then
  RELEASE_STAGE="$(mktemp -d "$RELEASES/.release-$SHA.XXXXXX")"
  cp -a "$SOURCE/." "$RELEASE_STAGE/"
  printf '%s\n' "$SHA" > "$RELEASE_STAGE/.complete"
  if [[ -e "$RELEASE" ]]; then
    mv -T "$RELEASE" "$RELEASES/.incomplete-$SHA-$(date +%s)-$$"
  fi
  mv -T "$RELEASE_STAGE" "$RELEASE"
  RELEASE_STAGE=""
fi

SWITCH_STAGE="$(mktemp -d "$BASE/.switch-$SHA.XXXXXX")"
ln -s "$RELEASE" "$SWITCH_STAGE/current"
mv -f "$SITEMAP_NEXT" "$LANDING_DIST/sitemap.xml"
SITEMAP_NEXT=""
mv -Tf "$SWITCH_STAGE/current" "$BASE/current"
rmdir "$SWITCH_STAGE"
SWITCH_STAGE=""

printf 'DevFeed Web deployed sha=%s
' "$SHA"
