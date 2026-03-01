# Tasks

## Investigation

- [x] Reproduce the reported bug sequence in the running tmux environment
- [x] Capture failing request path/status and UI-visible error state
- [x] Verify whether failure is missing route vs payload/contract issue

## Architecture mapping

- [x] Trace HyperCard VM path in go-go-os runtime host and intent dispatch
- [x] Trace ARC demo card implementation in go-go-app-arc-agi-3
- [x] Trace backend route handling and upstream ARC runtime command mapping
- [x] Trace wesen-os module registration and `/api/apps/arc-agi` namespace mounting

## Deliverables

- [x] Write intern-focused long-form architecture and debugging guide (7+ pages)
- [x] Keep chronological investigation diary with commands/results/failures
- [x] Add programmatic repro script artifact under ticket scripts
- [x] Relate key files and update changelog entries via docmgr
- [x] Run `docmgr doctor --ticket GEPA-24-ARC-AGI-HYPERCARD-UP-404 --stale-after 30`
- [x] Upload final bundle to reMarkable (dry-run + real upload + remote listing verification)

## Fix implementation

- [x] Convert HyperCard demo directional button payloads to canonical ARC actions
- [x] Add backend alias normalization for directional action tokens (`up/down/left/right`)
- [x] Add backend tests for alias normalization behavior
- [x] Re-run repro script to confirm `up` no longer returns 404
- [x] Update investigation diary with fix/validation/commit details
