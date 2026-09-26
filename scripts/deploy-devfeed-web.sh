#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="${1:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Nutzung: $0 <gemergter-main-sha>" >&2
  exit 2
fi

HEAD_SHA="$(git -C "$SOURCE_ROOT" rev-parse HEAD)"
BRANCH="$(git -C "$SOURCE_ROOT" branch --show-current)"
if [[ "$HEAD_SHA" != "$SHA" || ( "$BRANCH" != "main" && -n "$BRANCH" ) ]]; then
  echo "DevFeed Web Deploy abgelehnt: Source-Checkout ist nicht exakt der angegebene main SHA." >&2
  exit 3
fi
if [[ -n "$(git -C "$SOURCE_ROOT" status --porcelain --untracked-files=all)" ]]; then
  echo "DevFeed Web Deploy abgelehnt: Source-Checkout enthält uncommittete Dateien." >&2
  exit 3
fi
if ! REMOTE_MAIN="$(git -C "$SOURCE_ROOT" ls-remote --exit-code origin refs/heads/main)"; then
  echo "DevFeed Web Deploy abgelehnt: Remote-main ist nicht erreichbar." >&2
  exit 3
fi
if [[ "$REMOTE_MAIN" != "$SHA"$'\t'refs/heads/main ]]; then
  echo "DevFeed Web Deploy abgelehnt: SHA ist nicht der aktuelle Remote-main." >&2
  exit 3
fi

SOURCE="$SOURCE_ROOT/dl-devfeed"
# Caddy serves these files from the live checkout, even when the approved
# source SHA is built in a separate, clean worktree.
LIVE_ROOT="/home/naniadm/Documents/Website"
LANDING_DIST="$LIVE_ROOT/dl-landing/dist"
LIVE_NAV="$LIVE_ROOT/dl-brand/nav.js"
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
test -f "$SOURCE_ROOT/dl-brand/nav.js"
test -d "$LANDING_DIST"
test -f "$LIVE_NAV"

# The live checkout owns tracked /brand assets. Preserve unrelated untracked
# files (for example social-preview/) while refusing local tracked changes.
if [[ "$(git -C "$LIVE_ROOT" branch --show-current)" != "main" ]] \
  || ! git -C "$LIVE_ROOT" diff --quiet \
  || ! git -C "$LIVE_ROOT" diff --cached --quiet; then
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout ist nicht main oder enthält getrackte Änderungen." >&2
  exit 3
fi
if ! git -C "$LIVE_ROOT" fetch --no-tags origin main; then
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout kann Remote-main nicht laden." >&2
  exit 3
fi
if [[ "$(git -C "$LIVE_ROOT" rev-parse FETCH_HEAD)" != "$SHA" ]]; then
  echo "DevFeed Web Deploy abgelehnt: Remote-main hat sich während der Prüfung geändert." >&2
  exit 3
fi
if ! git -C "$LIVE_ROOT" merge --ff-only "$SHA"; then
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout kann nicht sicher nachgezogen werden." >&2
  exit 3
fi
if [[ "$(git -C "$LIVE_ROOT" rev-parse HEAD)" != "$SHA" ]] \
  || ! git -C "$LIVE_ROOT" diff --quiet \
  || ! git -C "$LIVE_ROOT" diff --cached --quiet \
  || ! cmp -s "$SOURCE_ROOT/dl-brand/nav.js" "$LIVE_NAV"; then
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout weicht vom freigegebenen SHA ab." >&2
  exit 3
fi

# Caddy serves /sitemap.xml from the landing build, not from dl-landing/public.
# Generate from this main checkout without changing its tracked source sitemap.
SITEMAP_NEXT="$(mktemp "$LANDING_DIST/.sitemap.xml.XXXXXX")"
node "$SOURCE_ROOT/scripts/build-sitemap.mjs" "$SITEMAP_NEXT"
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
mv -Tf "$SWITCH_STAGE/current" "$BASE/current"
rmdir "$SWITCH_STAGE"
SWITCH_STAGE=""
# Publish the sitemap only after the complete release is the active Caddy target.
mv -f "$SITEMAP_NEXT" "$LANDING_DIST/sitemap.xml"
SITEMAP_NEXT=""

printf 'DevFeed Web deployed sha=%s
' "$SHA"
