---
Title: 'ARC-AGI Player Widget Design'
Ticket: GEPA-13-ARC-AGI-WIDGET
Status: active
Topics:
    - frontend
    - arc-agi
    - go-go-os
    - storybook
DocType: design
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/src/launcher/module.tsx
      Note: LaunchableAppModule export and window content adapter
    - Path: ../../../../../../../go-go-os/apps/arc-agi-player/src/launcher/public.ts
      Note: Public exports for launcher integration
    - Path: ../../../../../../../go-go-app-arc-agi-3/pkg/backendmodule/routes.go
      Note: Backend API route handlers
    - Path: ../../../../../../../go-go-app-arc-agi-3/pkg/backendmodule/client.go
      Note: ARC HTTP proxy client with action/reset/session endpoints
    - Path: ../../../../../../../go-go-os/apps/apps-browser/src/launcher/module.tsx
      Note: Reference implementation for self-contained RTK Query widget pattern
ExternalSources: []
Summary: Design and implementation plan for the ARC-AGI game controller widget — a single-screen game player with grid, controls, and action log.
LastUpdated: 2026-02-27
WhatFor: Build an interactive game controller widget for ARC-AGI games inside the go-go-os desktop environment.
WhenToUse: When implementing, reviewing, or extending the ARC-AGI player widget.
---


# ARC-AGI Player Widget Design

## Overview

A single-screen game controller widget for playing ARC-AGI games from the go-go-os desktop.
The widget renders any ARC game into a uniform 3-zone layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ ● ○ ○          ARC-AGI-3            Level 4/10       ◷ 01:42   │
├─────────────────────────────────────────────┬───────────────────┤
│                                             │                   │
│                                             │  Actions: 23      │
│                                             │                   │
│                                             │  ┌─────┐          │
│                                             │  │  ▲  │          │
│                                             │  ├─────┤          │
│           64 × 64 GAME GRID                │  │◄   ►│          │
│                                             │  ├─────┤          │
│          (rendered from server)             │  │  ▼  │          │
│                                             │  └─────┘          │
│                                             │                   │
│                                             │  [A5] [A6]        │
│                                             │                   │
│                                             │  [Undo]           │
│                                             │  [Reset]          │
│                                             │                   │
│                                             │ ─────────────     │
│                                             │  Score: 74%       │
│                                             │  ██████░░░░       │
│                                             │                   │
├─────────────────────────────────────────────┴───────────────────┤
│ ▲ ▲ ► ► A5 ► ▲ ◄ ◄ A5 ▼ ► ► ▲ ▲ ► A6(4,7) ▼ ▼ ► A5 ▲ ► ►   │
└─────────────────────────────────────────────────────────────────┘
```

**Left zone**: 64x64 game grid rendered on a `<canvas>` element from the server's frame data (2D integer array of cell colors).

**Right sidebar**: Action counter, directional d-pad (ACTION1=up, ACTION2=down, ACTION3=left, ACTION4=right), two generic action buttons (A5, A6), undo/reset controls, and a score progress bar.

**Bottom strip**: Scrolling action log showing the history of actions as compact glyphs.

Generic enough for agentic movement (ls20), cell-clicking (ft09), and column manipulation (vc33) — the grid changes, the chrome stays the same.


## Backend Endpoints Consumed

All endpoints are served by the ARC-AGI backend module at `/api/apps/arc-agi/`.

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| `GET` | `/api/apps/arc-agi/health` | — | `{ "status": "ok" }` | Health check |
| `GET` | `/api/apps/arc-agi/games` | — | `{ "games": GameSummary[] }` | List available games |
| `GET` | `/api/apps/arc-agi/games/:gameId` | — | `GameDetails` | Game metadata |
| `POST` | `/api/apps/arc-agi/sessions` | `{ source_url?, tags?, opaque? }` | `{ "session_id": "s-123" }` | Open session (scorecard) |
| `GET` | `/api/apps/arc-agi/sessions/:sessionId` | — | `SessionState` | Session state |
| `DELETE` | `/api/apps/arc-agi/sessions/:sessionId` | — | `SessionSummary` | Close session |
| `POST` | `/api/apps/arc-agi/sessions/:sid/games/:gid/reset` | `{}` | `FrameEnvelope` | Reset game (get initial frame + guid) |
| `POST` | `/api/apps/arc-agi/sessions/:sid/games/:gid/actions` | `ActionRequest` | `FrameEnvelope` | Perform action, get new frame |
| `GET` | `/api/apps/arc-agi/sessions/:sid/events?after_seq=N` | — | `EventsResponse` | Poll session events |
| `GET` | `/api/apps/arc-agi/sessions/:sid/timeline` | — | `TimelineResponse` | Aggregated timeline |


## Data Model

### FrameEnvelope (core game state — returned by reset and action)

```typescript
interface FrameEnvelope {
  session_id: string;
  game_id: string;
  guid: string;                     // environment instance ID
  state: 'RUNNING' | 'WON' | 'LOST' | 'IDLE';
  levels_completed: number;
  win_levels: number[];             // levels needed to win
  available_actions: string[];      // e.g. ["ACTION1", "ACTION3", "ACTION6"]
  frame: number[][];                // 2D grid — row-major, integer cell colors
  action?: {                        // present on action responses (not reset)
    id: string;
    data?: Record<string, unknown>;
  };
}
```

### ActionRequest

```typescript
interface ActionRequest {
  action: string;                   // "ACTION1" through "ACTION7"
  data?: Record<string, unknown>;   // e.g. { x: 12, y: 41 } for cell clicks
  reasoning?: unknown;              // optional agent reasoning
}
```

### GameSummary

```typescript
interface GameSummary {
  game_id: string;                  // e.g. "bt11-fd9df0622a1a"
  name?: string;
}
```

### SessionEvent

```typescript
interface SessionEvent {
  seq: number;
  ts: string;                       // ISO timestamp
  session_id: string;
  game_id?: string;
  type: string;                     // "arc.action.completed", "arc.game.reset", etc.
  summary?: string;
  payload?: Record<string, unknown>;
}
```

### Color Palette

ARC-AGI uses a standard 10-color palette (indices 0-9):

| Index | Color | Hex |
|-------|-------|-----|
| 0 | Black (background) | `#000000` |
| 1 | Blue | `#1E93FF` |
| 2 | Red | `#F93C31` |
| 3 | Green | `#4FCC30` |
| 4 | Yellow | `#FFDC00` |
| 5 | Grey | `#999999` |
| 6 | Magenta | `#E53AA3` |
| 7 | Orange | `#FF851B` |
| 8 | Cyan | `#87CEEB` |
| 9 | Maroon | `#921224` |


