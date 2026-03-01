# ARC-AGI App Module: Intern Spec and User Guide

## Who this is for

This guide is for a new intern who needs to:

- understand how the ARC-AGI backend module works;
- run it inside the OS launcher stack;
- call its REST routes correctly;
- debug common failures quickly.

The module is implemented in:

- `go-go-app-arc-agi-3/pkg/backendmodule`

It is composed into `wesen-os` via:

- `wesen-os/pkg/arcagi/module.go`
- `wesen-os/cmd/wesen-os-launcher/main.go`

## What this module does

The ARC module exposes a stable Go REST surface for ARC gameplay.

Internally it does three jobs:

1. Starts/stops ARC Python runtime (`dagger` or `raw` process mode).
2. Proxies requests to ARC upstream routes (`/api/games`, `/api/scorecard/*`, `/api/cmd/*`).
3. Maintains session-level state (guid mapping + event timeline projection).

It is mounted under the app namespace:

- `/api/apps/arc-agi/*`

## Key concepts

### `session_id`

- In this module, `session_id` is the ARC `card_id` from scorecard APIs.
- Created by `POST /sessions`.
- Closed by `DELETE /sessions/{session_id}`.

### `guid`

- ARC action endpoints require a `guid` after reset.
- The module learns and stores `guid` during reset/action responses.
- You must call reset before first action for a `(session, game)` pair.

### event timeline

- The module appends structured events (open, reset, action requested/completed/failed, close).
- Events are exposed via `/sessions/{id}/events`.
- Aggregated timeline is exposed via `/sessions/{id}/timeline`.

## Lifecycle contract

The module implements the backend host lifecycle:

1. `Init(ctx)`
2. `Start(ctx)`:
   - starts runtime driver;
   - waits for healthcheck up to `StartupTimeout`.
3. `Health(ctx)`:
   - probes upstream `/api/healthcheck`.
4. `Stop(ctx)`:
   - stops process/session and cleans temporary runtime artifacts.

## Configuration spec (`ModuleConfig`)

Defined in `pkg/backendmodule/contracts.go`.

### Core fields

- `EnableReflection bool`
- `Driver string`: `dagger` (default) or `raw`
- `RuntimeMode string`: `offline` (default), `normal`, `online`
- `ArcRepoRoot string`: path to ARC Python project
- `StartupTimeout time.Duration`: default `45s`
- `RequestTimeout time.Duration`: default `30s`
- `APIKey string`: default `"1234"` for `X-API-Key`
- `MaxSessionEvents int`: default `200`

### Dagger fields

- `DaggerBinary string`: default `dagger`
- `DaggerImage string`: default `python:3.12-slim`
- `DaggerContainerPort int`: default `18081`
- `DaggerProgress string`: default `plain`

### Raw mode fields

- `RawListenAddr string`: default `127.0.0.1:18081`
- `PythonCommand []string`: default `["uv","run","python"]`

## REST API spec

Base path:

- `/api/apps/arc-agi`

All responses are JSON unless noted.
Error envelope shape:

```json
{
  "error": {
    "message": "..."
  }
}
```

### Health

- `GET /health`
- Success: `200`

```json
{"status":"ok"}
```

- Failure: `503` if runtime is unhealthy/unreachable.

### Games

- `GET /games`
  - returns proxied game list as:

```json
{
  "games": [ ... ]
}
```

- `GET /games/{game_id}`
  - returns one game metadata object (proxied from ARC).

### Sessions

- `POST /sessions`
  - body is optional JSON object.
  - forwards payload to ARC scorecard open endpoint.
  - returns `201`:

```json
{"session_id":"<card_id>"}
```

- `GET /sessions/{session_id}`
  - returns ARC scorecard payload with module-enriched fields:
  - adds:
    - `session_id`
    - `status` (`active` or `closed`)

- `DELETE /sessions/{session_id}`
  - closes ARC scorecard
  - marks session closed in module state
  - appends `arc.session.closed` event
  - returns ARC close payload plus `session_id`.

### Reset a game in a session

- `POST /sessions/{session_id}/games/{game_id}/reset`
- body currently ignored (use `{}`).
- proxies to ARC `RESET` command.
- stores returned `guid` for this `(session_id, game_id)`.
- returns ARC frame plus:
  - `session_id`
  - `game_id`

### Apply action

- `POST /sessions/{session_id}/games/{game_id}/actions`
- request body:

```json
{
  "action": "ACTION3",
  "data": {},
  "reasoning": {"note":"optional"}
}
```

Rules:

