#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../../.." && pwd)"
WESEN_OS_DIR="${WORKSPACE_ROOT}/wesen-os"
PORT="${PORT:-18091}"
ARC_RAW_ADDR="${ARC_RAW_ADDR:-127.0.0.1:18081}"
ARC_DRIVER="${ARC_DRIVER:-raw}"
BASE_URL="http://127.0.0.1:${PORT}"
ARC_BASE="${BASE_URL}/api/apps/arc-agi"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gepa18-arc-smoke.XXXXXX")"
PROFILE_REGISTRY_FILE="${TMP_DIR}/profiles.runtime.yaml"
LOG_FILE="${TMP_DIR}/wesen-os-launcher.log"
PID=""

cleanup() {
  if [[ -n "${PID}" ]] && kill -0 "${PID}" >/dev/null 2>&1; then
    kill "${PID}" >/dev/null 2>&1 || true
    wait "${PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cat >"${PROFILE_REGISTRY_FILE}" <<'YAML'
slug: smoke
profiles:
  default:
    slug: default
    runtime:
      step_settings_patch:
        ai-chat:
          ai-engine: gpt-4.1-mini
YAML

pushd "${WESEN_OS_DIR}" >/dev/null

HOME="${TMP_DIR}/home" XDG_CONFIG_HOME="${TMP_DIR}/xdg-config" \
  go run ./cmd/wesen-os-launcher wesen-os-launcher \
  --addr "127.0.0.1:${PORT}" \
  --profile default \
  --profile-registries "${PROFILE_REGISTRY_FILE}" \
  --inventory-db "${TMP_DIR}/inventory.db" \
  --inventory-seed-on-start=true \
  --inventory-reset-on-start=true \
  --arc-enabled=true \
  --arc-driver "${ARC_DRIVER}" \
  --arc-runtime-mode offline \
  --arc-repo-root "../go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI" \
  --arc-startup-timeout-seconds 60 \
  --arc-request-timeout-seconds 45 \
  --arc-raw-listen-addr "${ARC_RAW_ADDR}" \
  >"${LOG_FILE}" 2>&1 &
PID="$!"

# Wait for ARC health
READY=0
for _ in $(seq 1 400); do
  if curl -fsS "${ARC_BASE}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "${PID}" >/dev/null 2>&1; then
    echo "ERROR: launcher exited early" >&2
    tail -n 120 "${LOG_FILE}" >&2 || true
    exit 1
  fi
  sleep 0.25
done

if [[ "${READY}" != "1" ]]; then
  echo "ERROR: ARC module did not become healthy" >&2
  tail -n 120 "${LOG_FILE}" >&2 || true
  exit 1
fi

GAMES_JSON="$(curl -fsS "${ARC_BASE}/games")"
GAME_ID="$(printf '%s' "${GAMES_JSON}" | jq -r '.games[0].game_id // empty')"
if [[ -z "${GAME_ID}" ]]; then
  echo "ERROR: no game ids returned" >&2
  printf '%s\n' "${GAMES_JSON}" >&2
  exit 1
fi

SESSION_JSON="$(curl -fsS -X POST "${ARC_BASE}/sessions" -H 'content-type: application/json' -d '{}')"
SESSION_ID="$(printf '%s' "${SESSION_JSON}" | jq -r '.session_id // empty')"
if [[ -z "${SESSION_ID}" ]]; then
  echo "ERROR: missing session_id" >&2
  printf '%s\n' "${SESSION_JSON}" >&2
  exit 1
fi

RESET_JSON="$(curl -fsS -X POST "${ARC_BASE}/sessions/${SESSION_ID}/games/${GAME_ID}/reset" -H 'content-type: application/json' -d '{}')"
GUID="$(printf '%s' "${RESET_JSON}" | jq -r '.guid // empty')"
if [[ -z "${GUID}" ]]; then
  echo "ERROR: reset did not return guid" >&2
  printf '%s\n' "${RESET_JSON}" >&2
  exit 1
fi

ACTION_JSON="$(curl -fsS -X POST "${ARC_BASE}/sessions/${SESSION_ID}/games/${GAME_ID}/actions" \
  -H 'content-type: application/json' \
  -d "{\"action\":\"ACTION1\",\"data\":{\"guid\":\"${GUID}\"}}")"

EVENTS_JSON="$(curl -fsS "${ARC_BASE}/sessions/${SESSION_ID}/events")"
TIMELINE_JSON="$(curl -fsS "${ARC_BASE}/sessions/${SESSION_ID}/timeline")"

EVENT_COUNT="$(printf '%s' "${EVENTS_JSON}" | jq -r '.events | length')"
TIMELINE_EVENT_COUNT="$(printf '%s' "${TIMELINE_JSON}" | jq -r '.events | length')"

printf 'ARC smoke PASS\n'
printf 'game_id=%s\n' "${GAME_ID}"
printf 'session_id=%s\n' "${SESSION_ID}"
printf 'guid=%s\n' "${GUID}"
printf 'events=%s timeline_events=%s\n' "${EVENT_COUNT}" "${TIMELINE_EVENT_COUNT}"
printf 'action_state=%s\n' "$(printf '%s' "${ACTION_JSON}" | jq -r '.state // empty')"

curl -fsS -X DELETE "${ARC_BASE}/sessions/${SESSION_ID}" >/dev/null

popd >/dev/null
