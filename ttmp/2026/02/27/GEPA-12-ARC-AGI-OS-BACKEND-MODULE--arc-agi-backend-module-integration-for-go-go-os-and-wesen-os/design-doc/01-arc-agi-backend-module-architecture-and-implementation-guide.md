---
Title: ARC-AGI backend module architecture and implementation guide
Ticket: GEPA-12-ARC-AGI-OS-BACKEND-MODULE
Status: active
Topics:
    - architecture
    - backend
    - go-go-os
    - wesen-os
    - arc-agi
    - python
    - modules
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/base.py
      Note: ARC listen_and_serve runtime entrypoint
    - Path: ../../../../../../../go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/server.py
      Note: ARC route surface for proxy mapping
    - Path: ../../../../../../../go-go-os/go-go-os/pkg/backendhost/manifest_endpoint.go
      Note: Apps discovery and reflection endpoint contract
    - Path: ../../../../../../../go-go-os/go-go-os/pkg/backendhost/module.go
      Note: Primary backend module contract
    - Path: ../../../../../../../wesen-os/cmd/wesen-os-launcher/main.go
      Note: Composition-time module registration and mounting flow
    - Path: pkg/backendmodule/module.go
      Note: Prior-art module reflection and schema pattern
    - Path: ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/arc_agi_dagger_container_smoke.sh
      Note: Containerized gameplay validation script used to justify Dagger-first recommendation
    - Path: ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/probe_arc_normal_download.py
      Note: NORMAL-mode remote environment retrieval probe
    - Path: ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/run_arc_server_offline.py
      Note: Mounted container server bootstrap script to avoid inline args parsing issues
ExternalSources: []
Summary: Intern-first architecture and implementation guide for integrating ARC-AGI as a go-go-os backend module with a Go proxy and contained Python runtime options.
LastUpdated: 2026-02-28T02:10:00-05:00
WhatFor: Design and implement ARC-AGI backend module integration into go-go-os and later composition in wesen-os.
WhenToUse: Use when building, reviewing, or onboarding to ARC-AGI module integration and proxy runtime design.
---



# ARC-AGI backend module architecture and implementation guide

## Executive Summary

This document explains, end to end, how to integrate `ARC-AGI` as a backend module that is mountable through the existing `go-go-os` backend host contracts and composable in `wesen-os`.

The practical target is simple: a user opens the OS launcher UI, sees ARC games, starts a session, performs actions, and gets a playable timeline of events. The implementation target is less simple: ARC is Python-first, while `go-go-os` modules are Go interfaces with lifecycle guarantees, reflection metadata, namespaced routes, and health checks.

The core proposal is to introduce a Go-owned ARC module with a process driver and proxy client:

- The **module** implements `AppBackendModule` and optional reflection.
- The **driver** manages Python runtime lifecycle (raw process first; Dagger-contained option staged second).
- The **proxy client** translates stable Go HTTP endpoints into ARC Python endpoints.
- The **event projector** records structured gameplay events for timeline rendering.

This gives us near-term playability without blocking on a full external plugin runtime, while preserving a clean path into `wesen-os` composition.

## Implementation Status (2026-02-28)

The architecture described here has now been implemented for backend scope:

- `go-go-app-arc-agi-3/pkg/backendmodule` now contains:
  - module lifecycle contract implementation,
  - Dagger and raw runtime drivers,
  - ARC HTTP proxy client,
  - session/guid mapping,
  - structured events + timeline,
  - reflection + schema serving,
  - module tests with fake runtime/client.
- `wesen-os` now composes ARC as a backend module via:
  - `pkg/arcagi/module.go` adapter,
  - launcher flags/config for ARC runtime,
  - module registration in `cmd/wesen-os-launcher/main.go`,
  - integration tests covering `/api/os/apps` listing and ARC health/schema route smoke.

## How To Read This As A New Intern

If you are new to all repos, use this reading order:

