# Changelog

## 2026-02-28

- Initial workspace created


## 2026-02-28

Added full Phase 2 ARC bridge implementation design doc and a granular multi-phase execution checklist for intern-ready delivery.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/design-doc/01-implementation-plan-phase-2-arc-bridge-runtime-intent-to-command-wiring.md — Detailed architecture and phase-by-phase implementation plan
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/tasks.md — Granular task breakdown for execution and validation


## 2026-02-28

Executed ARC bridge implementation with clean split: engine kept generic, ARC bridge + demo stack + folder launcher implemented in go-go-app-arc-agi-3. Added updated plan/tasks and a detailed implementation diary with commit/test evidence.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/design-doc/01-implementation-plan-phase-2-arc-bridge-runtime-intent-to-command-wiring.md — Updated clean-split implementation plan
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/reference/01-implementation-diary.md — Chronological diary with commands
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/tasks.md — Updated granular tasks with completion status


## 2026-02-28

Fixed ARC demo initial render crash and removed render-time toast dispatch in PluginCardSessionHost. This resolves the React setState-during-render warning and surfaces runtime render errors cleanly.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts — Null-safe command access in demo card render
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/reference/01-implementation-diary.md — Diary entry documenting root cause and fix commits
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-os/packages/engine/src/components/shell/windowing/PluginCardSessionHost.tsx — Move toast dispatch out of render path and add render error fallback


## 2026-02-28

Fixed ARC HyperCard "Create Session" stuck state (`requested` with no HTTP call) by wiring an ARC pending-intent side-effect host into launcher card windows.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx — Queue consumer that executes `/api/apps/arc-agi/*` requests for pending runtime domain intents
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/launcher/module.tsx — Mount ARC pending-intent host for demo card windows
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-23-ARC-BRIDGE-PHASE-2--phase-2-arc-bridge-for-hypercard-runtime-command-execution/reference/01-implementation-diary.md — Diary entry with root cause, validation commands, and commit reference


## 2026-02-28

Fixed ARC demo post-session flow where reset/action remained blocked after successful session creation.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx — Avoid overwriting `arcGameId` with `undefined` in create-session success patches
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/middleware.ts — Keep middleware-side runtime patch semantics aligned
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts — Add game picker input/quick buttons and clearer precondition messaging in demo card


## 2026-02-28

Replaced hardcoded ARC game IDs in HyperCard demo with dynamic backend discovery.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/contracts.ts — Added `list-games` command op to ARC command contract
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx — Execute `list-games` via `/api/apps/arc-agi/games` in launcher card path and persist `arcAvailableGames`
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/middleware.ts — Mirror `list-games` execution support in app middleware path
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts — Add `Load Games` action and render dynamic game buttons from runtime session state


## 2026-02-28

Hardened dynamic game discovery parsing to support backend response-shape variants for `/api/apps/arc-agi/games`.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx — Normalize `list-games` payload extraction and ID parsing in launcher-card queue path
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/middleware.ts — Keep app-middleware `list-games` parsing behavior aligned

## 2026-02-28

Cleanup close requested by owner.

