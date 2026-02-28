import type { ActionLogEntry, FrameEnvelope, GameSummary, SessionEvent } from '../../domain/types';

// --- Games ---

export const MOCK_GAME_BT11: GameSummary = { game_id: 'bt11-fd9df0622a1a', name: 'bt11' };
export const MOCK_GAME_VC33: GameSummary = { game_id: 'vc33-9851e02b', name: 'vc33' };
export const MOCK_GAME_FT09: GameSummary = { game_id: 'ft09-9ab2447a', name: 'ft09' };
export const MOCK_GAME_LS20: GameSummary = { game_id: 'ls20-cb3b57cc', name: 'ls20' };

export const MOCK_GAMES: GameSummary[] = [MOCK_GAME_BT11, MOCK_GAME_VC33, MOCK_GAME_FT09, MOCK_GAME_LS20];

// --- Frame generators ---

/** Checkerboard pattern: alternating 0/1 cells. */
export function makeCheckerboardFrame(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r + c) % 2));
}

/** Gradient pattern: left-to-right color sweep using all 10 colors. */
export function makeGradientFrame(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, (_, c) => c % 10));
}

/** Scattered pattern: pseudo-random cells using a simple hash. */
export function makeScatteredFrame(rows: number, cols: number, seed = 42): number[][] {
  let s = seed;
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s % 10;
    }),
  );
}

/** Cross pattern: colored cross on black background. */
export function makeCrossFrame(rows: number, cols: number): number[][] {
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (r === midR) return 2; // red horizontal
      if (c === midC) return 1; // blue vertical
      return 0;
    }),
  );
}

// --- Mock frame envelopes ---

export const MOCK_INITIAL_FRAME: FrameEnvelope = {
  session_id: 's-mock-1',
  game_id: 'bt11-fd9df0622a1a',
  guid: 'guid-mock-001',
  state: 'RUNNING',
  levels_completed: 0,
  win_levels: [2],
  available_actions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
  frame: makeCheckerboardFrame(16, 16),
};

export const MOCK_MIDGAME_FRAME: FrameEnvelope = {
  session_id: 's-mock-1',
  game_id: 'bt11-fd9df0622a1a',
  guid: 'guid-mock-002',
  state: 'RUNNING',
  levels_completed: 1,
  win_levels: [2],
  available_actions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6'],
  frame: makeScatteredFrame(16, 16),
};

export const MOCK_WON_FRAME: FrameEnvelope = {
  session_id: 's-mock-1',
  game_id: 'bt11-fd9df0622a1a',
  guid: 'guid-mock-003',
  state: 'WON',
  levels_completed: 2,
  win_levels: [2],
  available_actions: [],
  frame: makeGradientFrame(16, 16),
};

export const MOCK_LARGE_FRAME: FrameEnvelope = {
  session_id: 's-mock-1',
  game_id: 'vc33-9851e02b',
  guid: 'guid-mock-004',
  state: 'RUNNING',
  levels_completed: 0,
  win_levels: [5],
  available_actions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7'],
  frame: makeCrossFrame(30, 30),
};

// --- Mock action history ---

export const MOCK_ACTION_HISTORY: ActionLogEntry[] = [
  { action: 'ACTION1', timestamp: 1000 },
  { action: 'ACTION1', timestamp: 1200 },
  { action: 'ACTION4', timestamp: 1400 },
  { action: 'ACTION4', timestamp: 1600 },
  { action: 'ACTION5', timestamp: 1800 },
  { action: 'ACTION4', timestamp: 2000 },
  { action: 'ACTION1', timestamp: 2200 },
  { action: 'ACTION3', timestamp: 2400 },
  { action: 'ACTION3', timestamp: 2600 },
  { action: 'ACTION5', timestamp: 2800 },
  { action: 'ACTION2', timestamp: 3000 },
  { action: 'ACTION4', timestamp: 3200 },
  { action: 'ACTION4', timestamp: 3400 },
  { action: 'ACTION1', timestamp: 3600 },
  { action: 'ACTION1', timestamp: 3800 },
  { action: 'ACTION4', timestamp: 4000 },
  { action: 'ACTION6', data: { x: 4, y: 7 }, timestamp: 4200 },
  { action: 'ACTION2', timestamp: 4400 },
  { action: 'ACTION2', timestamp: 4600 },
  { action: 'ACTION4', timestamp: 4800 },
  { action: 'ACTION5', timestamp: 5000 },
  { action: 'ACTION1', timestamp: 5200 },
  { action: 'ACTION4', timestamp: 5400 },
  { action: 'ACTION4', timestamp: 5600 },
];

export const MOCK_LONG_ACTION_HISTORY: ActionLogEntry[] = Array.from({ length: 60 }, (_, i) => ({
  action: `ACTION${(i % 4) + 1}`,
  timestamp: 1000 + i * 200,
}));

// --- Mock events ---

export const MOCK_EVENTS: SessionEvent[] = [
  { seq: 1, ts: '2026-02-27T10:00:00Z', session_id: 's-mock-1', type: 'arc.session.opened', summary: 'Session opened' },
  {
    seq: 2,
    ts: '2026-02-27T10:00:01Z',
    session_id: 's-mock-1',
    game_id: 'bt11-fd9df0622a1a',
    type: 'arc.game.reset',
    summary: 'bt11 reset',
  },
  {
    seq: 3,
    ts: '2026-02-27T10:00:05Z',
    session_id: 's-mock-1',
    game_id: 'bt11-fd9df0622a1a',
    type: 'arc.action.completed',
    summary: 'ACTION1 completed',
  },
  {
    seq: 4,
    ts: '2026-02-27T10:00:08Z',
    session_id: 's-mock-1',
    game_id: 'bt11-fd9df0622a1a',
    type: 'arc.action.completed',
    summary: 'ACTION4 completed',
  },
];
