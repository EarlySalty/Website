#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT

source="$fixture/source"
live="$fixture/live"
runtime="$fixture/runtime"
remote="$fixture/remote.git"
mkdir -p "$source/scripts" "$source/dl-brand" "$source/dl-devfeed/api-docs" \
  "$source/dl-landing/public" "$runtime/releases"
cp "$repo/scripts/deploy-devfeed-web.sh" "$source/scripts/"
cp "$repo/scripts/build-sitemap.mjs" "$source/scripts/"
cp "$repo/dl-brand/nav.js" "$source/dl-brand/"
cp "$repo/dl-devfeed/index.html" "$repo/dl-devfeed/devfeed.js" \
  "$repo/dl-devfeed/devfeed.css" "$source/dl-devfeed/"
cp "$repo/dl-devfeed/api-docs/index.html" "$source/dl-devfeed/api-docs/"
cp "$repo/dl-landing/public/sitemap.xml" "$source/dl-landing/public/"
printf 'dl-landing/dist/\n' > "$source/.gitignore"

# The production paths remain fixed. Only this isolated fixture redirects them.
python3 - "$source/scripts/deploy-devfeed-web.sh" "$live" "$runtime" <<'PY'
from pathlib import Path
import sys

script = Path(sys.argv[1])
body = script.read_text()
body = body.replace('/home/naniadm/Documents/Website', sys.argv[2])
body = body.replace('/home/nathanael/Documents/Runtime/devfeed-web', sys.argv[3])
script.write_text(body)
PY

git -C "$source" init -q -b main
git -C "$source" -c user.name=Test -c user.email=test@example.invalid add .
git -C "$source" -c user.name=Test -c user.email=test@example.invalid commit -qm base
old_sha="$(git -C "$source" rev-parse HEAD)"
git init -q --bare -b main "$remote"
git -C "$source" remote add origin "$remote"
git -C "$source" push -q -u origin main
git clone -q "$remote" "$live"
mkdir -p "$live/dl-brand/social-preview" "$live/dl-landing/dist"
printf 'alter Sitemapstand\n' > "$live/dl-landing/dist/sitemap.xml"
printf 'fremde Datei\n' > "$live/dl-brand/social-preview/stay.txt"

printf '\n// DevFeed-Release\n' >> "$source/dl-brand/nav.js"
git -C "$source" add dl-brand/nav.js
git -C "$source" -c user.name=Test -c user.email=test@example.invalid commit -qm release
sha="$(git -C "$source" rev-parse HEAD)"

# A locally valid new SHA must not deploy before remote main has it.
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy ohne Remote-main-Beleg wurde akzeptiert.' >&2
  exit 1
fi
if "$source/scripts/deploy-devfeed-web.sh" "$old_sha" 2>/dev/null; then
  echo 'Deploy mit falschem Source-SHA wurde akzeptiert.' >&2
  exit 1
fi
git -C "$source" remote remove origin
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy ohne origin wurde akzeptiert.' >&2
  exit 1
fi
git -C "$source" remote add origin "$remote"
git -C "$source" push -q origin main
git -C "$source" checkout -q --detach "$sha"

printf 'lokale Änderung\n' >> "$live/dl-brand/nav.js"
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy mit getrackter Live-Änderung wurde akzeptiert.' >&2
  exit 1
fi
git -C "$live" restore -- dl-brand/nav.js
test "$(git -C "$live" rev-parse HEAD)" = "$old_sha"
mkdir "$runtime/releases/$sha"
printf 'unvollständig\n' > "$runtime/releases/$sha/broken.txt"

"$source/scripts/deploy-devfeed-web.sh" "$sha"
"$source/scripts/deploy-devfeed-web.sh" "$sha"

test "$(readlink -f "$runtime/current")" = "$runtime/releases/$sha"
test "$(git -C "$live" rev-parse HEAD)" = "$sha"
test "$(cat "$runtime/releases/$sha/.complete")" = "$sha"
test "$(find "$runtime/releases" -maxdepth 1 -name ".incomplete-$sha-*" | wc -l)" -eq 1
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/api-docs/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '/devfeed/' "$live/dl-brand/nav.js"
test "$(cat "$live/dl-brand/social-preview/stay.txt")" = 'fremde Datei'
test -z "$(git -C "$source" status --porcelain --untracked-files=all)"
git -C "$live" diff --quiet
git -C "$live" diff --cached --quiet
printf 'DevFeed-Deploy in getrenntem Source-/Caddy-Root und SHA-Retry OK\n'