## Component Architecture

### Package: `@hypercard/arc-agi-player`

Location: `go-go-os/apps/arc-agi-player/`

```
src/
├── index.ts                          # Public barrel exports
├── api/
│   └── arcApi.ts                     # RTK Query: sessions, games, actions, events
├── app/
│   ├── store.ts                      # Self-contained store with RTK Query middleware
│   └── stories/
│       └── ArcPlayerApp.stories.tsx  # Full-app stories
├── components/
│   ├── GameGrid.tsx + .css           # Canvas-rendered 64×64 game grid
│   ├── GameGrid.stories.tsx
│   ├── ActionSidebar.tsx + .css      # D-pad, A5/A6, undo/reset, score bar
│   ├── ActionSidebar.stories.tsx
│   ├── ActionLog.tsx + .css          # Bottom scrolling action history strip
│   ├── ActionLog.stories.tsx
│   ├── ArcPlayerWindow.tsx + .css    # Main window composing all 3 zones
│   └── ArcPlayerWindow.stories.tsx
├── domain/
│   ├── types.ts                      # FrameEnvelope, ActionRequest, GameSummary, etc.
│   ├── palette.ts                    # ARC 10-color hex palette + rendering helpers
│   └── actionLog.ts                  # Action glyph mapping (ACTION1→▲, etc.)
├── features/
│   └── arcPlayer/
│       └── arcPlayerSlice.ts         # Session state, action history, timer
├── launcher/
│   ├── module.tsx                    # LaunchableAppModule + window adapter
│   └── public.ts                     # Re-exports for @hypercard/arc-agi-player/launcher
└── mocks/
    ├── fixtures/
    │   └── games.ts                  # Mock games, frames, action responses
    └── msw/
        ├── createArcHandlers.ts      # MSW handler factory
        └── defaultHandlers.ts        # Default MSW wiring
```

