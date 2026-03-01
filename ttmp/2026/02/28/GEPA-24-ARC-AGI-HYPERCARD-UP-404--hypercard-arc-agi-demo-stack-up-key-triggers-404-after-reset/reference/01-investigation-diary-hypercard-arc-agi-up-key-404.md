---
Title: 'Investigation diary: HyperCard ARC-AGI Up-key 404'
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
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts
      Note: Primary source for action payload values observed in bug path
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3/pkg/backendmodule/client.go
      Note: Verified action normalization behavior from diary test loop
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/scripts/repro_arc_demo_up_404.sh
      Note: Programmatic repro script created during investigation
ExternalSources: []
Summary: Chronological investigation log for reproducing and diagnosing HyperCard Up-key 404 in ARC demo stack.
LastUpdated: 2026-02-28T19:20:00Z
WhatFor: Preserve exact commands, observations, and reasoning so another engineer can continue without rediscovery.
WhenToUse: Use when reproducing the same issue, auditing investigation quality, or validating environment-specific behavior.
---


# Investigation diary: HyperCard ARC-AGI Up-key 404

## Goal

1. Create a new ticket workspace.
2. Reproduce the exact reported bug sequence against the live tmux environment.
3. Map end-to-end architecture for `go-go-os` + `go-go-app-arc-agi-3` integration.
4. Produce intern-level explanation and root-cause analysis.
5. Produce programmatic reproduction artifact.
6. Validate docs and upload to reMarkable.

## Context

The user reported a reproducible 404 after:

1. create session
2. load games
3. click game
4. reset
5. press Up

Frontend/backend were already running in tmux.

## Chronological log

## Phase 1: ticket setup and scaffolding

### 1.1 Check docmgr status

Command:

```bash
docmgr status --summary-only
```

Result:

- confirmed docs root and healthy ttmp status.

### 1.2 Inspect existing tickets and choose new ID

Initial attempt:

```bash
docmgr ticket list --limit 10
```

Result:

- failed: `unknown flag: --limit`.

Follow-up:

```bash
docmgr list tickets --with-glaze-output --fields ticket,title,status,topics,path,last_updated
```

Result:

- latest active sequence showed `GEPA-23` exists, so created `GEPA-24`.

### 1.3 Create ticket and docs

Commands:

```bash
docmgr ticket create-ticket \
  --ticket GEPA-24-ARC-AGI-HYPERCARD-UP-404 \
  --title "HyperCard ARC-AGI demo stack Up key triggers 404 after reset" \
  --topics arc-agi,bug,frontend,backend,go-go-os,go-go-app-arc-agi-3,hypercard,vm

docmgr doc add --ticket GEPA-24-ARC-AGI-HYPERCARD-UP-404 --doc-type design-doc \
  --title "ARC-AGI HyperCard VM stack architecture and Up-key 404 investigation"

docmgr doc add --ticket GEPA-24-ARC-AGI-HYPERCARD-UP-404 --doc-type reference \
  --title "Investigation diary: HyperCard ARC-AGI Up-key 404"
```

Result:

- ticket workspace created at:
  - `go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset`
- base files present: `index.md`, `tasks.md`, `changelog.md`, design doc, diary doc.

## Phase 2: discover live runtime and reproduce issue in UI

### 2.1 Find running tmux sessions and listening ports

Commands:

```bash
tmux ls
ss -ltnp | rg -n '(:3000|:3001|:5173|:8080|:8081|:8090|:9000|:9020|:9021|:9022)' -S
```

Result:

- active session: `wesen-dev-192238`
- frontend listening at `127.0.0.1:5173`.

### 2.2 Inspect tmux panes/processes

Commands:

```bash
tmux list-panes -a -F '#S:#I.#P #{pane_current_command} #{pane_active} #{pane_title} #{pane_pid}'
ps -ef | rg -n 'go-go-os|wesen|arc-agi|go run|go build|cmd' -S
```

Result:

- backend process present via `go run ./cmd/wesen-os-launcher ... --arc-driver=raw ...`.
- raw ARC Python process active via `uv run python /tmp/arc-agi-raw-.../run_arc_server.py`.

### 2.3 Reproduce with Playwright (UI path)

URL:

```bash
http://127.0.0.1:5173
```

Flow executed:

1. open desktop
2. open `ARC-AGI`
3. click `Open HyperCard Demo Stack`
4. `Create Session`
5. `Load Games`
6. pick first game
7. `Reset Game`
8. click `Up`

