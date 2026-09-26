#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ROOT="/home/nathanael/Documents/Runtime/website-videos"
LIVE_DIST="/home/nathanael/repos/Website/builds/frontend/dist-ddl"

validate_video_build() {
  local build_dir="$1" asset asset_path
  test -s "$build_dir/index.html" || return 1
  grep -q '/videos/assets/' "$build_dir/index.html" || return 1
  while IFS= read -r asset; do
    asset_path="${asset#/videos/}"
    test -s "$build_dir/$asset_path" || return 1
  done < <(grep -oE '/videos/assets/[^" ]+\.(js|css)' "$build_dir/index.html")
  test -n "$(grep -oE '/videos/assets/[^" ]+\.js' "$build_dir/index.html")"
  test -n "$(grep -oE '/videos/assets/[^" ]+\.css' "$build_dir/index.html")"
}

publish_video_build() {
  local stage="$1" release_root="$2" source_sha="$3"
  local releases="$release_root/releases" target="$release_root/releases/$source_sha"
  local next_link="$release_root/.current.$source_sha.$$"
  [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Ungültige Quell-SHA" >&2; return 1; }
  validate_video_build "$stage" || { echo "Video-Build ist unvollständig" >&2; return 1; }
  mkdir -p "$releases"
  if test -e "$target"; then
    diff -qr "$stage" "$target" >/dev/null || {
      echo "Release-SHA existiert mit abweichenden Dateien: $source_sha" >&2
      return 1
    }
    rm -rf -- "$stage"
  else
    mv -- "$stage" "$target"
  fi
  if test -e "$release_root/current" && ! test -L "$release_root/current"; then
    echo "current ist kein Symlink" >&2
    return 1
  fi
  ln -s "releases/$source_sha" "$next_link"
  mv -Tf -- "$next_link" "$release_root/current"
  echo "Video-Release aktiv: $source_sha"
}

remote_main_sha() {
  git -C "$REPO_ROOT" ls-remote --exit-code --refs origin refs/heads/main | cut -f1
}

main() {
  local mode="${1:-}" source_sha stage
  case "$mode" in
    bootstrap)
      # Vor dem Entfernen der alten getrackten Dateien auf den Runtime-Pfad
      # umschalten. Caddy darf erst danach auf current zeigen.
      source_sha="$(remote_main_sha)"
      test -n "$source_sha"
      validate_video_build "$LIVE_DIST"
      mkdir -p "$RELEASE_ROOT"
      stage="$(mktemp -d "$RELEASE_ROOT/.stage.XXXXXXXX")"
      cp -a "$LIVE_DIST/." "$stage/"
      publish_video_build "$stage" "$RELEASE_ROOT" "$source_sha"
      ;;
    deploy)
      source_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
      test "$(git -C "$REPO_ROOT" branch --show-current)" = main
      test -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)"
      test "$source_sha" = "$(remote_main_sha)"
      mkdir -p "$RELEASE_ROOT"
      stage="$(mktemp -d "$RELEASE_ROOT/.stage.XXXXXXXX")"
      trap 'rm -rf -- "$stage"' EXIT
      (cd "$REPO_ROOT/builds/frontend" && npm ci --no-fund &&
        npm run build:ddl -- --outDir "$stage" --emptyOutDir)
      publish_video_build "$stage" "$RELEASE_ROOT" "$source_sha"
      trap - EXIT
      ;;
    *)
      echo "Aufruf: $0 bootstrap|deploy" >&2
      return 64
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
