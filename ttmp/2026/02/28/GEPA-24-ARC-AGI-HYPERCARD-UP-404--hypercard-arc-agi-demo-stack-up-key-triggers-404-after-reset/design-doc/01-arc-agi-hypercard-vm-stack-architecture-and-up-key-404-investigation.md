---
Title: ARC-AGI HyperCard VM stack architecture and Up-key 404 investigation
Ticket: GEPA-24-ARC-AGI-HYPERCARD-UP-404
Status: active
Topics:
    - arc-agi
    - bug
    - frontend
    - backend
    - go-go-os
    - go-go-app-arc-agi-3
    - hypercard
    - vm
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx
      Note: HyperCard pending-domain-intent executor that posts perform-action requests
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts
      Note: Demo stack emits lowercase direction action payloads and triggers failing flow
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/pkg/backendmodule/client.go
      Note: Action normalization and upstream /api/cmd endpoint construction
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/pkg/backendmodule/routes.go
      Note: ARC backend HTTP route matching and action handler behavior
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-os/go-go-os/pkg/backendhost/routes.go
      Note: Namespaced /api/apps/<app-id> route mounting behavior
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-os/packages/engine/src/components/shell/windowing/PluginCardSessionHost.tsx
      Note: QuickJS plugin host that renders cards and emits runtime intents
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-os/packages/engine/src/plugin-runtime/runtimeService.ts
      Note: QuickJS runtime lifecycle load/render/event internals
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-os/packages/engine/src/plugin-runtime/stack-bootstrap.vm.js
      Note: VM bootstrap contract and dispatch helpers for card handlers
    - Path: workspaces/2026-02-22/add-gepa-optimizer/wesen-os/apps/os-launcher/src/app/modules.tsx
      Note: Launcher module registration for ARC frontend integration
    - Path: workspaces/2026-02-22/add-gepa-optimizer/wesen-os/cmd/wesen-os-launcher/main.go
      Note: ARC backend module registration and namespaced mounting in host
ExternalSources: []
Summary: End-to-end architecture guide for ARC-AGI HyperCard demo stack plus root-cause analysis for Up/Reset 404 and concrete remediation plan.
LastUpdated: 2026-02-28T18:49:00Z
WhatFor: Onboard new engineers to the ARC HyperCard stack and document the reproducible 404 failure path with evidence-backed fixes.
WhenToUse: Use when debugging ARC HyperCard command failures, adding new ARC cards, or understanding go-go-os/go-go-app-arc-agi-3 integration in wesen-os.
---



# ARC-AGI HyperCard VM stack architecture and Up-key 404 investigation

## Executive summary

This document explains how the ARC-AGI HyperCard demo stack works from desktop launcher click all the way to the Python ARC runtime, then analyzes a reproducible bug where `Reset Game` succeeds but pressing `Up` returns `404`.

Observed production behavior in the running development environment:

1. `POST /api/apps/arc-agi/sessions` returns `201`.
2. `GET /api/apps/arc-agi/games` returns `200`.
3. `POST /api/apps/arc-agi/sessions/{sid}/games/{gid}/reset` returns `200`.
4. `POST /api/apps/arc-agi/sessions/{sid}/games/{gid}/actions` returns `404` when the HyperCard demo sends `{"action":"up"}`.

Root cause (evidence-backed): the demo HyperCard card sends lowercase direction words (`up/down/left/right`) while the backend module expects `ACTION1..ACTION7` or numeric aliases (`1..7`). The backend normalizes `up` to `UP`, then calls upstream `/api/cmd/UP`, which is not a valid ARC command endpoint and returns `404`.

Control proof: the same endpoint returns `200` when called with `{"action":"ACTION1"}`.

Primary recommendation:

1. Normalize action names in the demo card to canonical `ACTION*` before dispatching requests.
2. Add defensive alias normalization in backend (`UP -> ACTION1`, etc.) to protect other clients.
3. Add tests for both frontend mapping and backend alias normalization.

## Problem statement and scope

### Problem

In the ARC HyperCard demo card flow, the action buttons can trigger a `404` after a successful reset, creating the appearance of broken backend routing. The user-reported sequence is:

1. Start HyperCard demo stack.
2. Create session.
3. Load games.
4. Pick game.
5. Reset.
6. Press `Up`.
7. Receive `404`.

### Scope

This investigation covers:

1. Frontend runtime path in `go-go-os` and `go-go-app-arc-agi-3`.
2. Backend route and command path in `go-go-app-arc-agi-3/pkg/backendmodule`.
3. Integration host path in `wesen-os` where these pieces are mounted.
4. Programmatic reproduction.
5. Potential adjacent issues and risk areas.

This investigation does not include:

1. Final production code fix (this is architecture/research ticket, not a patch ticket).
2. ARC Python engine internals beyond request/response behavior necessary to explain the bug.

## Current state architecture (end-to-end)

## 1) Process and route topology

When running the current dev setup, the active runtime includes:

1. `wesen-os` frontend (Vite at `127.0.0.1:5173`).
2. `wesen-os-launcher` Go backend (`127.0.0.1:8091` in current tmux run).
3. ARC raw runtime process launched by backend module (Python server from `ARC-AGI`, bound to loopback).

The routing namespace is enforced by backend host mounting:

- `MountNamespacedRoutes()` attaches each app under `/api/apps/<app-id>` (`go-go-os/go-go-os/pkg/backendhost/routes.go:37-56`).
- ARC app id is `arc-agi` (`go-go-app-arc-agi-3/pkg/backendmodule/contracts.go:5`).
- Therefore ARC module base path is `/api/apps/arc-agi/*`.

In wesen launcher, ARC module is created and mounted if `--arc-enabled=true` (`wesen-os/cmd/wesen-os-launcher/main.go:237-275`).

## 2) Frontend launcher composition

The OS launcher frontend includes the ARC launcher module from `go-go-app-arc-agi-3`:

- `launcherModules` includes `arcPlayerLauncherModule` (`wesen-os/apps/os-launcher/src/app/modules.tsx:4-17`).

The ARC launcher module defines two UX entry points:

1. React game window (`Open React Game`).
2. HyperCard demo stack (`Open HyperCard Demo Stack`).

Evidence:

- `ArcLauncherFolderWindow` defines both buttons (`go-go-app-arc-agi-3/apps/arc-agi-player/src/launcher/module.tsx:79-98`).
- HyperCard demo window payload uses `content.kind: 'card'` and `stackId: ARC_DEMO_STACK.id` (`launcher/module.tsx:49-67`).

## 3) HyperCard runtime in go-go-os

The HyperCard demo stack is not plain React state; it is a VM-backed plugin card stack.

### Stack declaration

- `ARC_DEMO_STACK` declares plugin bundle source code and capabilities (`go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/stack.ts:25-37`).
- `plugin.capabilities.domain = ['arc']` and `plugin.capabilities.system = ['notify']` (`stack.ts:30-36`).

### Runtime host

- `PluginCardSessionHost` (from go-go-os engine) hosts VM sessions for card stacks (`go-go-os/packages/engine/src/components/shell/windowing/PluginCardSessionHost.tsx:73-400`).
- It loads `bundleCode` into QuickJS runtime via `QuickJSCardRuntimeService.loadStackBundle()` (`PluginCardSessionHost.tsx:142-149`, `runtimeService.ts:201-218`).
- It renders card trees through `renderCard()` (`PluginCardSessionHost.tsx:295-305`, `runtimeService.ts:253-271`).
- It handles card events via `eventCard()` and dispatches runtime intents (`PluginCardSessionHost.tsx:333-365`, `runtimeService.ts:273-293`).

### VM bootstrap contract

The VM runtime host exposes:

1. `defineStackBundle(factory)` registration.
2. UI helpers (`ui.text`, `ui.button`, `ui.row`, etc.).
3. handler context dispatchers:
   - `dispatchCardAction`
   - `dispatchSessionAction`
   - `dispatchDomainAction`
   - `dispatchSystemCommand`

Evidence: `go-go-os/packages/engine/src/plugin-runtime/stack-bootstrap.vm.js:37-43, 170-212`.

## 4) Intent routing model

When card handlers run in VM, emitted intents are validated and ingested into plugin runtime state.

- Runtime intent schema includes `scope: card|session|domain|system` (`go-go-os/packages/engine/src/plugin-runtime/contracts.ts:13-38`).
- `pluginCardRuntimeSlice` stores pending domain/system intents and applies local session/card patches (`go-go-os/packages/engine/src/features/pluginCardRuntime/pluginCardRuntimeSlice.ts:235-310`).

For domain intents:

1. intent is authorized against capability policy (`pluginCardRuntimeSlice.ts:268-273`).
2. intent is queued in `pendingDomainIntents` (`pluginCardRuntimeSlice.ts:275-283`).

