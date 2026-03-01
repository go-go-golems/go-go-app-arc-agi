#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5173/api/apps/arc-agi}"
GAME_ID="${GAME_ID:-}"

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 1
fi

json_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$url" -H 'content-type: application/json' -d "$body"
  else
    curl -sS -X "$method" "$url"
  fi
}

request_with_status() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$url" -H 'content-type: application/json' -d "$body" -w $'\n%{http_code}\n'
  else
    curl -sS -X "$method" "$url" -w $'\n%{http_code}\n'
  fi
}

SESSION_JSON="$(json_request POST "${BASE_URL}/sessions" '{"source_url":"repro-script"}')"
SESSION_ID="$(echo "$SESSION_JSON" | jq -r '.session_id')"

if [[ -z "$SESSION_ID" || "$SESSION_ID" == "null" ]]; then
  echo "error: failed to create session" >&2
  echo "$SESSION_JSON" | jq
  exit 1
fi

if [[ -z "$GAME_ID" ]]; then
  GAMES_JSON="$(json_request GET "${BASE_URL}/games")"
  GAME_ID="$(echo "$GAMES_JSON" | jq -r '.games[0].game_id')"
fi

if [[ -z "$GAME_ID" || "$GAME_ID" == "null" ]]; then
  echo "error: failed to resolve game id" >&2
  exit 1
fi

RESET_JSON="$(json_request POST "${BASE_URL}/sessions/${SESSION_ID}/games/${GAME_ID}/reset" '{}')"
UP_RESPONSE="$(request_with_status POST "${BASE_URL}/sessions/${SESSION_ID}/games/${GAME_ID}/actions" '{"action":"up","data":{}}')"
ACTION1_RESPONSE="$(request_with_status POST "${BASE_URL}/sessions/${SESSION_ID}/games/${GAME_ID}/actions" '{"action":"ACTION1","data":{}}')"

UP_STATUS="$(echo "$UP_RESPONSE" | tail -n 1)"
ACTION1_STATUS="$(echo "$ACTION1_RESPONSE" | tail -n 1)"

UP_BODY="$(echo "$UP_RESPONSE" | sed '$d')"
ACTION1_BODY="$(echo "$ACTION1_RESPONSE" | sed '$d')"

echo "BASE_URL=$BASE_URL"
echo "SESSION_ID=$SESSION_ID"
echo "GAME_ID=$GAME_ID"
echo

echo "--- reset available_actions ---"
echo "$RESET_JSON" | jq '.available_actions'
echo

echo "--- lowercase up action (regression check: should be ACTION1/200 on fixed builds) ---"
echo "$UP_BODY" | jq
echo "status=$UP_STATUS"
echo

echo "--- canonical ACTION1 control call ---"
echo "$ACTION1_BODY" | jq '{state, action, available_actions}'
echo "status=$ACTION1_STATUS"
