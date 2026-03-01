---
Title: ARC-AGI frontend extraction and gameplay wiring research
Ticket: GEPA-18-ARC-AGI-FRONTEND-EXTRACTION
Status: active
Topics:
    - arc-agi
    - frontend
    - go-go-os
    - wesen-os
    - architecture
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../go-go-app-arc-agi-3/pkg/backendmodule/module.go
      Note: Fix to module initialization ordering required for mounted ARC visibility
    - Path: ../../../../../../../go-go-app-arc-agi-3/pkg/backendmodule/reflection.go
      Note: |-
        Module reflection metadata and schema routes for discoverability
        Reflection/schema discovery contract
    - Path: ../../../../../../../go-go-app-arc-agi-3/pkg/backendmodule/routes.go
      Note: |-
        Backend API surface for games, sessions, actions, events, and timeline
        ARC backend gameplay/session route contract
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/package.json
      Note: Package identity and exports for ARC player app
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/src/api/arcApi.ts
      Note: |-
        Frontend route contract consumed by ARC UI
        Frontend route contract for ARC backend
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/src/components/ArcPlayerWindow.tsx
      Note: Main gameplay UI orchestration and session flow
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/src/launcher/module.tsx
      Note: |-
        ARC launcher module manifest and window adapter behavior currently hosted in go-go-os
        Current ARC launcher module and app manifest behavior
    - Path: ../../../../../../../go-go-os/tsconfig.json
      Note: |-
        Root project reference that will break if arc-agi-player is moved without cleanup
        Root TS project references including stale ARC app path
    - Path: ../../../../../../../wesen-os/apps/os-launcher/src/app/modules.tsx
      Note: |-
        Launcher module registry to mount ARC player app in composed frontend shell
        Composed launcher module list missing ARC module
    - Path: ../../../../../../../wesen-os/apps/os-launcher/tsconfig.json
      Note: |-
        Path aliases for app packages across repos
        TypeScript path aliases requiring ARC additions
    - Path: ../../../../../../../wesen-os/apps/os-launcher/vite.config.ts
      Note: |-
        Runtime alias and API proxy config for local dev
        Dev alias and proxy wiring for composed launcher
    - Path: ../../../../../../../wesen-os/apps/os-launcher/vitest.config.ts
      Note: |-
        Test-time alias config that must mirror Vite aliasing
        Test alias wiring that must mirror runtime
    - Path: ../../../../../../../wesen-os/cmd/wesen-os-launcher/main.go
      Note: |-
        Backend module composition including ARC runtime config and mounting
        Backend module composition and ARC registration
    - Path: ttmp/2026/02/27/GEPA-18-ARC-AGI-FRONTEND-EXTRACTION--move-arc-agi-app-widgets-to-go-go-app-arc-agi-3-and-wire-gameplay-in-wesen-os/scripts/arc-gameplay-smoke.sh
      Note: Validation artifact for end-to-end gameplay route flow
ExternalSources: []
Summary: Evidence-driven pre-research and implementation blueprint for moving ARC frontend/widgets out of go-go-os into go-go-app-arc-agi-3, then wiring wesen-os to run playable ARC gameplay against the mounted backend module.
LastUpdated: 2026-02-28T01:30:00-05:00
WhatFor: Prepare and execute a clean repo-boundary extraction for ARC frontend while preserving playable behavior in wesen-os.
WhenToUse: Use before and during ARC frontend extraction, launcher wiring, and gameplay verification in composed environments.
---



# ARC-AGI frontend extraction and gameplay wiring research

## Executive Summary

This document is the pre-research baseline for extracting ARC frontend code from `go-go-os` into `go-go-app-arc-agi-3`, then wiring `wesen-os` so the ARC app is mounted and playable end-to-end against the ARC backend module.

The key findings are:

1. ARC backend integration is already implemented and mounted in `wesen-os` backend (`/api/apps/arc-agi/*`), including reflection and schema endpoints.
2. ARC frontend code still lives in `go-go-os/apps/arc-agi-player`, and `wesen-os` currently does not mount it in launcher modules.
3. `wesen-os` frontend has a cross-repo alias pattern already used for Inventory, which we can copy for ARC.
4. A `mv`-first migration is feasible with low functional risk if we update alias maps (`tsconfig`, Vite, Vitest), module registration, and one stale `go-go-os/tsconfig.json` reference.

The recommended implementation sequence is:

1. Move ARC app folder using `mv` into `go-go-app-arc-agi-3/apps/arc-agi-player`.
2. Rewire `wesen-os` aliases and `launcherModules` to import and mount ARC.
3. Remove broken ARC project reference in `go-go-os/tsconfig.json`.
4. Validate runtime flow: list games, open session, reset game, execute action, fetch events/timeline.
5. Commit in small slices with diary updates and explicit validation logs.

## Problem Statement

We want a clean repository boundary:

- `go-go-os` keeps generic engine/desktop framework and generic OS functionality.
- `go-go-app-arc-agi-3` owns ARC domain implementation (backend and frontend).
- `wesen-os` composes everything into one runnable system and bundle.

Current state violates this boundary because ARC frontend/widgets are still inside `go-go-os`. This creates ownership confusion and makes future ARC app iteration harder (especially when backend and frontend are split across repos).

The concrete objective for this ticket is twofold:

1. Move ARC frontend/widgets from `go-go-os` to `go-go-app-arc-agi-3` using `mv` where possible.
2. Wire `wesen-os` so ARC appears as a mounted app and can play games through the existing ARC backend module API.

## Scope

In scope:

- Frontend source move for ARC player app.
- Launcher module registration in `wesen-os`.
- Cross-repo alias/build/test wiring adjustments.
- Gameplay route validation against backend.
- Task/diary/changelog + reMarkable delivery.

Out of scope:

- Rewriting ARC UI architecture itself.
- Changing ARC backend route contracts unless broken.
- Generic plugin runtime redesign.
- Storybook federation redesign across all repos.

## Current Architecture (Evidence-Based)

### 1) ARC frontend app currently lives in go-go-os

Evidence:

- `go-go-os/apps/arc-agi-player/package.json` defines package `@hypercard/arc-agi-player` and exports launcher entrypoint.
- `go-go-os/apps/arc-agi-player/src/launcher/module.tsx` defines launcher manifest `id: 'arc-agi-player'` and window adapter logic.
- `go-go-os/apps/arc-agi-player/src/api/arcApi.ts` targets `'/api/apps/arc-agi/*'` endpoints.

Implication:

- ARC frontend is still anchored to the wrong repo boundary for the new split model.

### 2) wesen-os backend already mounts ARC backend module

Evidence:

- `wesen-os/cmd/wesen-os-launcher/main.go` builds ARC module config and appends it when `arc-enabled` is true.
- `wesen-os/pkg/arcagi/module.go` wraps `go-go-app-arc-agi-3/pkg/backendmodule`.
- `go-go-app-arc-agi-3/pkg/backendmodule/routes.go` exposes gameplay endpoints and timeline/event routes.

Implication:

- Backend part is already in the right ownership repo and composition flow.
- Frontend can immediately target existing routes; no API gateway redesign needed for this ticket.

### 3) wesen-os frontend does not currently mount ARC launcher module

Evidence:

- `wesen-os/apps/os-launcher/src/app/modules.tsx` imports inventory/todo/crm/book-tracker/apps-browser but not ARC.
- `wesen-os/apps/os-launcher/tsconfig.json`, `vite.config.ts`, and `vitest.config.ts` include alias entries for `go-go-os` and `go-go-app-inventory`, but no ARC alias from `go-go-app-arc-agi-3`.

Implication:

- Even with backend available, ARC UI will not appear until launcher module registration and alias paths are restored.

### 4) go-go-os still references arc project in root tsconfig

Evidence:

- `go-go-os/tsconfig.json` includes `{"path": "apps/arc-agi-player"}`.

Implication:

- After moving the folder out, `go-go-os` typecheck/build graph will fail unless this reference is removed.

## Backend API Surface Required by ARC Frontend

The ARC player frontend expects these stable endpoints (from `arcApi.ts`):

- `GET /api/apps/arc-agi/games`
- `POST /api/apps/arc-agi/sessions`
- `DELETE /api/apps/arc-agi/sessions/{session_id}`
- `POST /api/apps/arc-agi/sessions/{session_id}/games/{game_id}/reset`
- `POST /api/apps/arc-agi/sessions/{session_id}/games/{game_id}/actions`
- `GET /api/apps/arc-agi/sessions/{session_id}/events?after_seq=N`
- `GET /api/apps/arc-agi/sessions/{session_id}/timeline`

This aligns with current backend module routes in `go-go-app-arc-agi-3/pkg/backendmodule/routes.go`.

### Request/response mapping notes

- Action payload sent by frontend:

```json
{
  "action": "ACTION1",
  "data": {
    "guid": "...",
    "level": 1
  },
  "reasoning": null
}
```

- Backend enforces reset-before-action per `(sessionID, gameID)` by requiring known `guid` or returning:

```json
{
  "error": {
    "message": "missing game guid for session/game; call reset first"
  }
}
```

- Timeline/events are server-derived from `SessionEventStore`, not directly proxied from Python runtime.

## Target End Layout

After migration, desired ownership layout is:

```text
go-go-os/
  packages/engine
  packages/desktop-os
  packages/confirm-runtime
  apps/todo
  apps/crm
  apps/book-tracker-debug
  apps/apps-browser
  (no apps/arc-agi-player)

go-go-app-arc-agi-3/
  pkg/backendmodule
  apps/arc-agi-player
  docs/...
  2026-02-27--arc-agi/ARC-AGI

wesen-os/
  apps/os-launcher
  cmd/wesen-os-launcher
  pkg/arcagi
  (composition-only wiring)
```

### Dependency direction

```text
go-go-os (framework)  <-----  go-go-app-arc-agi-3 (ARC app)
         ^                                  ^
         |                                  |
         +------------- wesen-os -----------+
                  (composition + launch)
```

No reverse dependency from `go-go-os` to ARC app should remain.

## Migration Design

### Phase A: Move ARC app source via mv

Primary file operation:

```bash
mv go-go-os/apps/arc-agi-player go-go-app-arc-agi-3/apps/
```

Rationale:

- Preserves git history and minimizes churn.
- Keeps internal app structure intact (API hooks, components, stories, launcher export).

### Phase B: Rewire wesen-os launcher to mount ARC

Add module import in `modules.tsx`:

```ts
import { arcPlayerLauncherModule } from '@hypercard/arc-agi-player/launcher';
```

Append to module list:

```ts
export const launcherModules: LaunchableAppModule[] = [
  inventoryLauncherModule,
  arcPlayerLauncherModule,
  todoLauncherModule,
  crmLauncherModule,
  bookTrackerLauncherModule,
  appsBrowserLauncherModule,
];
```

Add alias mapping in three places:

- `wesen-os/apps/os-launcher/tsconfig.json`
- `wesen-os/apps/os-launcher/vite.config.ts`
- `wesen-os/apps/os-launcher/vitest.config.ts`

Alias target root:

- `../../../go-go-app-arc-agi-3/apps/arc-agi-player/...`

### Phase C: Clean stale references in go-go-os

Remove ARC project reference from `go-go-os/tsconfig.json` so the graph stays valid post-move.

### Phase D: Validate end-to-end gameplay

Validation pipeline:

1. Start `wesen-os` backend with ARC enabled.
2. Start `wesen-os` frontend (Vite).
3. Open ARC app window from launcher.
4. Exercise session flow via UI and/or curl.

API smoke script pseudocode:

```bash
BASE=http://127.0.0.1:8091/api/apps/arc-agi
GAME_ID=$(curl -s "$BASE/games" | jq -r '.games[0].game_id')
SESSION_ID=$(curl -s -X POST "$BASE/sessions" -H 'content-type: application/json' -d '{}' | jq -r '.session_id')
FRAME=$(curl -s -X POST "$BASE/sessions/$SESSION_ID/games/$GAME_ID/reset" -H 'content-type: application/json' -d '{}')
GUID=$(echo "$FRAME" | jq -r '.guid')
curl -s -X POST "$BASE/sessions/$SESSION_ID/games/$GAME_ID/actions" \
  -H 'content-type: application/json' \
  -d '{"action":"ACTION1","data":{"guid":"'"$GUID"'"}}'
curl -s "$BASE/sessions/$SESSION_ID/events"
curl -s "$BASE/sessions/$SESSION_ID/timeline"
```

## Sequence Diagram

```text
User -> Launcher UI: open ARC-AGI icon
Launcher UI -> arcPlayerLauncherModule: buildLaunchWindow()
Launcher UI -> ArcPlayerWindow: render with app key
ArcPlayerWindow -> ARC API module: GET /games
ArcPlayerWindow -> ARC API module: POST /sessions
ArcPlayerWindow -> ARC API module: POST /sessions/{id}/games/{game}/reset
ArcPlayerWindow -> ARC API module: POST /actions
ARC backend module -> Python runtime: /api/cmd/ACTIONn
Python runtime -> ARC backend module: frame payload
ARC backend module -> SessionEventStore: append structured event
ArcPlayerWindow -> ARC backend module: GET /events, /timeline
ArcPlayerWindow -> User: updated frame + action log + timeline
```

## Risk Analysis

### Risk 1: Alias mismatch across toolchains

Symptom:

- Works in Vite dev, fails in Vitest or TypeScript typecheck.

Cause:

- Missing ARC alias in one of `tsconfig`, `vite.config`, or `vitest.config`.

Mitigation:

- Treat alias updates as one atomic task and verify all three files in same commit.

### Risk 2: Frontend module appears but backend unavailable

Symptom:

- ARC window opens but `GET /games` fails.

Cause:

- Backend started with `--arc-enabled=false` or runtime driver startup failure.

Mitigation:

- Validate `/api/apps/arc-agi/health` first.
- Keep arc module optional but visible diagnostics through existing error UI.

### Risk 3: go-go-os build graph regression after move

Symptom:

- `go-go-os` typecheck fails due missing `apps/arc-agi-player` reference.

Mitigation:

- Remove root tsconfig reference in the same migration step.

### Risk 4: Hidden imports from old path in tests/docs

Symptom:

- Tests reference old absolute relative paths.

Mitigation:

- Run `rg -n "arc-agi-player|go-go-os/apps/arc-agi-player"` across `wesen-os` and `go-go-os` after move.

## Implementation Blueprint (Task-Level)

### Task 1: Ticket + investigation docs

Deliverables:

- This design doc.
- Chronological diary with command evidence.

Validation:

- `docmgr doctor --ticket GEPA-18-ARC-AGI-FRONTEND-EXTRACTION --stale-after 30`

### Task 2: Move ARC app with mv

Actions:

- `mv go-go-os/apps/arc-agi-player go-go-app-arc-agi-3/apps/`

Validation:

- `test -d go-go-app-arc-agi-3/apps/arc-agi-player`
- `test ! -d go-go-os/apps/arc-agi-player`

### Task 3: Rewire wesen-os frontend aliases + module list

Actions:

- Update `modules.tsx` imports and launcher module array.
- Add ARC aliases to tsconfig/vite/vitest.

Validation:

- `npm run typecheck -w apps/os-launcher` (inside `wesen-os`)
- `npm run test -w apps/os-launcher` (inside `wesen-os`)

### Task 4: Clean go-go-os stale reference

Actions:

- Remove ARC reference from `go-go-os/tsconfig.json`.

Validation:

- `npm run typecheck` (inside `go-go-os`) if dependencies are installed.

### Task 5: Backend/frontend runtime smoke for gameplay

Actions:

- Run `wesen-os-launcher` with ARC enabled.
- Run Vite frontend.
- Use UI + curl to verify game flow.

Validation:

- Successful `games -> session -> reset -> action -> events -> timeline` sequence.

### Task 6: Commit slicing and diary/changelog updates

Actions:

- Commit each task incrementally.
- Update ticket `tasks.md`, diary, changelog.

Validation:

- `git log --oneline` shows coherent sequence.

## API Reference Snapshot (for implementers)

### Frontend package contract

Current export contract (`package.json` and `src/index.ts`):

- `@hypercard/arc-agi-player`
- `@hypercard/arc-agi-player/launcher`

`/launcher` must continue exporting:

- `arcPlayerLauncherModule`
- `buildGameWindowPayload`

### Backend contract used by ARC UI

- `GET /api/apps/arc-agi/games`
- `POST /api/apps/arc-agi/sessions`
- `DELETE /api/apps/arc-agi/sessions/{id}`
- `POST /api/apps/arc-agi/sessions/{id}/games/{game}/reset`
- `POST /api/apps/arc-agi/sessions/{id}/games/{game}/actions`
- `GET /api/apps/arc-agi/sessions/{id}/events`
- `GET /api/apps/arc-agi/sessions/{id}/timeline`
- `GET /api/apps/arc-agi/schemas/{schema_id}`

### Reflection discovery endpoints

- `GET /api/os/apps`
- `GET /api/os/apps/arc-agi/reflection`

These routes are already served by the module host and ARC backend adapter.

## Pseudocode: Minimal wiring implementation

```text
if move_arc_app:
  mv(go-go-os/apps/arc-agi-player, go-go-app-arc-agi-3/apps/)
  remove(go-go-os/tsconfig ref for arc app)

update(wesen-os modules.tsx):
  import arc launcher module
  append to launcherModules list

for config in [tsconfig.json, vite.config.ts, vitest.config.ts]:
  add alias @hypercard/arc-agi-player -> go-go-app-arc-agi-3/apps/arc-agi-player
  add alias @hypercard/arc-agi-player/* -> .../src/* as needed

run checks:
  typecheck + tests in wesen-os app
  runtime smoke backend + frontend
```

## Testing Strategy

### Static checks

- Path-alias integrity by TypeScript compile.
- Test imports for launcher module list.

### Runtime checks

- Launcher icon opens ARC window.
- ARC window loads games list from backend.
- Reset and at least one action succeed.
- Timeline/events endpoint non-empty for session.

### Regression checks

- Inventory and other launcher apps still load (module list includes all prior apps).
- `go-go-os` no longer contains ARC app folder and no broken TS references.

## Open Questions

1. Should ARC module be auto-mounted in launcher menu by default or hidden behind feature flag in frontend as well?
2. Do we want ARC-specific shared reducers in launcher store, or keep ARC store local (current design keeps local store and is lower coupling)?
3. Should ARC stories be moved now or in a follow-up storybook consolidation ticket?

## Recommended Decision for This Ticket

- Mount ARC module by default in launcher modules for immediate playability.
- Keep ARC store local to ARC app (do not add shared reducers yet).
- Move stories with the app folder now (they are part of widget ownership), and postpone cross-repo unified storybook concerns.

## References

- `go-go-os/apps/arc-agi-player/src/launcher/module.tsx`
- `go-go-os/apps/arc-agi-player/src/api/arcApi.ts`
- `go-go-os/tsconfig.json`
- `wesen-os/apps/os-launcher/src/app/modules.tsx`
- `wesen-os/apps/os-launcher/tsconfig.json`
- `wesen-os/apps/os-launcher/vite.config.ts`
- `wesen-os/apps/os-launcher/vitest.config.ts`
- `wesen-os/cmd/wesen-os-launcher/main.go`
- `wesen-os/pkg/arcagi/module.go`
- `go-go-app-arc-agi-3/pkg/backendmodule/routes.go`
- `go-go-app-arc-agi-3/pkg/backendmodule/reflection.go`