Observed UI state after step 8:

- status became `failed`
- `Last error: ARC request failed (404)`

Captured failing network request:

- `POST /api/apps/arc-agi/sessions/{session}/games/{game}/actions` -> `404`.

Captured exact console endpoint:

- `http://127.0.0.1:5173/api/apps/arc-agi/sessions/<sid>/games/<gid>/actions`.

## Phase 3: isolate whether route is missing or payload is wrong

### 3.1 Direct API repro via curl

First attempts had shell issues:

1. used variable `GID` in zsh, which is reserved (`failed to change group ID`).
2. corrected variable name to `GAME_ID`.

Working command sequence (condensed):

```bash
BASE='http://127.0.0.1:5173/api/apps/arc-agi'
SESSION_JSON=$(curl -sS -X POST "$BASE/sessions" -H 'content-type: application/json' -d '{"source_url":"manual-repro"}')
SID=$(echo "$SESSION_JSON" | jq -r '.session_id')
GAME_ID=$(curl -sS "$BASE/games" | jq -r '.games[0].game_id')
RESET_JSON=$(curl -sS -X POST "$BASE/sessions/${SID}/games/${GAME_ID}/reset" -H 'content-type: application/json' -d '{}')
ACTION_JSON=$(curl -sS -w '\n%{http_code}\n' -X POST "$BASE/sessions/${SID}/games/${GAME_ID}/actions" -H 'content-type: application/json' -d '{"action":"ACTION1","data":{}}')
```

Result:

- `ACTION1` request returned `200`.

Interpretation:

- route exists and works; not a missing route mount.

### 3.2 Control: send lowercase action token

Command:

```bash
curl -sS -w '\n%{http_code}\n' \
  -X POST "http://127.0.0.1:5173/api/apps/arc-agi/sessions/${SID}/games/${GAME_ID}/actions" \
  -H 'content-type: application/json' \
  -d '{"action":"up","data":{}}'
```

Result:

- returns `404` with backend error payload mentioning upstream `/api/cmd/UP`.

Interpretation:

- failure tied to action token mapping, not endpoint existence.

## Phase 4: code archaeology (frontend + backend + host)

### 4.1 Locate demo button action payload source

Command:

```bash
nl -ba go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts | sed -n '1,320p'
```

Findings:

1. Up/Down/Left/Right are emitted as lowercase words (`up/down/left/right`) lines `92-95`.
2. `doAction` forwards `{ action: { action } }` without canonical mapping lines `180-195`.

### 4.2 Trace HyperCard pending intent bridge path

Command:

```bash
nl -ba go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx | sed -n '1,427p'
```

Findings:

1. pending `arc command.request` intents are dequeued and executed.
2. `perform-action` posts action object as-is to `/api/apps/arc-agi/.../actions` lines `230-237`.

### 4.3 Trace backend action normalization and upstream URL

Commands:

```bash
nl -ba go-go-app-arc-agi-3/pkg/backendmodule/routes.go | sed -n '1,340p'
nl -ba go-go-app-arc-agi-3/pkg/backendmodule/client.go | sed -n '1,320p'
```

Findings:

1. action route exists and is matched for POST `/sessions/.../games/.../actions` (`routes.go:152-159`).
2. backend normalizes action using `normalizeActionName` (`routes.go:222`).
3. `normalizeActionName` only maps canonical or numeric forms (`client.go:210-220`).
4. client calls upstream `/api/cmd/<actionName>` (`client.go:143`).
5. therefore `up` becomes `UP` and calls `/api/cmd/UP` (404 upstream).

### 4.4 Confirm integration wiring in wesen-os

Commands:

```bash
nl -ba wesen-os/apps/os-launcher/src/app/modules.tsx | sed -n '1,220p'
nl -ba wesen-os/cmd/wesen-os-launcher/main.go | sed -n '227,299p'
nl -ba go-go-os/go-go-os/pkg/backendhost/routes.go | sed -n '37,56p'
```

Findings:

1. ARC launcher module included in launcher module list.
2. ARC backend module mounted under namespaced path using backend host utility.
3. namespaced route prefix confirmed as `/api/apps/arc-agi`.

## Phase 5: create programmatic repro artifact

### 5.1 Add script for repeatable repro

Created file:

- `scripts/repro_arc_demo_up_404.sh`

Behavior:

1. create session
2. pick game
3. reset
4. send lowercase `up`
5. send control `ACTION1`
6. print statuses and compact payload slices

Execution output (key lines):