1. Read this section and the architecture diagrams.
2. Read “Current State: go-go-os backend module host.”
3. Read “Current State: ARC-AGI runtime and API.”
4. Read “Proposed Target Architecture.”
5. Read “Phased Implementation Plan.”
6. Use “API Reference” while implementing handlers.

You do not need to understand all ARC internals to ship phase 1. You do need to respect the `go-go-os` module lifecycle and route namespacing model exactly.

## Problem Statement And Scope

### What we are solving

We need to run ARC-AGI gameplay from the OS stack, even though ARC runtime is Python and the OS backend module host is Go.

The integration must:

- Expose ARC gameplay through namespaced backend module routes.
- Keep Python runtime controlled and observable.
- Produce structured events so timeline UI can be built cleanly.
- Fit into current `go-go-os` contracts and eventually mount in `wesen-os`.

### What is explicitly in scope

- Module contract design for ARC as a `go-go-os` backend module.
- Go proxy design (process lifecycle + HTTP translation).
- Backend endpoints that frontend can call for game/session/action flows.
- Structured event model for timeline extraction.
- Reflection metadata and schema discoverability.
- Implementation plan with phased rollout.

### What is out of scope for this ticket

- Final polished frontend UX implementation.
- General external plugin runtime for arbitrary third-party modules.
- ARC model training/scoring strategy changes.
- Long-term multi-tenant production hardening.

## Current State: go-go-os Backend Module Host

### The host contract is strict and already production-shaped

`go-go-os` already has a clear backend module interface in `go-go-os/go-go-os/pkg/backendhost/module.go:17`:

```go
type AppBackendModule interface {
    Manifest() AppBackendManifest
    MountRoutes(mux *http.ServeMux) error
    Init(ctx context.Context) error
    Start(ctx context.Context) error
    Stop(ctx context.Context) error
    Health(ctx context.Context) error
}
```

Optional reflection support exists via `ReflectiveAppBackendModule` in `module.go:29`.

The host enforces real guardrails:

- App IDs are validated (`routes.go:10`) and must be unique (`registry.go:29`).
- Startup is lifecycle-managed with required-module health enforcement (`lifecycle.go:23`, `lifecycle.go:57`).
- Namespacing is standardized: `/api/apps/<app-id>/...` (`routes.go:34`).
- Discovery endpoints are standardized under `/api/os/apps` (`manifest_endpoint.go:35`) and `/api/os/apps/{app}/reflection` (`manifest_endpoint.go:70`).

### Why this matters for ARC integration

This means ARC module integration should not invent new hosting abstractions. It should implement this interface and conform to namespacing and discovery contracts.

If we follow this, ARC becomes “just another module” from the launcher’s perspective. That gives us composability now and lowers migration risk later.

## Current State: wesen-os Composition Flow

`wesen-os` launcher wiring already demonstrates intended module composition in `cmd/wesen-os-launcher/main.go`:

- Build module registry (`main.go:208`).
- Lifecycle startup (`main.go:224`).
- Register discovery endpoint (`main.go:233`).
- Mount each module under namespaced paths (`main.go:234`).
- Serve launcher UI at `/` (`main.go:241`).

Existing examples:

- Inventory adapter in `cmd/wesen-os-launcher/inventory_backend_module.go:18`.
- GEPA adapter in `pkg/gepa/module.go:16` with reflection mapping.

These are good templates for ARC adapter shape and reflection payload style.

## Current State: ARC-AGI Runtime And API

### ARC runtime entrypoints and route surface

ARC exposes a Flask app route map in `ARC-AGI/arc_agi/server.py:11`, including:

- `GET /api/games`
- `GET /api/games/<game_id>`
- `POST /api/scorecard/open`
- `POST /api/scorecard/close`
- `GET /api/scorecard/<card_id>`
- `POST /api/cmd/RESET`
- `POST /api/cmd/ACTION1..ACTION7`
- `GET /api/healthcheck`

Server startup path is `Arcade.listen_and_serve(...)` in `arc_agi/base.py:1003`.

