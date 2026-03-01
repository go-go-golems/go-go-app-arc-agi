# Tasks

## Phase 0 - Ticket Setup

- [x] `GEPA13-01` Create ticket workspace.
- [x] `GEPA13-02` Write design doc.

## Phase 1 - Package Scaffold

- [x] `GEPA13-10` Create `go-go-os/apps/arc-agi-player/` package: `package.json`, `tsconfig.json`, `src/index.ts`.
- [x] `GEPA13-11` Wire into root `tsconfig.json` references and `.storybook/main.ts` story glob.

## Phase 2 - Domain Types, RTK Query API, Redux Slice

- [x] `GEPA13-20` Write `src/domain/types.ts` (FrameEnvelope, ActionRequest, GameSummary, SessionEvent, etc.)
- [x] `GEPA13-21` Write `src/domain/palette.ts` (ARC 10-color hex palette + canvas helpers).
- [x] `GEPA13-22` Write `src/domain/actionLog.ts` (action glyph mapping).
- [x] `GEPA13-23` Write `src/api/arcApi.ts` (RTK Query endpoints).
- [x] `GEPA13-24` Write `src/features/arcPlayer/arcPlayerSlice.ts` (session state, action history, timer).
- [x] `GEPA13-25` Write `src/app/store.ts`.

## Phase 3 - MSW Mock Layer

- [x] `GEPA13-30` Write `src/mocks/fixtures/games.ts` (mock games, frames, action responses).
- [x] `GEPA13-31` Write `src/mocks/msw/createArcHandlers.ts` (stateful handler factory).
- [x] `GEPA13-32` Write `src/mocks/msw/defaultHandlers.ts`.

## Phase 4 - GameGrid Component + Stories

- [x] `GEPA13-40` Write `src/components/GameGrid.tsx` + `GameGrid.css`.
- [x] `GEPA13-41` Write `src/components/GameGrid.stories.tsx`.
- [x] `GEPA13-42` Verify stories render in Storybook.

## Phase 5 - ActionSidebar Component + Stories

- [x] `GEPA13-50` Write `src/components/ActionSidebar.tsx` + `ActionSidebar.css`.
- [x] `GEPA13-51` Write `src/components/ActionSidebar.stories.tsx`.
- [x] `GEPA13-52` Verify stories render in Storybook.

## Phase 6 - ActionLog Component + Stories

- [x] `GEPA13-60` Write `src/components/ActionLog.tsx` + `ActionLog.css`.
- [x] `GEPA13-61` Write `src/components/ActionLog.stories.tsx`.
- [x] `GEPA13-62` Verify stories render in Storybook.

## Phase 7 - ArcPlayerWindow + Full-App Stories

- [x] `GEPA13-70` Write `src/components/ArcPlayerWindow.tsx` + `ArcPlayerWindow.css`.
- [x] `GEPA13-71` Write `src/components/ArcPlayerWindow.stories.tsx`.
- [x] `GEPA13-72` Write `src/app/stories/ArcPlayerApp.stories.tsx`.
- [x] `GEPA13-73` Verify stories render in Storybook.

## Phase 8 - Launcher Module + Final Validation

- [x] `GEPA13-80` Write `src/launcher/module.tsx`.
- [x] `GEPA13-81` Write `src/launcher/public.ts`.
- [x] `GEPA13-82` Run `tsc --build` — passes clean.
- [x] `GEPA13-83` Run `biome check` — passes clean.
- [x] `GEPA13-84` Run Storybook build — passes clean.
