#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_CODEQL_SHA="99df26d4f13ea111d4ec1a7dddef6063f76b97e9"

mapfile -t codeql_references < <(grep -R -h 'uses: github/codeql-action/' "$ROOT_DIR/.github/workflows")
[[ "${#codeql_references[@]}" -gt 0 ]]
for reference in "${codeql_references[@]}"; do
  [[ "$reference" == *"@$EXPECTED_CODEQL_SHA # v4.37.0"* ]] || {
    echo "Unexpected CodeQL action pin: $reference" >&2
    exit 1
  }
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir "$tmp_dir/caller"

printf 'INFISICAL_SERVICE_TOKEN=test-token\n' >"$tmp_dir/infisical.conf"
printf '%s\n' \
  '#!/usr/bin/env python3' \
  'import sys' \
  'assert sys.argv[1:] == ["--format", "shell"]' \
  'print("export DEADLOCK_CENTRAL_DSN=test-dsn")' \
  >"$tmp_dir/export.py"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "$PWD" >"$RESULT_FILE"' \
  >"$tmp_dir/backend"
chmod +x "$tmp_dir/backend"

(
  cd "$tmp_dir/caller"
  RESULT_FILE="$tmp_dir/result" \
    INFISICAL_CONFIG_FILE="$tmp_dir/infisical.conf" \
    INFISICAL_EXPORT_SCRIPT="$tmp_dir/export.py" \
    RUST_BACKEND_BIN="$tmp_dir/backend" \
    "$ROOT_DIR/scripts/run_builds_backend.sh"
)

[[ "$(<"$tmp_dir/result")" == "$tmp_dir/caller" ]] || {
  echo "Launcher changed its working directory" >&2
  exit 1
}