### ARC action and session model

Gameplay flow is scorecard/session-centric:

1. Open scorecard (`/api/scorecard/open`).
2. Reset env (`/api/cmd/RESET`) with `game_id` and `card_id`.
3. Send actions (`/api/cmd/ACTION*`) with `game_id`, `guid`, and optional complex action fields.
4. Read frame/state payload after each action.
5. Close scorecard (`/api/scorecard/close`).

The API caches env wrappers by guid and scorecard context (`arc_agi/api.py:280`, `arc_agi/api.py:318`).

### Runtime modes and constraints

ARC has `OperationMode` (`NORMAL`, `ONLINE`, `OFFLINE`) in `arc_agi/base.py:38`.

Observed constraints:

- Python runtime is required (`pyproject.toml` requires Python 3.12+).
- Offline play requires local environment files metadata and game classes.
- Current server path uses Flask dev server semantics in `listen_and_serve`.

For OS integration, phase 1 should target reliable local/offline behavior first so playability is deterministic.

## Gap Analysis

### Gaps between ARC as-is and go-go-os module expectations

1. ARC has no native Go module implementation.
2. ARC route model (`/api/cmd/ACTIONX`) is backend-specific and not ideal for frontend consumption.
3. ARC process lifecycle is Python-owned; OS module lifecycle is Go-owned.
4. ARC response stream is frame-based but no standardized timeline event projection in OS terms.
5. Reflection metadata for discoverability in OS registry does not exist yet for ARC.

### Integration risks if done naively

- Process orphaning on launcher shutdown.
- Inconsistent health semantics between proxy and underlying Python runtime.
- Tight coupling to ARC route names in frontend (hard to evolve later).
- No stable schema contract for timeline/event UI.
- Security exposure if raw Python paths/configs are not constrained.

## Proposed Target Architecture

### Architecture overview

```text
+---------------------+           +--------------------------------+
|  Frontend (launcher)|  HTTP     |   go-go-os module host         |
|  apps-browser/arc   +----------->   /api/apps/arc-agi/*          |
+---------------------+           |                                |
                                  |  ARC Module (Go)              |
                                  |  - Manifest/Reflection         |
                                  |  - Route handlers              |
                                  |  - Event projector             |
                                  |  - ArcRuntimeDriver            |
                                  +----------------+---------------+
                                                   |
                                          local HTTP (loopback)
                                                   |
                                  +----------------v---------------+
                                  |   ARC Python runtime           |
                                  |   Flask app /api/*             |
                                  |   scorecard/env wrappers       |
                                  +--------------------------------+
```

### Design principles

- Keep module boundaries aligned with existing `go-go-os` contracts.
- Avoid leaking ARC internal route conventions to frontend.
- Keep runtime control in Go so lifecycle/health integrates naturally.
- Emit structured events per action so timeline is trivial to build.
- Make containerized runtime the default path, with raw process fallback for local unblock scenarios.

## Module API Design

### App identity and capabilities

Proposed module identity:

- `app_id`: `arc-agi`
- `name`: `ARC-AGI`
- `required`: `false` initially
- `capabilities`:
  - `games`
  - `sessions`
  - `actions`
  - `timeline`
  - `reflection`

### Backend module struct (Go sketch)

```go
type Module struct {
    cfg       ModuleConfig
    driver    ArcRuntimeDriver
    client    ArcAPIClient
    projector EventProjector
}

type ModuleConfig struct {
    EnableReflection bool
    RuntimeMode      string // offline, normal, online
    PythonMode       string // raw, dagger
    PythonBin        string
    ArcRepoRoot      string
    ListenAddr       string // loopback target for python service
    StartupTimeout   time.Duration
    RequestTimeout   time.Duration
    MaxSessions      int
}
```

### Proxy driver interface

```go
type ArcRuntimeDriver interface {
    Init(ctx context.Context) error
    Start(ctx context.Context) error
    Stop(ctx context.Context) error
    Health(ctx context.Context) error
    BaseURL() string
}
```

