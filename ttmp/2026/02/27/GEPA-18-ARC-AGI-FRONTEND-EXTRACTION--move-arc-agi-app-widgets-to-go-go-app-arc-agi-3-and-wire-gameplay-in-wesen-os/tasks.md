# Tasks

## TODO

- [x] Create GEPA-18 ticket workspace and add design-doc + investigation diary documents.
- [x] Perform pre-research sweep across `go-go-os`, `go-go-app-arc-agi-3`, and `wesen-os` to map ARC frontend/backend integration points and API contracts.
- [x] Author detailed pre-research design document and chronological diary in ticket docs.
- [x] Upload pre-research document bundle to reMarkable (dry-run + upload).
- [x] Move `go-go-os/apps/arc-agi-player` into `go-go-app-arc-agi-3/apps/` using `mv` and preserve package exports/layout.
- [x] Update `go-go-os/tsconfig.json` to remove stale ARC app project reference after move.
- [x] Update `wesen-os` launcher module registry to mount `arcPlayerLauncherModule`.
- [x] Add ARC path aliases in `wesen-os/apps/os-launcher/{tsconfig.json,vite.config.ts,vitest.config.ts}` pointing to `go-go-app-arc-agi-3/apps/arc-agi-player`.
- [x] Update/extend `wesen-os` launcher tests to include ARC module expectations and source path assertions.
- [x] Run frontend checks in `wesen-os` (`typecheck`, targeted tests) and resolve any alias/import regressions.
- [x] Run backend+frontend smoke validation for ARC gameplay flow (`games -> session -> reset -> action -> events -> timeline`).
- [x] Update GEPA-18 diary/changelog with implementation and validation evidence for each completed task.
- [x] Commit changes task-by-task with focused commit messages across affected repos.
