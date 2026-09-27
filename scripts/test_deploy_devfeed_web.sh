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
assert_caddy_readable() {
  python3 - "$runtime" "$1" <<'PY'
from pathlib import Path
import stat
import sys

runtime = Path(sys.argv[1])
release = Path(sys.argv[2])
for directory in (runtime, runtime / 'releases', release, *release.rglob('*')):
    mode = directory.stat().st_mode
    if directory.is_dir():
        assert mode & stat.S_IROTH and mode & stat.S_IXOTH, directory
    else:
        assert mode & stat.S_IROTH, directory
PY
}
cp "$repo/scripts/deploy-devfeed-web.sh" "$source/scripts/"
cp "$repo/scripts/build-sitemap.mjs" "$source/scripts/"
cp "$repo/dl-brand/nav.js" "$source/dl-brand/"
cp "$repo/dl-devfeed/index.html" "$repo/dl-devfeed/devfeed.js" \
  "$repo/dl-devfeed/devfeed.css" "$source/dl-devfeed/"
cp "$repo/dl-devfeed/api-docs/index.html" "$source/dl-devfeed/api-docs/"
cp "$repo/dl-landing/public/sitemap.xml" "$source/dl-landing/public/"
printf 'dl-landing/dist/\ndl-devfeed/ignored.txt\n' > "$source/.gitignore"

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
printf 'nicht freigegeben\n' > "$source/dl-devfeed/ignored.txt"

printf 'lokale Änderung\n' >> "$live/dl-brand/nav.js"
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy mit getrackter Live-Änderung wurde akzeptiert.' >&2
  exit 1
fi
git -C "$live" restore -- dl-brand/nav.js
test "$(git -C "$live" rev-parse HEAD)" = "$old_sha"

# A divergent but clean live main reaches the switch, then must roll it back.
mkdir "$runtime/releases/previous"
ln -s "$runtime/releases/previous" "$runtime/current"
printf '\n// Nur lokaler Commit\n' >> "$live/dl-brand/nav.js"
git -C "$live" add dl-brand/nav.js
git -C "$live" -c user.name=Test -c user.email=test@example.invalid commit -qm divergent
divergent_sha="$(git -C "$live" rev-parse HEAD)"
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy mit divergentem Live-main wurde akzeptiert.' >&2
  exit 1
fi
test "$(readlink "$runtime/current")" = "$runtime/releases/previous"
test "$(git -C "$live" rev-parse HEAD)" = "$divergent_sha"
git -C "$live" reset -q --hard "$old_sha"

mkdir -p "$runtime/releases/$sha"
printf 'unvollständig\n' > "$runtime/releases/$sha/broken.txt"
printf '%s\n' "$sha" > "$runtime/releases/$sha/.complete"

(
  umask 077
  "$source/scripts/deploy-devfeed-web.sh" "$sha"
)
assert_caddy_readable "$runtime/releases/$sha"
# An older same-SHA release can have been published with unreadable modes.
chmod 700 "$runtime/releases/$sha" "$runtime/releases/$sha/api-docs"
chmod 600 "$runtime/releases/$sha/devfeed.js" "$runtime/releases/$sha/api-docs/index.html"
(
  umask 077
  "$source/scripts/deploy-devfeed-web.sh" "$sha"
)
assert_caddy_readable "$runtime/releases/$sha"

test "$(readlink -f "$runtime/current")" = "$runtime/releases/$sha"
test "$(git -C "$live" rev-parse HEAD)" = "$sha"
test "$(cat "$runtime/releases/$sha/.complete")" = "$sha"
test ! -e "$runtime/releases/$sha/broken.txt"
test ! -e "$runtime/releases/$sha/ignored.txt"
test "$(find "$runtime/releases" -maxdepth 1 -name ".incomplete-$sha-*" | wc -l)" -eq 1
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '<loc>https://deutsche-deadlock-community.de/devfeed/api-docs/</loc>' "$live/dl-landing/dist/sitemap.xml"
grep -q '/devfeed/' "$live/dl-brand/nav.js"
test "$(cat "$live/dl-brand/social-preview/stay.txt")" = 'fremde Datei'
test -z "$(git -C "$source" status --porcelain --untracked-files=all)"
git -C "$live" diff --quiet
git -C "$live" diff --cached --quiet

# An active release must never be moved away while current points to it.
ln -sfn "releases/$sha" "$runtime/current"
printf 'verändert\n' >> "$runtime/releases/$sha/devfeed.js"
if "$source/scripts/deploy-devfeed-web.sh" "$sha" 2>/dev/null; then
  echo 'Deploy hat einen abweichenden aktiven Release ersetzt.' >&2
  exit 1
fi
test "$(readlink -f "$runtime/current")" = "$runtime/releases/$sha"
test -f "$runtime/releases/$sha/devfeed.js"
grep -q 'verändert' "$runtime/releases/$sha/devfeed.js"
test "$(find "$runtime/releases" -maxdepth 1 -name ".incomplete-$sha-*" | wc -l)" -eq 1
printf 'DevFeed-Deploy in getrenntem Source-/Caddy-Root und SHA-Retry OK\n'