Implementations:

- `DaggerDriver` (phase 1 default): run runtime in a contained service image/tunnel.
- `RawProcessDriver` (phase 3 fallback): spawn python process directly when Dagger is unavailable.

### Proxy client interface

```go
type ArcAPIClient interface {
    ListGames(ctx context.Context) ([]GameSummary, error)
    GetGame(ctx context.Context, gameID string) (GameDetails, error)
    OpenSession(ctx context.Context, req OpenSessionRequest) (Session, error)
    CloseSession(ctx context.Context, sessionID string) (SessionSummary, error)
    ResetGame(ctx context.Context, req ResetRequest) (FrameEnvelope, error)
    Act(ctx context.Context, req ActionRequest) (FrameEnvelope, error)
    GetSessionScorecard(ctx context.Context, sessionID string) (ScorecardEnvelope, error)
}
```

## Public Endpoint Contract (Go module surface)

We keep frontend-facing API stable and semantic, then map internally to ARC endpoints.

### Endpoint list

- `GET /api/apps/arc-agi/health`
- `GET /api/apps/arc-agi/games`
- `GET /api/apps/arc-agi/games/{game_id}`
- `POST /api/apps/arc-agi/sessions`
- `GET /api/apps/arc-agi/sessions/{session_id}`
- `DELETE /api/apps/arc-agi/sessions/{session_id}`
- `POST /api/apps/arc-agi/sessions/{session_id}/games/{game_id}/reset`
- `POST /api/apps/arc-agi/sessions/{session_id}/games/{game_id}/actions`
- `GET /api/apps/arc-agi/sessions/{session_id}/events?after_seq=N`
- `GET /api/apps/arc-agi/sessions/{session_id}/timeline`
- `GET /api/apps/arc-agi/schemas/{schema_id}`

### Key request/response examples

Create session:

```json
POST /api/apps/arc-agi/sessions
{
  "source_url": "wesen-os://arc-window",
  "tags": ["launcher", "arc"],
  "opaque": {"window_id": "w-arc-1"}
}
```

Action request:

```json
POST /api/apps/arc-agi/sessions/s-123/games/bt11/actions
{
  "action": "ACTION6",
  "data": {"x": 12, "y": 41},
  "reasoning": {"note": "testing corner fill"}
}
```

Action response (normalized):

```json
{
  "session_id": "s-123",
  "game_id": "bt11",
  "guid": "a64f...",
  "state": "RUNNING",
  "levels_completed": 0,
  "win_levels": [2],
  "available_actions": ["ACTION1", "ACTION3", "ACTION6"],
  "frame": [[0,1,0],[0,2,0]],
  "action": {"id": "ACTION6", "data": {"x": 12, "y": 41}}
}
```

## Structured Event And Timeline Model

### Why we need this now

The user goal is “ultimately want to play games,” but timeline is already a known UX requirement in OS architecture. If we do not emit structured events from day one, timeline work becomes retroactive parsing.

### Event schema (proposed)

```json
{
  "event_id": "evt-000001",
  "seq": 17,
  "ts": "2026-02-28T02:12:33Z",
  "app_id": "arc-agi",
  "session_id": "s-123",
  "game_id": "bt11",
  "type": "arc.action.completed",
  "payload": {
    "action": "ACTION6",
    "state": "RUNNING",
    "levels_completed": 0,
    "guid": "a64f..."
  }
}
```

Event categories:

- `arc.session.opened`
- `arc.game.reset`
- `arc.action.requested`
- `arc.action.completed`
- `arc.action.failed`
- `arc.session.closed`
- `arc.runtime.unhealthy`

### Timeline projection output

```json
{
  "session_id": "s-123",
  "status": "active",
  "counts": {
    "arc.game.reset": 1,
    "arc.action.completed": 14,
    "arc.action.failed": 1
  },
  "latest_state": "RUNNING",
  "items": [
    {"seq": 1, "type": "arc.session.opened", "summary": "Session opened"},
    {"seq": 2, "type": "arc.game.reset", "summary": "bt11 reset"}
  ]
}
```