### Store Pattern

Same self-contained pattern as apps-browser: own Redux store with RTK Query middleware, wrapped in a `<Provider>` by the launcher host. No shared reducers in the launcher store.

### RTK Query Endpoints

```typescript
const arcApi = createApi({
  reducerPath: 'arcApi',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  tagTypes: ['Games', 'Session', 'Frame', 'Events'],
  endpoints: (builder) => ({
    getGames:      builder.query<GameSummary[], void>(),
    getGame:       builder.query<GameDetails, string>(),
    createSession: builder.mutation<{ session_id: string }, CreateSessionRequest>(),
    getSession:    builder.query<SessionState, string>(),
    closeSession:  builder.mutation<SessionSummary, string>(),
    resetGame:     builder.mutation<FrameEnvelope, { sessionId: string; gameId: string }>(),
    performAction: builder.mutation<FrameEnvelope, { sessionId: string; gameId: string; action: ActionRequest }>(),
    getEvents:     builder.query<EventsResponse, { sessionId: string; afterSeq?: number }>(),
    getTimeline:   builder.query<TimelineResponse, string>(),
  }),
});
```

### Redux Slice: `arcPlayerSlice`

Local UI state not covered by RTK Query cache:

```typescript
interface ArcPlayerState {
  sessionId: string | null;
  gameId: string | null;
  currentFrame: FrameEnvelope | null;
  actionHistory: ActionLogEntry[];  // for bottom strip
  actionCount: number;
  elapsedSeconds: number;
  status: 'idle' | 'loading' | 'playing' | 'won' | 'lost';
}
```

Reducers: `setSession`, `setFrame`, `pushAction`, `incrementTimer`, `resetState`.


## Component Details

### GameGrid

- Renders `frame: number[][]` onto a `<canvas>` element.
- Grid cells are drawn as filled squares using the ARC 10-color palette.
- Canvas size is fixed at a CSS width (e.g., 480px) but the grid dimensions come from the frame data (typically up to 30x30 for ARC, rendered onto the 64x64 logical grid area).
- Supports click events: translates canvas pixel coordinates back to grid cell coordinates, useful for cell-clicking game types (ft09).
- Props: `frame`, `gridWidth`, `gridHeight`, `onCellClick?`.
- Uses `useEffect` + `useRef` for canvas rendering.

### ActionSidebar

- **Action counter**: displays `actionCount` from slice.
- **D-pad**: 4 directional buttons mapped to ACTION1 (up), ACTION2 (down), ACTION3 (left), ACTION4 (right). Disabled when action not in `available_actions`.
- **A5/A6 buttons**: Generic action buttons for ACTION5 and ACTION6. A6 can pass cell coordinates via `data` field.
- **Undo**: Calls reset and replays all actions except the last (client-side undo via action history).
- **Reset**: Calls `/reset` endpoint to restart the game.
- **Score bar**: Visual progress bar showing `levels_completed / max(win_levels)`.
- All action buttons dispatch `performAction` mutation.

### ActionLog

- Horizontal scrolling strip at the bottom.
- Each action is rendered as a compact glyph: `▲` `▼` `◄` `►` `A5` `A6` `A7`.
- Cell-click actions show coordinates: `A6(4,7)`.
- Auto-scrolls to the rightmost (latest) entry.
- Source: `actionHistory` from arcPlayerSlice.

### ArcPlayerWindow

- Composes all three zones in a CSS grid layout.
- Title bar content: game name, level progress, elapsed timer.
- Lifecycle:
  1. On mount: `createSession` mutation.
  2. User selects game or game is provided via appKey.
  3. `resetGame` mutation to get initial frame.
  4. User interacts via sidebar controls.
  5. Each action: `performAction` mutation -> update frame + push to action log.
  6. On unmount: `closeSession` mutation.


## MSW Mock Strategy

### Stateful Mock Server

Unlike apps-browser (stateless GET endpoints), the ARC widget needs **stateful mocking** — actions change the frame, actions accumulate in event history. The MSW handler factory maintains in-memory state:

```typescript
interface MockArcState {
  sessions: Map<string, { gameId: string | null; guid: string; actionCount: number }>;
  nextSessionId: number;
}
```

