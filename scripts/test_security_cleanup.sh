#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_CODEQL_SHA="7188fc363630916deb702c7fdcf4e481b751f97a"

mapfile -t codeql_references < <(grep -R -h 'uses: github/codeql-action/' "$ROOT_DIR/.github/workflows")
[[ "${#codeql_references[@]}" -gt 0 ]]
for reference in "${codeql_references[@]}"; do
  [[ "$reference" == *"@$EXPECTED_CODEQL_SHA # v4.37.1"* ]] || {
    echo "Unexpected CodeQL action pin: $reference" >&2
    exit 1
  }
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir "$tmp_dir/caller"

printf 'INFISICAL_SERVICE_TOKEN=test-token\n' >"$tmp_dir/infisical.conf"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "$DL_INFISICAL_READY" >"$tmp_dir/loader-ready"' \
  'printf "%s\n" "$@" >"$tmp_dir/loader-args"' \
  >"$tmp_dir/loader"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "cwd=%s\nbootstrap_token=%s\n" "$PWD" "${INFISICAL_SERVICE_TOKEN:-}" >"$RESULT_FILE"' \
  >"$tmp_dir/backend"
chmod +x "$tmp_dir/loader" "$tmp_dir/backend"

(
  cd "$tmp_dir/caller"
  tmp_dir="$tmp_dir" \
    INFISICAL_MAX_ATTEMPTS=1 \
    INFISICAL_CONFIG_FILE="$tmp_dir/infisical.conf" \
    INFISICAL_LOADER="$tmp_dir/loader" \
    RUST_BACKEND_BIN="$tmp_dir/backend" \
    "$ROOT_DIR/scripts/run_builds_backend.sh"
)

[[ "$(<"$tmp_dir/loader-ready")" == "1" ]] || {
  echo "Launcher did not mark Infisical re-entry" >&2
  exit 1
}
mapfile -t loader_args <"$tmp_dir/loader-args"
[[ "${loader_args[*]}" == "--profile all -- $ROOT_DIR/scripts/run_builds_backend.sh" ]] || {
  printf 'Unexpected loader args: %s\n' "${loader_args[*]}" >&2
  exit 1
}

(
  cd "$tmp_dir/caller"
  RESULT_FILE="$tmp_dir/result" \
    DL_INFISICAL_READY=1 \
    DEADLOCK_CENTRAL_DSN=test-dsn \
    INFISICAL_CONFIG_FILE="$tmp_dir/infisical.conf" \
    RUST_BACKEND_BIN="$tmp_dir/backend" \
    "$ROOT_DIR/scripts/run_builds_backend.sh"
)

[[ "$(<"$tmp_dir/result")" == $'cwd='"$tmp_dir/caller"$'\nbootstrap_token=' ]] || {
  echo "Launcher did not exec backend from caller without bootstrap token" >&2
  exit 1
}