## Runtime Containment Strategies

## Option A: Dagger-contained runtime (recommended default)

### Why this is now the default

This recommendation changed after running containerized ARC spikes in this workspace on February 28, 2026. We validated both gameplay actions and environment retrieval in Dagger-managed containers, so the architecture can safely target contained execution first.

### Process model

- Go module starts a Dagger-backed service during `Start()`.
- Dagger exposes a localhost tunnel endpoint for proxy calls.
- Go module proxies all public requests to that tunnel URL.
- Go module stops the Dagger session/service during `Stop()`.

### Dagger mode pros

- Strong runtime reproducibility.
- Clear dependency control (`python`, `uv`, project deps in container).
- Easier cross-machine consistency.
- Verified working in this repository with gameplay calls.

### Dagger mode cons

- Additional engine/runtime dependency.
- Slightly higher startup complexity than raw process.
- Needs Docker/OCI runtime available on host.

### Dagger mode pseudocode

```text
Module.Start(ctx):
  driver.Start(ctx)  # starts dagger service + tunnel
  wait until driver.Health(ctx) == nil (timeout)
  client = new ArcAPIClient(driver.BaseURL())

Handle POST /actions:
  validate payload
  emit arc.action.requested
  frame = client.Act(...)
  emit arc.action.completed
  return frame
```

## Option B: Raw Python Process (fallback mode)

### Process model

- Go module starts Python runtime during `Start()`.
- Python listens on loopback port (not public interface).
- Go module proxies all public requests.
- Go module kills process on `Stop()` and on startup rollback.

### Raw mode pros

- Fastest path to usable gameplay.
- Minimal new infrastructure.
- Easy local debugging.
- Useful emergency fallback when container runtime is unavailable.

### Raw mode cons

- Host Python environment drift.
- Less containment/security isolation.
- Harder reproducibility across machines.

### Official Dagger capabilities relevant here

From official docs:

- Dagger is designed for programmable CI/CD pipelines and containerized steps.
- Dagger SDKs provide a unified API for container operations.
- Service-style execution and binding patterns are supported by the container model.

References:

- https://docs.dagger.io/
- https://docs.dagger.io/api/container/

### Empirical validation results (2026-02-28)

- Containerized gameplay smoke succeeded via Dagger:
  - `GET /api/healthcheck` returned `okay`.
  - `GET /api/games` returned playable local game IDs.
  - `POST /api/scorecard/open` succeeded.
  - `POST /api/cmd/RESET`, `POST /api/cmd/ACTION3`, and `POST /api/cmd/ACTION6` succeeded.
  - `POST /api/scorecard/close` returned scorecard payload.
- NORMAL mode probe succeeded in container and fetched remote environments through anonymous API key with 3 environment IDs returned.

These results are captured by ticket scripts in `scripts/arc_agi_dagger_container_smoke.sh` and `scripts/probe_arc_normal_download.py`.

## Proxy Mapping Details

### ARC-to-module route mapping

```text
Module endpoint                                   ARC endpoint
------------------------------------------------ ----------------------------------
GET /games                                        GET /api/games
GET /games/{id}                                   GET /api/games/{id}
POST /sessions                                    POST /api/scorecard/open
GET /sessions/{sid}                               GET /api/scorecard/{sid}
DELETE /sessions/{sid}                            POST /api/scorecard/close
POST /sessions/{sid}/games/{gid}/reset            POST /api/cmd/RESET
POST /sessions/{sid}/games/{gid}/actions          POST /api/cmd/ACTION{N}
GET /health                                       GET /api/healthcheck
```

### Action mapping logic

- `action` enum value maps directly to ARC action path segment.
- `RESET` is special and does not require pre-existing guid.
- Non-reset actions require guid from previous reset/action response.

