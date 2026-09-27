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
# Caddy serves /sitemap.xml from the landing build, not from dl-landing/public.
# Generate from this main checkout without changing its tracked source sitemap.
SITEMAP_NEXT="$(mktemp "$LANDING_DIST/.sitemap.xml.XXXXXX")"
node "$SOURCE_ROOT/scripts/build-sitemap.mjs" "$SITEMAP_NEXT"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/</loc>' "$SITEMAP_NEXT"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/api-docs/</loc>' "$SITEMAP_NEXT"
chmod 644 "$SITEMAP_NEXT"

mkdir -p "$RELEASES"
# Caddy traverses both directories to reach current, including on a first deploy
# started with a restrictive umask.
chmod a+rx "$BASE" "$RELEASES"
RELEASE_STAGE="$(mktemp -d "$RELEASES/.release-$SHA.XXXXXX")"
# Export the approved Git tree, never ignored or untracked source files.
git -C "$SOURCE_ROOT" archive --format=tar "$SHA" dl-devfeed \
  | tar -x -C "$RELEASE_STAGE" --strip-components=1
for required in index.html devfeed.js devfeed.css api-docs/index.html; do
  if [[ ! -f "$RELEASE_STAGE/$required" ]]; then
    echo "DevFeed Web Deploy abgelehnt: freigegebener Release enthält $required nicht." >&2
    exit 3
  fi
done
printf '%s\n' "$SHA" > "$RELEASE_STAGE/.complete"
chmod -R a+rX "$RELEASE_STAGE"
if [[ -d "$RELEASE" ]] && diff -qr "$RELEASE_STAGE" "$RELEASE" >/dev/null; then
  rm -rf -- "$RELEASE_STAGE"
else
  if [[ -e "$RELEASE" || -L "$RELEASE" ]]; then
    if [[ -L "$BASE/current" ]] \
      && [[ "$(readlink -f "$BASE/current")" == "$(readlink -f "$RELEASE")" ]]; then
      echo "DevFeed Web Deploy abgelehnt: aktiver Release weicht vom freigegebenen SHA ab." >&2
      exit 3
    fi
    mv -T "$RELEASE" "$RELEASES/.incomplete-$SHA-$(date +%s)-$$"
  fi
  mv -T "$RELEASE_STAGE" "$RELEASE"
fi
RELEASE_STAGE=""
# A same-SHA retry may reuse a release written by an older deploy with 0700/0600
# permissions. Repair that release before current can point to it.
chmod -R a+rX "$RELEASE"

if [[ -e "$BASE/current" && ! -L "$BASE/current" ]]; then
  echo "DevFeed Web Deploy abgelehnt: current ist kein Symlink." >&2
  exit 3
fi
PREVIOUS_CURRENT="$(readlink "$BASE/current" 2>/dev/null || true)"
rollback_current() {
  if [[ "$(readlink "$BASE/current" 2>/dev/null || true)" != "$RELEASE" ]]; then
    return
  fi
  if [[ -n "$PREVIOUS_CURRENT" ]]; then
    SWITCH_STAGE="$(mktemp -d "$BASE/.rollback-$SHA.XXXXXX")"
    ln -s "$PREVIOUS_CURRENT" "$SWITCH_STAGE/current"
    mv -Tf "$SWITCH_STAGE/current" "$BASE/current"
    rmdir "$SWITCH_STAGE"
    SWITCH_STAGE=""
  else
    rm -f -- "$BASE/current"
  fi
}

# The route exists before the live nav can advertise it. If fast-forwarding
# fails, put the previous route back and leave the live checkout untouched.
SWITCH_STAGE="$(mktemp -d "$BASE/.switch-$SHA.XXXXXX")"
ln -s "$RELEASE" "$SWITCH_STAGE/current"
mv -Tf "$SWITCH_STAGE/current" "$BASE/current"
rmdir "$SWITCH_STAGE"
SWITCH_STAGE=""
if ! git -C "$LIVE_ROOT" merge --ff-only "$SHA"; then
  rollback_current
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout kann nicht sicher nachgezogen werden." >&2
  exit 3
fi
if [[ "$(git -C "$LIVE_ROOT" rev-parse HEAD)" != "$SHA" ]] \
  || ! git -C "$LIVE_ROOT" diff --quiet \
  || ! git -C "$LIVE_ROOT" diff --cached --quiet \
  || ! cmp -s "$SOURCE_ROOT/dl-brand/nav.js" "$LIVE_NAV"; then
  # After a successful fast-forward the navigation may already advertise the
  # route. Keep the route available; a retry can finish sitemap publication.
  echo "DevFeed Web Deploy abgelehnt: Live-Checkout weicht vom freigegebenen SHA ab." >&2
  exit 3
fi
# Publish the sitemap only after the complete release is the active Caddy target.
mv -f "$SITEMAP_NEXT" "$LANDING_DIST/sitemap.xml"
SITEMAP_NEXT=""

printf 'DevFeed Web deployed sha=%s
' "$SHA"
