---
Title: 'Implementation plan: Phase 2 ARC bridge runtime intent-to-command wiring'
Ticket: GEPA-23-ARC-BRIDGE-PHASE-2
Status: active
Topics:
    - arc-agi
    - go-go-os
    - hypercard
    - js-vm
    - inventory-app
    - architecture
    - frontend
    - backend
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-os/packages/engine/src/components/shell/windowing/pluginIntentRouting.ts
      Note: Generic runtime intent routing; now only provides generic metadata and dispatch plumbing
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/contracts.ts
      Note: ARC command contracts moved into ARC app repo
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/slice.ts
      Note: ARC command lifecycle reducer in ARC app store
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/middleware.ts
      Note: ARC bridge middleware executing backend calls and mirroring runtime session status
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts
      Note: Demo HyperCard VM bundle dispatching arc/command.request intents
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/stack.ts
      Note: Demo stack contract and capability policy (domain arc + notify)
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/launcher/module.tsx
      Note: Launcher now opens ARC folder with both React game and HyperCard demo stack entrypoints
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/app/store.ts
      Note: ARC app store registration for arcBridge reducer and middleware
ExternalSources: []
Summary: "Updated implementation plan with clean split: engine remains generic; ARC bridge and ARC demo HyperCard stack are implemented in go-go-app-arc-agi-3."
LastUpdated: 2026-02-28T01:07:00-05:00
WhatFor: Keep GEPA-23 implementation aligned with the clean repository boundary and intern-readable execution path.
WhenToUse: Use when continuing Phase 2 ARC bridge delivery and validating folder launch + React/game + HyperCard stack coexistence.
---

# Implementation plan: Phase 2 ARC bridge runtime intent-to-command wiring

## Executive Summary

Boundary decision update (2026-02-28):

1. `go-go-os` engine remains generic runtime plumbing only.
2. All ARC domain logic (contracts, reducer, middleware, API mapping, demo stack) lives in `go-go-app-arc-agi-3`.
3. ARC launcher icon opens an ARC folder window with two paths:
   - current React ARC player window,
   - HyperCard demo stack window.

This split keeps architecture clean and avoids ARC-specific business logic in shared engine packages.

## Why This Split

The runtime host (`PluginCardSessionHost`, `dispatchRuntimeIntent`) is shared infrastructure. ARC command semantics are application domain logic.

If ARC bridge code lives in engine, every app inherits ARC domain concerns. Moving ARC bridge to `go-go-app-arc-agi-3` keeps ownership clear and reduces cross-app coupling.

## Current Architecture (Implemented)

1. VM card handlers dispatch `dispatchDomainAction('arc', 'command.request', payload)`.
2. Generic engine routing emits canonical Redux action `type: 'arc/command.request'` with runtime metadata.
3. ARC app store middleware (`bridge/middleware.ts`) intercepts request actions and:
   - validates payload,
   - checks capability policy for plugin-runtime sources,
   - calls `/api/apps/arc-agi/*`,
   - dispatches `arc/command.started|succeeded|failed`,
   - upserts session/game snapshots.
4. Middleware mirrors status back to runtime session state via `ingestRuntimeIntent(scope='session', actionType='patch', ...)` so demo card UI can update.

## Folder Launch Behavior (Implemented)

`arc-agi-player` icon now opens a folder-style ARC window that provides both:

1. `Open React Game` -> launches existing React ARC player.
2. `Open HyperCard Demo Stack` -> launches `PluginCardSessionHost` with ARC demo stack.

This satisfies co-existence and gives interns both reference surfaces in one app.

## Command Contract (v1)

Actions:

1. `arc/command.request`
2. `arc/command.started`
3. `arc/command.succeeded`
4. `arc/command.failed`
5. `arc/session.snapshot.upsert`
6. `arc/game.snapshot.upsert`

Ops:

1. `create-session`
2. `reset-game`
3. `perform-action`
4. `load-timeline`
5. `load-events`

## API Mapping

| op | route | method |
|---|---|---|
| create-session | `/api/apps/arc-agi/sessions` | POST |
| reset-game | `/api/apps/arc-agi/sessions/:sessionId/games/:gameId/reset` | POST |
| perform-action | `/api/apps/arc-agi/sessions/:sessionId/games/:gameId/actions` | POST |
| load-timeline | `/api/apps/arc-agi/sessions/:sessionId/timeline` | GET |
| load-events | `/api/apps/arc-agi/sessions/:sessionId/events` | GET |

## Implementation Status Snapshot

Completed:

1. engine cleanup for clean split (ARC bridge removed from engine).
2. generic runtime metadata propagation in domain dispatch path.
3. ARC bridge contracts/slice/selectors/middleware in ARC app repo.
4. ARC app store wiring for bridge reducer + middleware.
5. demo HyperCard bundle + stack for ARC commands.
6. launcher cutover to folder window with React + HyperCard entrypoints.
7. launcher-host tests pass after wiring.

Pending:

1. dedicated bridge unit tests in ARC repo.
2. end-to-end runtime card click -> backend -> UI verification pass with screenshots.
3. optional event-viewer integration for ARC command lifecycle filtering.

## Risks and Mitigations

1. Risk: runtime rerender behavior on domain-only updates can still miss updates in some paths.
Mitigation: middleware mirrors ARC status into runtime session state to force card-visible changes; GEPA-22 remains long-term host-level fix.

2. Risk: duplicate request IDs from card handlers.
Mitigation: middleware dedupe guard plus card-generated request IDs.

3. Risk: ownership drift back into engine.
Mitigation: keep ARC-specific files only under `apps/arc-agi-player/src/bridge` and `apps/arc-agi-player/src/domain`.

## Next Steps

1. Add ARC bridge middleware tests with mocked fetch.
2. Add manual validation checklist entry in changelog with exact command traces.
3. Optionally add small debug window section for ARC bridge command list.