Module maintains `(session_id, game_id) -> guid` mapping cache.

## Reflection API Design

### Manifest reflection hints

Expose reflection under `/api/os/apps/arc-agi/reflection` so launcher UI and apps-browser can inspect:

- capabilities
- docs links
- endpoint signatures
- schema references

### Reflection document sketch

```json
{
  "app_id": "arc-agi",
  "name": "ARC-AGI",
  "version": "v1",
  "summary": "Proxy-backed ARC gameplay module",
  "capabilities": [
    {"id": "games", "stability": "beta", "description": "List and inspect ARC games"},
    {"id": "timeline", "stability": "beta", "description": "Session event timeline projection"}
  ],
  "apis": [
    {"id": "list-games", "method": "GET", "path": "/api/apps/arc-agi/games", "response_schema": "arc.games.list.response.v1"}
  ],
  "schemas": [
    {"id": "arc.games.list.response.v1", "format": "json-schema", "uri": "/api/apps/arc-agi/schemas/arc.games.list.response.v1"}
  ]
}
```

## Internal Package Layout Proposal

Target location (in `go-go-app-arc-agi-3` repo as reusable package):

```text
go-go-app-arc-agi/go-go-app-arc-agi/
  pkg/backendmodule/
    module.go
    manifest.go
    routes.go
    reflection.go
    schemas.go
    events.go
    timeline.go
    client.go
    driver_raw.go
    driver_dagger.go
    errors.go
    module_test.go
```

Composition integration:

```text
wesen-os/
  pkg/arcagi/module.go      # thin adapter if needed
  cmd/wesen-os-launcher/main.go  # register module in registry
```

## Lifecycle And Failure Semantics

### Startup sequence

```text
Launcher startup
  -> registry create
  -> arc module Init()
  -> arc module Start() [start dagger-backed runtime service]
  -> arc module Health() [probe python /healthcheck]
  -> mount routes
```

### Shutdown sequence

- `Stop()` cancels inflight requests.
- driver gracefully terminates python process/container.
- timeout fallback kills process hard if needed.

### Failure policy

- `required=false` initially so launcher can still start if ARC fails.
- `/api/os/apps` health fields report failure message via module `Health()`.
- action/session endpoints return consistent JSON error envelope.

## Security And Operational Guardrails

- Bind Python server to `127.0.0.1` only.
- Do not expose raw python port externally.
- Sanitize and bound all user-provided values (`game_id`, action payload).
- Enforce request timeout and max body size in proxy handlers.
- Constrain environments directory path from config.
- Add kill-on-parent-exit behavior to prevent orphan process.

## Pseudocode: Core Execution Paths

### Module startup

```go
func (m *Module) Start(ctx context.Context) error {
    if err := m.driver.Start(ctx); err != nil { return err }
    healthCtx, cancel := context.WithTimeout(ctx, m.cfg.StartupTimeout)
    defer cancel()
    if err := waitUntilHealthy(healthCtx, m.driver); err != nil {
        _ = m.driver.Stop(context.Background())
        return fmt.Errorf("arc runtime failed startup health: %w", err)
    }
    m.client = NewHTTPClient(m.driver.BaseURL(), m.cfg.RequestTimeout)
    return nil
}
```

### Action handling

```go
func (m *Module) handleAction(w http.ResponseWriter, r *http.Request) {
    req := decodeActionRequest(r)
    guid := m.sessions.LookupGUID(req.SessionID, req.GameID)

    m.projector.Append(Event{Type: "arc.action.requested", ...})

    frame, err := m.client.Act(r.Context(), ArcActRequest{
        SessionID: req.SessionID,
        GameID: req.GameID,
        GUID: guid,
        Action: req.Action,
        Data: req.Data,
        Reasoning: req.Reasoning,
    })
    if err != nil {
        m.projector.Append(Event{Type: "arc.action.failed", ...})
        writeJSONError(w, mapArcError(err))
        return
    }

    m.sessions.UpsertGUID(req.SessionID, req.GameID, frame.GUID)
    m.projector.Append(Event{Type: "arc.action.completed", Payload: summarize(frame)})
    writeJSON(w, http.StatusOK, normalizeFrame(frame))
}
```

