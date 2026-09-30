#!/usr/bin/env bash
# Veröffentlichung und Wiederanlauf sind getrennte Schritte: nur hier bauen.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_ROOT=/opt/deadlock/website-backend

if [[ -e "$RELEASE_ROOT/current" && ! -L "$RELEASE_ROOT/current" ]]; then
  echo "Release-Ziel current ist kein Symlink; Veröffentlichung abgebrochen." >&2
  exit 1
fi
previous_release="$(readlink "$RELEASE_ROOT/current" || true)"
"$ROOT_DIR/scripts/run_builds_backend.sh" --check-deploy
release_sha="$(git -C "$ROOT_DIR" rev-parse HEAD)"
if [[ -e "$RELEASE_ROOT/releases/$release_sha" ]]; then
  echo "Release existiert bereits und wird nicht überschrieben: $release_sha" >&2
  exit 1
fi

cargo build --release --locked --manifest-path "$ROOT_DIR/builds/backend-rust/Cargo.toml"
target_directory="$(cargo metadata --no-deps --format-version 1 --manifest-path "$ROOT_DIR/builds/backend-rust/Cargo.toml" | jq -er '.target_directory')"
# Auch nach dem Build müssen Quelle und geprüfte Freigabe noch zusammenpassen.
"$ROOT_DIR/scripts/run_builds_backend.sh" --check-deploy
if [[ "$(git -C "$ROOT_DIR" rev-parse HEAD)" != "$release_sha" ]]; then
  echo "Git-Stand während des Builds verändert; Veröffentlichung abgebrochen." >&2
  exit 1
fi

mkdir -p "$RELEASE_ROOT/releases"
release_stage="$(mktemp -d "$RELEASE_ROOT/releases/.staging.XXXXXXXX")"
link_stage="$RELEASE_ROOT/.current-$release_sha-$$"
trap 'rm -rf "$release_stage"; rm -f "$link_stage"' EXIT
install -m 0755 "$target_directory/release/ddc-website-backend" "$release_stage/ddc-website-backend"
printf '%s\n' "$release_sha" > "$release_stage/source-sha.txt"
(cd "$release_stage" && sha256sum ddc-website-backend > SHA256SUMS)
mv -T "$release_stage" "$RELEASE_ROOT/releases/$release_sha"
ln -s "releases/$release_sha" "$link_stage"
mv -Tf "$link_stage" "$RELEASE_ROOT/current"
if ! systemctl --user restart deadlock-website-backend.service || ! curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused http://127.0.0.1:8772/api/health; then
  echo "Neues Release nicht gesund; vorheriges Release wird wiederhergestellt." >&2
  if [[ -n "$previous_release" ]]; then
    ln -s "$previous_release" "$link_stage"
    mv -Tf "$link_stage" "$RELEASE_ROOT/current"
    systemctl --user restart deadlock-website-backend.service
  else
    rm -f "$RELEASE_ROOT/current"
    systemctl --user stop deadlock-website-backend.service
  fi
  exit 1
fi