- `action` must resolve to `ACTION1..ACTION7`.
- `RESET` is not allowed here (use reset route).
- If no guid is stored for `(session, game)`, returns `400`:
  - `"missing game guid for session/game; call reset first"`

On success:

- proxies action to ARC;
- updates guid if ARC returns a new one;
- appends requested/completed events;
- returns ARC frame plus:
  - `session_id`
  - `game_id`
  - `action`

### Events and timeline

- `GET /sessions/{session_id}/events?after_seq=N`
  - `after_seq` default: `0`
  - must be non-negative integer
  - returns:

```json
{
  "session_id":"s-1",
  "events":[
    {"seq":1,"type":"arc.session.opened","summary":"Session opened", ...}
  ]
}
```

- `GET /sessions/{session_id}/timeline`
  - returns aggregate projection:
    - `session_id`
    - `status` (`active`/`closed`)
    - `counts` per event type
    - `items` summarized timeline entries

### Schemas

- `GET /schemas/{schema_id}`
- serves JSON schema documents embedded by module.
- sample IDs:
  - `arc.health.response.v1`
  - `arc.games.list.response.v1`
  - `arc.sessions.open.request.v1`
  - `arc.sessions.timeline.response.v1`
  - `arc.error.v1`

## Reflection and discoverability

If reflection is enabled:

- module reports reflection capability via host manifest endpoint:
  - `/api/os/apps`
- full reflection document:
  - `/api/os/apps/arc-agi/reflection`

Use reflection to discover:

- endpoints
- schema IDs
- docs references
- capability metadata

## Quick start in `wesen-os` (recommended)

Use launcher flags to enable ARC module:

```bash
go run ./cmd/wesen-os-launcher wesen-os-launcher \
  --addr 127.0.0.1:18091 \
  --arc-enabled=true \
  --arc-driver=dagger \
  --arc-runtime-mode=offline \
  --arc-repo-root ../go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI \
  --required-apps=inventory
```

Then verify app registry:

```bash
curl -sS http://127.0.0.1:18091/api/os/apps | jq .
```

### Important launcher note

Current launcher profile system requires explicit profile registry config in some environments.
If startup fails with:

- `validation error (profile-settings.profile-registries): must be configured`

start launcher with profile registry flags (see `wesen-os/scripts/smoke-wesen-os-launcher.sh` for a working pattern), for example:

```bash
--profile default --profile-registries /path/to/profiles.runtime.yaml
```

## End-to-end API flow example

Assume:

- `BASE=http://127.0.0.1:18091/api/apps/arc-agi`

1. List games:

```bash
GAMES_JSON=$(curl -sS "$BASE/games")
GAME_ID=$(echo "$GAMES_JSON" | jq -r '.games[0].game_id // .games[0].id')
```

2. Open session:

```bash
OPEN_JSON=$(curl -sS -X POST "$BASE/sessions" \
  -H 'content-type: application/json' \
  -d '{"tags":["intern-demo"],"source_url":"manual"}')
SESSION_ID=$(echo "$OPEN_JSON" | jq -r '.session_id')
```

3. Reset:

```bash
curl -sS -X POST "$BASE/sessions/$SESSION_ID/games/$GAME_ID/reset" \
  -H 'content-type: application/json' \
  -d '{}' | jq .
```

4. Action:

```bash
curl -sS -X POST "$BASE/sessions/$SESSION_ID/games/$GAME_ID/actions" \
  -H 'content-type: application/json' \
  -d '{"action":"ACTION3","data":{}}' | jq .
```

5. Read events/timeline:

```bash
curl -sS "$BASE/sessions/$SESSION_ID/events?after_seq=0" | jq .
curl -sS "$BASE/sessions/$SESSION_ID/timeline" | jq .
```

6. Close:

```bash
curl -sS -X DELETE "$BASE/sessions/$SESSION_ID" | jq .
```

## Error handling behavior summary

- Method mismatch: `405`
- Invalid body JSON: `400`
- Invalid action name: `400`
- Action without prior reset guid: `400`
- Invalid `after_seq`: `400`
- Upstream ARC error: upstream status code is propagated when available
- Driver/unexpected proxy failures: `502` envelope

## Intern implementation checklist

When changing this module:

1. Keep route namespace stable under `/api/apps/arc-agi`.
2. Do not break reset-before-action guid contract.
3. Update schemas and reflection together.
4. Add/adjust tests in `pkg/backendmodule/module_test.go`.
5. Re-run:
   - `go test ./...` in `go-go-app-arc-agi-3`
   - `go test ./cmd/wesen-os-launcher ./pkg/arcagi` in `wesen-os` when composition changes.