## API Reference (Intern Quick Lookup)

### Module lifecycle methods

- `Init(ctx)`: validate config only.
- `Start(ctx)`: start Python runtime and wait for health.
- `Health(ctx)`: check driver health + optional ping to `/api/healthcheck`.
- `Stop(ctx)`: stop runtime and cleanup caches.
- `MountRoutes(mux)`: register only module-relative paths.

### Session model

- `session_id`: scorecard id in ARC terms.
- `guid`: current env instance identifier from ARC frame payload.
- `game_id`: ARC game id.

### Error envelope

```json
{
  "error": {
    "code": "ARC_UPSTREAM_BAD_REQUEST",
    "message": "guid is required for non-reset actions",
    "details": {
      "upstream_status": 400,
      "upstream_endpoint": "/api/cmd/ACTION3"
    }
  }
}
```

## Testing Strategy

### Unit tests

- Route validation and payload decoding.
- Action-to-endpoint mapping.
- GUID cache behavior.
- Event projector ordering and timeline counts.
- Driver startup/stop state transitions (with fakes).

### Integration tests

- Launch module with fake ARC server fixture.
- Verify `/api/os/apps` lists module and health status.
- Verify reflection endpoint payload shape.
- Verify game/session/action happy path.
- Verify failure path when upstream returns 4xx/5xx.

### E2E tests (in wesen-os)

- Module registration in launcher registry.
- Apps browser can discover `arc-agi`.
- Action stream updates timeline endpoint.

## Phased Implementation Plan

## Phase 0: Ticket setup and contract lock

- Create module package skeleton.
- Define schemas and reflection doc skeleton.
- Add task checklist and architecture docs.

## Phase 1: Dagger driver + core gameplay endpoints

- Implement `DaggerDriver`.
- Implement `ArcAPIClient` with robust timeout/error mapping.
- Implement `games`, `sessions`, `reset`, `actions`, `health` handlers.
- Implement event projector + timeline endpoint.
- Add module tests with fake upstream.

Exit criteria:

- User can play at least one offline game through module endpoints.
- `/api/os/apps` shows healthy ARC module.

## Phase 2: Reflection completeness + schema endpoints

- Publish schema docs under `/schemas/{id}`.
- Finalize reflection payload and docs links.
- Integrate with apps-browser inspection UI.

Exit criteria:

- Designer/dev can discover ARC APIs and schemas from reflection only.

## Phase 3: Raw-process fallback driver

- Implement `RawProcessDriver` behind config flag.
- Add smoke tests for startup/health/stop in raw mode.
- Keep Dagger mode as default during rollout.

Exit criteria:

- Same endpoint contract works with both raw and Dagger drivers.

## Phase 4: wesen-os composition integration

- Register ARC module in `wesen-os` launcher registry.
- Add launcher route exposure and smoke checks.
- Add docs for run commands and troubleshooting.

Exit criteria:

- ARC module visible and callable from composed launcher runtime.

## Suggested Initial Task Breakdown

1. Create backend module package and core interfaces.
2. Implement JSON schemas and reflection payload.
3. Implement Dagger driver startup/stop/health.
4. Implement proxy client with typed DTOs.
5. Implement handlers for games/sessions/reset/action.
6. Implement event projector and timeline endpoint.
7. Add unit and integration test coverage.
8. Wire into `wesen-os` launcher registry.
9. Add raw fallback driver behind feature flag.
10. Add e2e smoke scripts and docs.

## Diagrams

### Sequence: first playable interaction

