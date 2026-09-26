#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT

source="$fixture/source"
live="$fixture/live"
runtime="$fixture/runtime"
mkdir -p "$source/scripts" "$source/dl-brand" "$source/dl-devfeed/api-docs" \
  "$source/dl-landing/public" "$live/dl-brand/social-preview" \
  "$live/dl-landing/dist" "$runtime/releases"
cp "$repo/scripts/deploy-devfeed-web.sh" "$source/scripts/"
cp "$repo/scripts/build-sitemap.mjs" "$source/scripts/"
cp "$repo/dl-brand/nav.js" "$source/dl-brand/"
cp "$repo/dl-devfeed/index.html" "$repo/dl-devfeed/devfeed.js" \
  "$repo/dl-devfeed/devfeed.css" "$source/dl-devfeed/"
cp "$repo/dl-devfeed/api-docs/index.html" "$source/dl-devfeed/api-docs/"
cp "$repo/dl-landing/public/sitemap.xml" "$source/dl-landing/public/"
printf 'alter Navigationsstand\n' > "$live/dl-brand/nav.js"
printf 'alter Sitemapstand\n' > "$live/dl-landing/dist/sitemap.xml"
printf 'fremde Datei\n' > "$live/dl-brand/social-preview/stay.txt"

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
git -C "$source" -c user.name=Test -c user.email=test@example.invalid commit -qm fixture
sha="$(git -C "$source" rev-parse HEAD)"
mkdir "$runtime/releases/$sha"
printf 'unvollständig\n' > "$runtime/releases/$sha/broken.txt"

"$source/scripts/deploy-devfeed-web.sh" "$sha"
"$source/scripts/deploy-devfeed-web.sh" "$sha"

test "$(readlink -f "$runtime/current")" = "$runtime/releases/$sha"
test "$(cat "$runtime/releases/$sha/.complete")" = "$sha"
test "$(find "$runtime/releases" -maxdepth 1 -name ".incomplete-$sha-*" | wc -l)" -eq 1
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/api-docs/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '/devfeed/' "$live/dl-brand/nav.js"
test "$(cat "$live/dl-brand/social-preview/stay.txt")" = 'fremde Datei'
test -z "$(git -C "$source" status --porcelain --untracked-files=all)"
printf 'DevFeed-Deploy in getrenntem Source-/Caddy-Root und SHA-Retry OK\n'
