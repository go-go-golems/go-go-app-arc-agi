#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI"
PORT="${ARC_SMOKE_PORT:-18081}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${ARC_SMOKE_LOG:-/tmp/arc_agi_smoke_${PORT}.log}"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required but not found on PATH" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

cd "${ROOT}"

uv run python - <<PY >"${LOG_FILE}" 2>&1 &
import arc_agi
from arc_agi import OperationMode

arc = arc_agi.Arcade(
    operation_mode=OperationMode.OFFLINE,
    environments_dir="test_environment_files",
)
arc.listen_and_serve(host="127.0.0.1", port=${PORT})
PY
SERVER_PID=$!

for _ in $(seq 1 50); do
  if curl -sf "${BASE_URL}/api/healthcheck" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "${BASE_URL}/api/healthcheck" >/dev/null 2>&1; then
  echo "ARC server did not become healthy; see ${LOG_FILE}" >&2
  exit 1
fi

printf '\n== health ==\n'
curl -sS "${BASE_URL}/api/healthcheck"
printf '\n'

printf '\n== games (first 5 ids) ==\n'
curl -sS "${BASE_URL}/api/games" | jq '.[0:5] | map(.game_id // .id)'

printf '\n== open scorecard ==\n'
CARD_ID=$(curl -sS -X POST "${BASE_URL}/api/scorecard/open" \
  -H 'content-type: application/json' \
  -d '{"tags":["smoke"]}' | jq -r '.card_id')
echo "card_id=${CARD_ID}"

printf '\n== close scorecard ==\n'
curl -sS -X POST "${BASE_URL}/api/scorecard/close" \
  -H 'content-type: application/json' \
  -d "{\"card_id\":\"${CARD_ID}\"}" | jq '{card_id, score, environments_count: (.environments | length)}'

echo "\nSmoke completed successfully."
