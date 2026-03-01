# Changelog

## 2026-02-28

- Created GEPA-24 ticket workspace with design doc + investigation diary scaffolding.
- Reproduced UI bug path in running wesen-os launcher (`Create Session` -> `Load Games` -> select game -> `Reset Game` -> `Up` -> `404`).
- Captured failing network endpoint (`POST /api/apps/arc-agi/sessions/{sid}/games/{gid}/actions`) and validated upstream error propagation.
- Isolated root cause with control API tests: lowercase `up` fails (`/api/cmd/UP` 404) while canonical `ACTION1` succeeds (`200`).
- Completed end-to-end architecture mapping across `go-go-os`, `go-go-app-arc-agi-3`, and `wesen-os` integration host.
- Authored intern-oriented architecture + debugging guide with remediation plan and risk analysis.
- Added programmatic reproduction script: `scripts/repro_arc_demo_up_404.sh`.

## 2026-02-28

Completed bug reproduction, architecture tracing, intern guide, and programmatic repro script for HyperCard Up-key 404.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/design-doc/01-arc-agi-hypercard-vm-stack-architecture-and-up-key-404-investigation.md — Primary architecture and bug analysis document
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/reference/01-investigation-diary-hypercard-arc-agi-up-key-404.md — Chronological evidence and command log
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/scripts/repro_arc_demo_up_404.sh — Programmatic bug reproduction script


## 2026-02-28

Completed ticket bookkeeping/validation: related file links refreshed, doctor passed cleanly, and final research bundle uploaded to reMarkable with remote verification.

### Related Files

- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/changelog.md — Delivery and validation milestones recorded
- /home/manuel/workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/tasks.md — Task checklist updated to complete

## 2026-02-28

Implemented fix for HyperCard directional-action 404:

1. frontend canonicalization in `pluginBundle.ts` (`up/down/left/right` -> `ACTION1..ACTION4`)
2. backend normalization aliases in `client.go` as defensive compatibility layer
3. backend tests in `client_test.go` validating normalization and upstream request path generation
4. live tmux validation via repro script confirms lowercase `up` now returns `200` and action `ACTION1`
5. code committed in `go-go-app-arc-agi-3` as `dea7c2c`

## 2026-02-28

Cleanup: all ticket tasks complete; closing ticket.

