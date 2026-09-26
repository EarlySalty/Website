#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/release_videos_frontend.sh"
probe="$(mktemp -d)"
trap 'rm -rf -- "$probe"' EXIT
sha_one="1111111111111111111111111111111111111111"
sha_two="2222222222222222222222222222222222222222"

make_build() {
  local dir="$1" content="$2"
  mkdir -p "$dir/assets"
  printf '<script src="/videos/assets/app.js"></script><link href="/videos/assets/app.css" rel="stylesheet">\n' > "$dir/index.html"
  printf '%s\n' "$content" > "$dir/assets/app.js"
  printf 'body{color:#fff}\n' > "$dir/assets/app.css"
}

make_build "$probe/stage-one" first
publish_video_build "$probe/stage-one" "$probe/runtime" "$sha_one"
test "$(readlink "$probe/runtime/current")" = "releases/$sha_one"
test -s "$probe/runtime/current/assets/app.css"

make_build "$probe/retry" first
publish_video_build "$probe/retry" "$probe/runtime" "$sha_one"
test ! -e "$probe/retry"

make_build "$probe/changed" changed
if publish_video_build "$probe/changed" "$probe/runtime" "$sha_one" 2>/dev/null; then
  echo 'Geänderter Inhalt unter derselben SHA wurde akzeptiert' >&2
  exit 1
fi
test "$(readlink "$probe/runtime/current")" = "releases/$sha_one"

make_build "$probe/incomplete" incomplete
rm "$probe/incomplete/assets/app.css"
if publish_video_build "$probe/incomplete" "$probe/runtime" "$sha_two" 2>/dev/null; then
  echo 'Unvollständiger Build wurde aktiviert' >&2
  exit 1
fi
test "$(readlink "$probe/runtime/current")" = "releases/$sha_one"

make_build "$probe/stage-two" second
publish_video_build "$probe/stage-two" "$probe/runtime" "$sha_two"
test "$(readlink "$probe/runtime/current")" = "releases/$sha_two"
test -s "$probe/runtime/releases/$sha_one/index.html"
echo 'Video-Release-Tests: Veröffentlichung, Retry, Fail-closed und atomarer Wechsel bestanden'