```text
Frontend          ARC Module (Go)            ARC Python
   |                     |                       |
   | POST /sessions      |                       |
   |-------------------->| POST /scorecard/open  |
   |                     |---------------------->|
   |                     |<----------------------|
   |<--------------------| session_id            |
   |                     |                       |
   | POST /reset         | POST /cmd/RESET       |
   |-------------------->|---------------------->|
   |                     |<----------------------|
   |<--------------------| frame + guid          |
   |                     |                       |
   | POST /actions       | POST /cmd/ACTION6     |
   |-------------------->|---------------------->|
   |                     |<----------------------|
   |<--------------------| frame + state         |
```

### Component boundaries

```text
[go-go-os/pkg/backendhost]
   owns: module lifecycle + namespaced mounting + discovery

[arc module package]
   owns: endpoint contract + runtime driver + proxy + event timeline

[ARC-AGI Python repo]
   owns: actual gameplay runtime + scorecard internals + frame production

[wesen-os]
   owns: composition wiring + launcher UI hosting + final assembled runtime
```

## Operational Runbook (Phase 1)

### Local prerequisites

- Docker engine available locally
- Dagger CLI available locally
- Go toolchain for module host

### Local smoke flow

1. Start launcher with ARC module enabled.
2. Check `/api/os/apps` includes `arc-agi`.
3. Call `/api/apps/arc-agi/games`.
4. Open session.
5. Reset game.
6. Send one action.
7. Fetch timeline.

If step 2 fails, inspect module health error in discovery payload.

## Risks And Mitigations

- Risk: Python process hangs during shutdown.
- Mitigation: bounded graceful stop then hard kill fallback.

- Risk: Dagger engine unavailable or Docker daemon down.
- Mitigation: explicit startup diagnostics and raw fallback driver.

- Risk: ARC upstream payload shape drifts.
- Mitigation: strict decoder tests and compatibility adapter layer.

- Risk: Action endpoint misuse (`ACTION*` values).
- Mitigation: validate action enum before proxying.

- Risk: Timeline growth in memory.
- Mitigation: capped per-session event ring buffer with retention policy.

## Alternatives Considered

### Direct frontend calls to ARC Python

Rejected for now because it bypasses OS module contracts, reflection, and discovery, and leaks implementation-specific routes into UI.

### Embedding Python interpreter in Go process

Rejected for initial delivery due complexity and weak operational ergonomics versus process isolation.

### Raw-only from day one

Rejected as default because containerized runtime is now empirically validated and provides better reproducibility and isolation.

## What This Unlocks Next

After this design is implemented, we can add:

- ARC app tile in apps-browser with reflection-based endpoint viewer.
- Gameplay timeline window powered by structured events.
- Progressive move from in-process module composition to cleaner external module boundaries without breaking frontend contract.

## References

### Core host contracts

- `go-go-os/go-go-os/pkg/backendhost/module.go:17`
- `go-go-os/go-go-os/pkg/backendhost/registry.go:14`
- `go-go-os/go-go-os/pkg/backendhost/lifecycle.go:23`
- `go-go-os/go-go-os/pkg/backendhost/routes.go:29`
- `go-go-os/go-go-os/pkg/backendhost/manifest_endpoint.go:35`

### Composition wiring

- `wesen-os/cmd/wesen-os-launcher/main.go:208`
- `wesen-os/cmd/wesen-os-launcher/inventory_backend_module.go:18`
- `wesen-os/pkg/gepa/module.go:16`

### ARC runtime and API

- `go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/server.py:11`
- `go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/base.py:1003`
- `go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/api.py:183`
- `go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/arc_agi/remote_wrapper.py:83`

### Related existing module pattern

- `go-go-gepa/pkg/backendmodule/module.go:18`

### Ticket experiment scripts

- `go-go-gepa/ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/arc_agi_dagger_container_smoke.sh`
- `go-go-gepa/ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/scripts/probe_arc_normal_download.py`

### External docs

- ARC package README: `go-go-app-arc-agi-3/2026-02-27--arc-agi/ARC-AGI/README.md`
- Dagger docs: https://docs.dagger.io/
- Dagger container API: https://docs.dagger.io/api/container/