## 5) ARC bridge execution path for HyperCard demo

Important architectural nuance for this bug:

- The HyperCard demo card path in `wesen-os` uses `ArcPendingIntentEffectHost` in the demo card adapter (`launcher/module.tsx:100-117`).
- `ArcPendingIntentEffectHost` dequeues pending domain intents and executes ARC HTTP requests directly (`ArcPendingIntentEffectHost.tsx:308-427`).

That means the demo card does not rely on the separate RTK middleware-only flow used by the dedicated React player windows.

`ArcPendingIntentEffectHost.executeArcCommand()` maps `perform-action` to:

- `POST /api/apps/arc-agi/sessions/{sessionId}/games/{gameId}/actions`
- request body is `args.action` object as-is (`ArcPendingIntentEffectHost.tsx:230-237`).

## 6) ARC backend module request path

### Backend route handling

The backend module mounts:

- `/games`, `/sessions`, `/sessions/*`, etc. (`go-go-app-arc-agi-3/pkg/backendmodule/module.go:109-120`).

Action endpoint is explicitly recognized:

- `POST /sessions/{session}/games/{game}/actions` (`routes.go:152-159`).

Action handler behavior:

1. Decodes JSON `{ action, data, reasoning }` (`routes.go:209-221`).
2. Normalizes action via `normalizeActionName()` (`routes.go:222-225`).
3. Injects stored `guid` (requires successful reset first) (`routes.go:231-237`).
4. Calls `client.Action(...)` (`routes.go:243-247`).

### Upstream command mapping

`HTTPArcAPIClient.Action()` behavior:

1. Normalizes action name (`client.go:131-133`).
2. Rejects empty/RESET (`client.go:133-135`).
3. Calls upstream endpoint `/api/cmd/{actionName}` (`client.go:143`).

Critical normalization details:

- If action starts with `ACTION`, keep it.
- If action is numeric `1..7`, map to `ACTION1..ACTION7`.
- Otherwise, return uppercased raw token unchanged.

Evidence: `client.go:210-220`.

This means:

- `ACTION1` -> `ACTION1` (valid).
- `1` -> `ACTION1` (valid).
- `up` -> `UP` (likely invalid upstream command).

## 7) Runtime driver behavior

In current tmux run, launcher is started with raw driver flags (`--arc-driver=raw ... --arc-raw-listen-addr ...` from process list), and raw driver code:

1. writes Python bootstrap script invoking `arc.listen_and_serve(...)` (`driver_common.go:115-135`, `driver_raw.go:48-64`).
2. runs Python command inside ARC repo root (`driver_raw.go:64-67`).
3. probes runtime health at `/api/healthcheck` (`driver_common.go:95-113`).

Therefore, `/api/cmd/<ACTION>` requests are sent to the Python runtime URL via `requestJSON()` in client (`client.go:149-197`).

## Bug reproduction and evidence

## 1) UI reproduction

Reproduced with Playwright against active frontend (`http://127.0.0.1:5173`):

1. Open `ARC-AGI` app.
2. Click `Open HyperCard Demo Stack`.
3. Click `Create Session`.
4. Click `Load Games`.
5. Click game button `bt11-fd9df0622a1a`.
6. Click `Reset Game`.
7. Click `Up`.

Observed network results:

1. `POST /api/apps/arc-agi/sessions` -> `201`.
2. `GET /api/apps/arc-agi/games` -> `200`.
3. `POST /api/apps/arc-agi/sessions/.../reset` -> `200`.
4. `POST /api/apps/arc-agi/sessions/.../actions` -> `404`.

UI status changed to failed with `Last error: ARC request failed (404)`.

## 2) Programmatic reproduction

A script was added under this ticket workspace:

- `scripts/repro_arc_demo_up_404.sh`

Script flow:

1. open session
2. choose game
3. reset
4. call lowercase `up`
5. call canonical `ACTION1`

Observed output in current environment:

- lowercase `up` path returns `404` and backend error wrapping `/api/cmd/UP` upstream 404.
- canonical `ACTION1` returns `200`.

This isolates action token mapping as the fault line.

## Root cause analysis

## Root cause

The HyperCard demo card hardcodes directional actions as lowercase words:

- `Up` -> `action: 'up'`
- `Down` -> `action: 'down'`
- `Left` -> `action: 'left'`
- `Right` -> `action: 'right'`

Evidence: `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts:92-95`.

The same file passes that value through in `doAction`:

- `args: { action: { action } }` where `action` defaults to `'up'` (`pluginBundle.ts:180-194`).

Backend normalization does not map directional words to canonical action IDs. It uppercases unknowns, so `up` becomes `UP` (`client.go:210-220`), and then calls `/api/cmd/UP` (`client.go:143`). Upstream does not expose `/api/cmd/UP`, so request fails with 404.

## Why reset works but up fails

Reset path is explicit and canonical:

- Backend always uses `/api/cmd/RESET` in `Reset()` (`client.go:99-107`).

Action path depends on caller-provided action token:

- caller-provided `ACTION1` works.
- caller-provided `up` fails.

## Why this looked like route registration bug at first

The frontend error surfaces the outer route `/api/apps/arc-agi/.../actions` with status 404. That can be mistaken for missing Go route. In reality, the route exists and returns upstream error status when the wrapped ARC API call fails.

Evidence:

1. route handler exists (`routes.go:152-159`).
2. route unit tests succeed for canonical action payloads (`module_test.go:107-111`).
3. direct API call with `ACTION1` returns 200 (reproduced via script).

## How to write an ARC-AGI-3 HyperCard card (intern guide)

This section focuses on the VM-backed HyperCard path used by the demo card stack.

## 1) Declare stack metadata

Create a stack file similar to `apps/arc-agi-player/src/domain/stack.ts`:

1. set stable `id`, `name`, `icon`, `homeCard`.
2. set `plugin.bundleCode` to your VM JS string.
3. declare capabilities.
4. provide placeholder `cards` entries for plugin cards.

Minimal pattern:

```ts
import type { CardStackDefinition } from '@hypercard/engine';
import { MY_PLUGIN_BUNDLE } from './pluginBundle';

export const MY_STACK: CardStackDefinition = {
  id: 'my-stack',
  name: 'My Stack',
  icon: '🧪',
  homeCard: 'home',
  plugin: {
    bundleCode: MY_PLUGIN_BUNDLE,
    capabilities: {
      domain: ['arc'],
      system: ['notify'],
    },
  },
  cards: {
    home: {
      id: 'home',
      type: 'plugin',
      title: 'Home',
      icon: '🧪',
      ui: { t: 'text', value: 'Plugin placeholder' },
    },
  },
};
```

Type contract reference: `go-go-os/packages/engine/src/cards/types.ts:1-25`.

## 2) Author the VM bundle

In `pluginBundle.ts`, export a JS string using `defineStackBundle(({ ui }) => { ... })`.

Required shape:

1. top-level fields: `id`, `title`, optional initial state.
2. `cards` object with card definitions.
3. each card has `render(...)` and optional `handlers`.

Available UI constructors come from bootstrap host:

- `ui.text`, `ui.button`, `ui.input`, `ui.row`, `ui.column`, `ui.panel`, etc.

Reference: `go-go-os/packages/engine/src/plugin-runtime/stack-bootstrap.vm.js:1-32, 37-43`.

## 3) Use handler context correctly

Handler context includes:

1. `cardState`, `sessionState`, `globalState`
2. `dispatchCardAction(actionType, payload)`
3. `dispatchSessionAction(actionType, payload)`
4. `dispatchDomainAction(domain, actionType, payload)`
5. `dispatchSystemCommand(command, payload)`

Reference: `stack-bootstrap.vm.js:203-212`.

For ARC calls, use domain intent:

```js
dispatchDomainAction('arc', 'command.request', {
  op: 'perform-action',
  requestId,
  args: {
    sessionId,
    gameId,
    action: { action: 'ACTION1' },
  },
});
```

Important: send canonical action names (`ACTION1..ACTION7`) or numeric aliases to avoid `UP`-style mismatch.

## 4) Wire stack into launcher window

Use launcher module to open a card window with stack id and card session id:

- set `content.kind = 'card'`
- set `content.card.stackId`
- set `content.card.cardSessionId`

Reference: `apps/arc-agi-player/src/launcher/module.tsx:49-67`.

For HyperCard in wesen-os, also render:

1. `PluginCardSessionHost`
2. bridge executor (`ArcPendingIntentEffectHost`) for pending domain intents

Reference: `launcher/module.tsx:100-117`.

## 5) Bridge domain intents to backend calls

There are two bridge patterns in this codebase:

1. middleware-driven bridge (`createArcBridgeMiddleware`) for dedicated ARC React store windows.
2. effect-host bridge (`ArcPendingIntentEffectHost`) for HyperCard demo windows in launcher store.