The mock handler:
- `POST /sessions`: creates a session entry, returns session_id.
- `POST /reset`: returns a mock initial frame (e.g., checkerboard pattern).
- `POST /actions`: returns a slightly mutated frame (shift pattern), increments action count.
- `GET /events`: returns accumulated mock events.

### Mock Frame Data

Three mock frame generators for stories:
1. **Checkerboard**: alternating 0/1 cells — clean visual for default state.
2. **Gradient**: left-to-right color sweep — shows all 10 palette colors.
3. **Scattered**: random cells — simulates mid-game state.

### Storybook Stories

| Story | State | Description |
|-------|-------|-------------|
| `Idle` | No game loaded | Session created, no frame yet |
| `Playing` | Mid-game | Frame rendered, actions available, some history |
| `ManyActions` | 50+ actions | Long action log demonstrating scroll |
| `Won` | Game won | Win state, score bar full |
| `Lost` | Game lost | Lost state with error display |
| `Loading` | Fetching frame | Spinner/skeleton state |
| `CellClick` | A6 with coordinates | Demonstrates click-to-act pattern |


## CSS Theming

All components use `data-part` selectors scoped under `[data-widget="hypercard"]`, following the go-go-os convention:

```css
[data-widget="hypercard"] [data-part="arc-game-grid"] { ... }
[data-widget="hypercard"] [data-part="arc-sidebar"] { ... }
[data-widget="hypercard"] [data-part="arc-action-log"] { ... }
[data-widget="hypercard"] [data-part="arc-dpad-button"] { ... }
[data-widget="hypercard"] [data-part="arc-dpad-button"][data-state="disabled"] { ... }
[data-widget="hypercard"] [data-part="arc-score-bar"] { ... }
[data-widget="hypercard"] [data-part="arc-score-fill"] { ... }
```


## Launcher Module

### Registration

```typescript
export const arcPlayerLauncherModule: LaunchableAppModule = {
  manifest: {
    id: 'arc-agi-player',
    name: 'ARC-AGI',
    icon: '🎮',
    launch: { mode: 'window' },
    desktop: { order: 80 },
  },
  buildLaunchWindow: (_ctx, reason) => buildArcPlayerWindowPayload(reason),
  createContributions: () => [{ id: 'arc-agi-player.window-adapters', windowContentAdapters: [createArcPlayerAdapter()] }],
  renderWindow: ({ windowId }) => <ArcPlayerHost key={windowId}><ArcPlayerWindow /></ArcPlayerHost>,
};
```

### Window Content Routing

| appKey pattern | Window rendered |
|----------------|-----------------|
| `arc-agi-player:main` | `ArcPlayerWindow` (no game pre-selected) |
| `arc-agi-player:game:bt11` | `ArcPlayerWindow` (pre-selects game bt11) |


## Implementation Phases

### Phase 1: Package Scaffold
- Create `go-go-os/apps/arc-agi-player/` with package.json, tsconfig.json, src/index.ts.
- Wire into root tsconfig references and storybook config.

### Phase 2: Domain Types + RTK Query + Redux Slice
- `domain/types.ts`, `domain/palette.ts`, `domain/actionLog.ts`
- `api/arcApi.ts` with all endpoints
- `features/arcPlayer/arcPlayerSlice.ts`
- `app/store.ts`

### Phase 3: MSW Mock Layer
- `mocks/fixtures/games.ts` with mock frames and game data
- `mocks/msw/createArcHandlers.ts` (stateful handler factory)
- `mocks/msw/defaultHandlers.ts`

### Phase 4: GameGrid Component + Stories
- Canvas rendering with palette colors
- Click-to-cell coordinate mapping
- Stories: empty grid, checkerboard, gradient, scattered, click interaction

### Phase 5: ActionSidebar Component + Stories
- D-pad, A5/A6, undo, reset, score bar
- Disabled state handling based on available_actions
- Stories: all actions available, limited actions, high score, zero score

### Phase 6: ActionLog Component + Stories
- Glyph rendering, horizontal scroll, auto-scroll
- Stories: empty, few actions, many actions, with coordinates

### Phase 7: ArcPlayerWindow + Full-App Stories
- Compose all zones, wire session lifecycle
- MSW-backed stories for all game states

### Phase 8: Launcher Module + Final Validation
- module.tsx, public.ts
- tsc --build, biome check, storybook build