- lowercase `up` -> `status=404`
- canonical `ACTION1` -> `status=200`

This script is now the fastest non-UI repro.

## Phase 6: documentation authoring

Prepared:

1. detailed design doc with architecture map, root cause, remediation plan, and intern tutorial.
2. this diary with command-by-command chronology and failed-attempt notes.

## Phase 7: implement fix, validate in tests, and validate against live tmux services

### 7.1 Implement frontend canonical action mapping

File changed:

- `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts`

Update:

1. added `canonicalAction(raw)` helper to map directional aliases:
   - `up -> ACTION1`
   - `down -> ACTION2`
   - `left -> ACTION3`
   - `right -> ACTION4`
2. kept support for numeric aliases (`1..7`) and canonical passthrough (`ACTION1..ACTION7`).
3. updated `doAction` to dispatch canonical action token.

### 7.2 Implement backend defensive alias normalization

File changed:

- `go-go-app-arc-agi-3/pkg/backendmodule/client.go`

Update:

1. extended `normalizeActionName` to normalize directional aliases:
   - `UP -> ACTION1`
   - `DOWN -> ACTION2`
   - `LEFT -> ACTION3`
   - `RIGHT -> ACTION4`

### 7.3 Add backend tests for normalization and request path

File changed:

- `go-go-app-arc-agi-3/pkg/backendmodule/client_test.go`

Added tests:

1. `TestNormalizeActionName_DirectionalAliases`
2. `TestHTTPArcAPIClientAction_UsesCanonicalDirectionalAlias`

Validation command:

```bash
cd /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-app-arc-agi-3
go test ./pkg/backendmodule
```

Result:

- pass: `ok .../pkg/backendmodule`.

### 7.4 Validate fix against live tmux runtime

Observed first run (before backend restart):

- repro script still returned `404` for lowercase `up` because running wesen-os backend process was using old code.

Action:

1. restarted wesen-os backend tmux pane (`wesen-dev-192238:1.0`) with the same `go run ./cmd/wesen-os-launcher ...` command.
2. confirmed listeners:
   - `127.0.0.1:8091` (`wesen-os-launcher`)
   - `127.0.0.1:18181` (ARC raw Python server)

Validation command (same script artifact):

```bash
bash /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/scripts/repro_arc_demo_up_404.sh
```

Result after restart:

1. lowercase `up` request returned `status=200`
2. payload action shows canonicalized `"action": "ACTION1"`
3. control `ACTION1` request returned `status=200`

Conclusion:

- original failure mode (`/api/cmd/UP` -> 404) is no longer reproducible on patched code.
- directional alias input now safely converges to canonical ARC command tokens.

### 7.5 Commit fix in app repository

Repository:

- `go-go-app-arc-agi-3`

Commit:

- `dea7c2c` — `Normalize directional ARC actions to canonical ACTION tokens`

Committed files:

1. `apps/arc-agi-player/src/domain/pluginBundle.ts`
2. `pkg/backendmodule/client.go`
3. `pkg/backendmodule/client_test.go`

## Quick reference

### Repro commands

1. UI repro: open HyperCard demo stack, run sequence, click `Up`.
2. Script repro:

```bash
./scripts/repro_arc_demo_up_404.sh
```

### Key root-cause files

1. `go-go-app-arc-agi-3/apps/arc-agi-player/src/domain/pluginBundle.ts`
2. `go-go-app-arc-agi-3/apps/arc-agi-player/src/bridge/ArcPendingIntentEffectHost.tsx`
3. `go-go-app-arc-agi-3/pkg/backendmodule/client.go`
4. `go-go-app-arc-agi-3/pkg/backendmodule/routes.go`

### Most likely fix direction

1. frontend: canonicalize directional actions to `ACTION1..ACTION4`.
2. backend: optionally add `UP/DOWN/LEFT/RIGHT` aliases to normalization.

## Usage examples

### Validate regression check (post-fix behavior)

```bash
BASE_URL=http://127.0.0.1:5173/api/apps/arc-agi ./scripts/repro_arc_demo_up_404.sh
```

Expected fixed behavior:

1. lowercase `up` branch prints status 200 and action `ACTION1`.
2. control `ACTION1` branch prints status 200.
3. if lowercase `up` returns 404, restart tmux backend and re-check deployed code revision.

## Related

1. Design doc: `design-doc/01-arc-agi-hypercard-vm-stack-architecture-and-up-key-404-investigation.md`
2. Repro script: `scripts/repro_arc_demo_up_404.sh`