For HyperCard demo path, the effect host is active and executes commands by consuming `pendingDomainIntents` (`ArcPendingIntentEffectHost.tsx:308-427`).

## 6) Validate against backend contracts early

Backend action route contract expects payload:

```json
{
  "action": "ACTION3",
  "data": {},
  "reasoning": {"note":"optional"}
}
```

Reference: `docs/arc-agi-app-module-user-guide.md:172-189`.

Practical validation checklist while authoring cards:

1. create session succeeds.
2. reset succeeds and returns/stores guid.
3. action uses canonical token.
4. action returns frame with `state` and `available_actions`.

## Programmatic reproduction guide

## Option A: ticket script

Run:

```bash
/home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/scripts/repro_arc_demo_up_404.sh
```

Expected:

1. `reset available_actions` contains canonical `ACTION*` values.
2. lowercase `up` request returns `404` with backend-wrapped `/api/cmd/UP` error.
3. `ACTION1` control request returns `200`.

## Option B: raw curl sequence

```bash
BASE='http://127.0.0.1:5173/api/apps/arc-agi'
SID=$(curl -sS -X POST "$BASE/sessions" -H 'content-type: application/json' -d '{}' | jq -r '.session_id')
GID=$(curl -sS "$BASE/games" | jq -r '.games[0].game_id')
curl -sS -X POST "$BASE/sessions/$SID/games/$GID/reset" -H 'content-type: application/json' -d '{}' | jq '.available_actions'
curl -sS -w '\n%{http_code}\n' -X POST "$BASE/sessions/$SID/games/$GID/actions" -H 'content-type: application/json' -d '{"action":"up","data":{}}'
curl -sS -w '\n%{http_code}\n' -X POST "$BASE/sessions/$SID/games/$GID/actions" -H 'content-type: application/json' -d '{"action":"ACTION1","data":{}}'
```

## Potential issues discovered (beyond immediate root cause)

## 1) Frontend/backed action vocabulary drift risk

Current demo card uses semantic direction words while backend contracts are canonical action IDs. Without strict shared typing, this mismatch can reoccur.

Evidence:

1. demo bundle hardcodes words (`pluginBundle.ts:92-95`).
2. backend docs and handler expect `ACTION*` (`docs/arc-agi-app-module-user-guide.md:185-186`, `routes.go:223-225`).

Impact:

- user-visible 404s and opaque failure reason.

## 2) No guardrail test for directional aliases

Backend tests validate canonical forms but do not test string aliases like `up/down/left/right`.

Evidence: module tests focus on `ACTION*` payloads (`module_test.go:107, 146, 200`).

Impact:

- regressions can pass CI while failing in UI integrations.

## 3) HyperCard demo does not gate buttons by returned available actions

The demo card always renders Up/Down/Left/Right buttons. It does not disable based on `available_actions` returned by reset/action frames.

Evidence: fixed button rows in bundle (`pluginBundle.ts:91-96`), while reset response includes specific available actions (repro output often `ACTION3`, `ACTION4`).

Impact:

- users can invoke unsupported actions and create avoidable error noise.

## 4) Bridge logic duplicated in two codepaths

ARC command execution logic exists in both:

1. `ArcPendingIntentEffectHost.tsx`
2. `bridge/middleware.ts`

These files contain near-duplicate `executeArcCommand`, error handling, and runtime patching.

Impact:

- behavior drift over time.
- bug fixes may be applied to one path and missed in the other.

## 5) Error projection favors status code over actionable detail

UI error message mainly surfaces `ARC request failed (404)`. Details payload exists but is not prominently exposed in demo UI.

Impact:

- engineers may misdiagnose route mount failures instead of command token mismatch.

## Proposed remediation plan

## Phase 1: stop user-facing 404 immediately

1. Update demo card action mapping to canonical action IDs.
2. Keep button labels human-friendly (`Up`) but payload canonical (`ACTION1`).

Suggested mapping:

```ts
const DIRECTION_ACTIONS = {
  up: 'ACTION1',
  down: 'ACTION2',
  left: 'ACTION3',
  right: 'ACTION4',
} as const;
```

Then in `doAction`, resolve:

```ts
const raw = String(asRecord(args).action || 'up').toLowerCase();
const action = DIRECTION_ACTIONS[raw] ?? String(asRecord(args).action || 'ACTION1');
```

## Phase 2: backend compatibility hardening

In `normalizeActionName`, add alias map:

