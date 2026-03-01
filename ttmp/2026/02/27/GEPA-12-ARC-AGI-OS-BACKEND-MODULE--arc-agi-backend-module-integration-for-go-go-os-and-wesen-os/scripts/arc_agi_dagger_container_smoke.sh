#!/usr/bin/env bash
set -euo pipefail

ARC_SRC="/home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI"
ARC_PORT="${ARC_DAGGER_PORT:-18081}"
LOG_FILE="${ARC_DAGGER_LOG:-/tmp/arc_agi_dagger_up.log}"
SERVER_SCRIPT="/home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/run_arc_server_offline.py"

if ! command -v dagger >/dev/null 2>&1; then
  echo "dagger is required but not found on PATH" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not found on PATH" >&2
  exit 1
fi

cleanup() {
  if [[ -n "${UP_PID:-}" ]] && kill -0 "${UP_PID}" >/dev/null 2>&1; then
    kill "${UP_PID}" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "${UP_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

rm -f "$LOG_FILE"

# Launch ARC server in a Dagger-managed container and expose it via random localhost tunnel port.
dagger --progress=plain core container \
  from --address python:3.12-slim \
  with-mounted-directory --path /src --source "$ARC_SRC" \
  with-mounted-file --path /tmp/run_arc_server_offline.py --source "$SERVER_SCRIPT" \
  with-workdir --path /src \
  with-exec --args pip --args install --args uv \
  with-exec --args uv --args sync --args --frozen \
  with-exposed-port --port "$ARC_PORT" \
  up --random \
  --args uv --args run --args python --args /tmp/run_arc_server_offline.py \
  >"$LOG_FILE" 2>&1 &
UP_PID=$!

BASE_URL=""
for _ in $(seq 1 240); do
  BASE_URL=$(grep -o 'http_url=http://localhost:[0-9]\+' "$LOG_FILE" | tail -n1 | cut -d= -f2 || true)
  if [[ -n "$BASE_URL" ]]; then
    break
  fi
  if ! kill -0 "$UP_PID" >/dev/null 2>&1; then
    echo "Dagger up process exited early. Last log lines:" >&2
    tail -n 120 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 0.5
done

if [[ -z "$BASE_URL" ]]; then
  echo "Could not determine tunnel URL from Dagger logs. Last log lines:" >&2
  tail -n 160 "$LOG_FILE" >&2 || true
  exit 1
fi

printf '\nDagger tunnel: %s\n' "$BASE_URL"

# Wait for app-level health endpoint.
for _ in $(seq 1 120); do
  if curl -fsS "$BASE_URL/api/healthcheck" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

printf '\n== health ==\n'
curl -sS "$BASE_URL/api/healthcheck"
printf '\n'

printf '\n== games (first 5 ids) ==\n'
GAMES_JSON=$(curl -sS "$BASE_URL/api/games")
echo "$GAMES_JSON" | jq '.[0:5] | map(.game_id // .id)'
FIRST_GAME_ID=$(echo "$GAMES_JSON" | jq -r '.[0].game_id // .[0].id')
if [[ -z "$FIRST_GAME_ID" || "$FIRST_GAME_ID" == "null" ]]; then
  echo "Could not derive first game id from /api/games" >&2
  exit 1
fi

echo "first_game_id=$FIRST_GAME_ID"

printf '\n== open scorecard ==\n'
CARD_ID=$(curl -sS -X POST "$BASE_URL/api/scorecard/open" \
  -H 'content-type: application/json' \
  -d '{"tags":["dagger-smoke"]}' | jq -r '.card_id')
echo "card_id=$CARD_ID"

printf '\n== reset game ==\n'
RESET_JSON=$(curl -sS -X POST "$BASE_URL/api/cmd/RESET" \
  -H 'content-type: application/json' \
  -d "{\"game_id\":\"$FIRST_GAME_ID\",\"card_id\":\"$CARD_ID\"}")
echo "$RESET_JSON" | jq '{game_id, state, guid, levels_completed, available_actions}'
GUID=$(echo "$RESET_JSON" | jq -r '.guid')
if [[ -z "$GUID" || "$GUID" == "null" ]]; then
  echo "RESET did not return guid" >&2
  exit 1
fi

printf '\n== action3 ==\n'
A3_JSON=$(curl -sS -X POST "$BASE_URL/api/cmd/ACTION3" \
  -H 'content-type: application/json' \
  -d "{\"game_id\":\"$FIRST_GAME_ID\",\"card_id\":\"$CARD_ID\",\"guid\":\"$GUID\"}")
echo "$A3_JSON" | jq '{game_id, state, guid, levels_completed, action_input}'

printf '\n== action6 (complex) ==\n'
A6_JSON=$(curl -sS -X POST "$BASE_URL/api/cmd/ACTION6" \
  -H 'content-type: application/json' \
  -d "{\"game_id\":\"$FIRST_GAME_ID\",\"card_id\":\"$CARD_ID\",\"guid\":\"$GUID\",\"x\":10,\"y\":10}")
echo "$A6_JSON" | jq '{game_id, state, guid, levels_completed, action_input}'

printf '\n== close scorecard ==\n'
curl -sS -X POST "$BASE_URL/api/scorecard/close" \
  -H 'content-type: application/json' \
  -d "{\"card_id\":\"$CARD_ID\"}" | jq '{card_id, score, environments_count: (.environments | length)}'

printf '\nDagger ARC smoke completed successfully.\n'
