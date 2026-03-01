# Tasks

## Boundary Decision (Clean Split)

- [x] 0.1 Confirm GEPA-23 implementation kickoff
- [x] 0.2 Confirm hard split decision: ARC domain code belongs in `go-go-app-arc-agi-3`
- [x] 0.3 Confirm engine should remain ARC-agnostic runtime infrastructure
- [x] 0.4 Update implementation plan to reflect split ownership

## Engine Guardrail Work (`go-go-os`)

- [x] 1.1 Revert ARC-specific bridge reducers/contracts from shared engine package
- [x] 1.2 Keep generic runtime routing path intact
- [x] 1.3 Add generic runtime metadata propagation (`runtimeSessionId`, `windowId`) to emitted domain actions
- [x] 1.4 Keep/extend routing test coverage for canonical domain action emission
- [x] 1.5 Commit engine boundary cleanup

## ARC Bridge Core (`go-go-app-arc-agi-3`)

- [x] 2.1 Add ARC bridge contract types (`ArcCommandOp`, payloads, state records)
- [x] 2.2 Add ARC bridge lifecycle actions (`request/started/succeeded/failed`)
- [x] 2.3 Add ARC session snapshot upsert action
- [x] 2.4 Add ARC game snapshot upsert action
- [x] 2.5 Add ARC bridge reducer with lifecycle transitions
- [x] 2.6 Add command retention policy and recent error ring buffer
- [x] 2.7 Add ARC bridge selectors (latest by runtime session, pending, error)
- [x] 2.8 Add payload validation helper for malformed requests

## ARC Bridge Middleware (`go-go-app-arc-agi-3`)

- [x] 3.1 Add middleware skeleton for `arc/command.request`
- [x] 3.2 Add request validation guard path
- [x] 3.3 Add capability gate for plugin-runtime source (`domain: arc`)
- [x] 3.4 Map `create-session` to `/api/apps/arc-agi/sessions`
- [x] 3.5 Map `reset-game` to `/api/apps/arc-agi/sessions/:sessionId/games/:gameId/reset`
- [x] 3.6 Map `perform-action` to `/api/apps/arc-agi/sessions/:sessionId/games/:gameId/actions`
- [x] 3.7 Map `load-timeline` to `/api/apps/arc-agi/sessions/:sessionId/timeline`
- [x] 3.8 Map `load-events` to `/api/apps/arc-agi/sessions/:sessionId/events`
- [x] 3.9 Dispatch started/succeeded/failed lifecycle actions
- [x] 3.10 Upsert session/game snapshots when response data is available
- [x] 3.11 Add requestId dedupe guard for in-flight/already-succeeded commands
- [x] 3.12 Mirror bridge status into runtime session state via `ingestRuntimeIntent(session.patch)`
- [x] 3.13 Emit toast on failure/denial for quick operator feedback

## ARC Store Integration (`go-go-app-arc-agi-3`)

- [x] 4.1 Register `arcBridge` reducer in ARC app store
- [x] 4.2 Register ARC bridge middleware before RTK Query middleware
- [x] 4.3 Export bridge API from app barrel for reuse

## Demo HyperCard Stack

- [x] 5.1 Add ARC demo VM bundle with command dispatch handlers
- [x] 5.2 Add ARC demo stack definition with plugin capabilities (`domain: arc`, `system: notify`)
- [x] 5.3 Implement handlers for create-session/reset/perform-action/load-timeline
- [x] 5.4 Add request id generation in card handlers
- [x] 5.5 Render status/session/game/error text in card UI
- [x] 5.6 Add demo-card game selection controls (input + quick picks) and explicit precondition messaging
- [x] 5.7 Replace hardcoded game IDs with dynamic list loading from `/api/apps/arc-agi/games`

## Launcher UX Requirement

- [x] 6.1 Change icon launch target to ARC folder window
- [x] 6.2 Add folder UI that exposes both entrypoints:
- [x] 6.3 Add button to open current React ARC game window
- [x] 6.4 Add button to open HyperCard demo stack window
- [x] 6.5 Keep game window adapter support for `arc-agi-player:main` and `arc-agi-player:game:*`
- [x] 6.6 Add dedicated card window adapter for ARC demo stack
- [x] 6.7 Commit ARC app implementation phase

## Validation

- [x] 7.1 Run targeted launcher-host test suite: `npm run test -w apps/os-launcher -- launcherHost`
- [x] 7.2 Fix launcher-card runtime intent execution gap (pending queue consumed but no ARC side-effect host mounted)
- [ ] 7.3 Add ARC bridge middleware unit tests in ARC repo (mocked fetch)
- [ ] 7.4 Run ARC manual smoke: icon -> folder -> React game window opens
- [ ] 7.5 Run ARC manual smoke: icon -> folder -> HyperCard demo window opens
- [ ] 7.6 Run ARC manual smoke: demo card create-session updates status
- [ ] 7.7 Run ARC manual smoke: demo card action/reset commands complete end-to-end

## Documentation and Handoff

- [x] 8.1 Update implementation plan with clean split decision
- [x] 8.2 Update task list statuses to reflect completed work and remaining validation
- [x] 8.3 Add detailed implementation diary with commands, failures, fixes, and commit IDs
- [ ] 8.4 Update GEPA-14 cross-reference note with final ownership decision
- [ ] 8.5 Update changelog with manual smoke evidence and closure note