1. `UP -> ACTION1`
2. `DOWN -> ACTION2`
3. `LEFT -> ACTION3`
4. `RIGHT -> ACTION4`

This protects all clients and reduces fragility from semantic action names.

## Phase 3: contract and UX hardening

1. Disable or hide direction buttons not present in `available_actions`.
2. Add regression tests:
   - frontend: bundle handler emits canonical actions.
   - backend: alias normalization table.
3. Consolidate ARC bridge execution logic into shared implementation to eliminate drift between middleware and effect host paths.

## Testing and validation strategy

## Regression tests to add

1. `pluginBundle.ts` unit test:
   - input args `up/down/left/right`.
   - emitted request payload uses `ACTION1/2/3/4`.

2. backendmodule client tests:
   - `Action(..., "up", ...)` maps to `/api/cmd/ACTION1`.
   - same for `down/left/right`.

3. integration smoke test (HTTP level):
   - create session
   - reset game
   - post `{"action":"up"}`
   - assert non-404 and expected shape.

## Manual validation checklist

1. HyperCard demo flow in launcher:
   - create session
   - load games
   - pick game
   - reset
   - click Up/Down/Left/Right
   - no 404 responses

2. Control check with curl:
   - lowercase aliases and canonical `ACTION*` both accepted.

3. timeline/events:
   - `arc.action.requested` and `arc.action.completed` appended correctly.

## Alternatives considered

## Alternative A: change only backend alias normalization

Pros:

1. one server-side patch fixes all clients.

Cons:

1. hides frontend contract drift.
2. still allows UI to send unsupported semantic tokens in future.

## Alternative B: change only frontend demo bundle

Pros:

1. keeps backend strict and explicit.

Cons:

1. other consumers can still fail with same mismatch.
2. no defensive compatibility layer.

## Alternative C: strict reject with 400 and explicit guidance

Pros:

1. better error semantics than upstream 404.

Cons:

1. still a breaking behavior for current demo until frontend fixed.
2. requires extra mapping or validation path anyway.

Preferred direction: do both frontend canonical mapping and backend defensive alias mapping.

## Open questions

1. Should backend accept semantic aliases (`UP`) as stable public API behavior, or treat as compatibility shim with deprecation timeline?
2. Should HyperCard demo card render action buttons dynamically from `available_actions` instead of fixed directional controls?
3. Should `ArcPendingIntentEffectHost` and `createArcBridgeMiddleware` be merged behind a shared command executor helper to prevent behavior drift?
4. Should error payload details from backend be surfaced in the demo card UI (for example showing endpoint and upstream message)?

## References

### Core bug path

1. `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts:92-95`
2. `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts:169-195`
3. `go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx:230-237`
4. `go-go-app-arc-agi-3/pkg/backendmodule/routes.go:215-247`
5. `go-go-app-arc-agi-3/pkg/backendmodule/client.go:131-147`
6. `go-go-app-arc-agi-3/pkg/backendmodule/client.go:210-220`

### Runtime and card architecture

1. `go-go-app-arc-agi-3/apps/arc-agi-player/src/launcher/module.tsx:49-67`
2. `go-go-app-arc-agi-3/apps/arc-agi-player/src/launcher/module.tsx:100-117`
3. `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/stack.ts:25-37`
4. `go-go-os/packages/engine/src/components/shell/windowing/PluginCardSessionHost.tsx:142-205`
5. `go-go-os/packages/engine/src/plugin-runtime/runtimeService.ts:201-293`
6. `go-go-os/packages/engine/src/plugin-runtime/stack-bootstrap.vm.js:37-43`
7. `go-go-os/packages/engine/src/plugin-runtime/stack-bootstrap.vm.js:170-217`
8. `go-go-os/packages/engine/src/features/pluginCardRuntime/pluginCardRuntimeSlice.ts:268-307`

### Host integration

1. `wesen-os/apps/os-launcher/src/app/modules.tsx:10-17`
2. `wesen-os/pkg/arcagi/module.go:20-49`
3. `wesen-os/cmd/wesen-os-launcher/main.go:237-275`
4. `go-go-os/go-go-os/pkg/backendhost/routes.go:37-56`

### Backend API contracts and tests

1. `go-go-app-arc-agi-3/docs/arc-agi-app-module-user-guide.md:172-189`
2. `go-go-app-arc-agi-3/pkg/backendmodule/module_test.go:85-115`
3. `go-go-app-arc-agi-3/pkg/backendmodule/module_test.go:141-151`
