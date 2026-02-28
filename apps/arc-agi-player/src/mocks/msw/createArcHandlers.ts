import { HttpResponse, http } from 'msw';
import type { FrameEnvelope, GameSummary } from '../../domain/types';
import { makeCheckerboardFrame } from '../fixtures/games';

export interface ArcHandlerData {
  games: GameSummary[];
  initialFrame?: number[][];
  gridSize?: number;
}

export interface CreateArcHandlersOptions {
  data?: Partial<ArcHandlerData>;
  delayMs?: number;
}

interface MockSession {
  gameId: string | null;
  guid: string;
  actionCount: number;
  frame: number[][];
  levelsCompleted: number;
  state: string;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let nextSessionCounter = 1;

export function createArcHandlers(options: CreateArcHandlersOptions = {}) {
  const { data = {}, delayMs = 0 } = options;
  const gridSize = data.gridSize ?? 16;
  const games = data.games ?? [
    { game_id: 'bt11-fd9df0622a1a', name: 'bt11' },
    { game_id: 'vc33-9851e02b', name: 'vc33' },
    { game_id: 'ft09-9ab2447a', name: 'ft09' },
    { game_id: 'ls20-cb3b57cc', name: 'ls20' },
  ];
  const baseFrame = data.initialFrame ?? makeCheckerboardFrame(gridSize, gridSize);

  const sessions = new Map<string, MockSession>();
  const events = new Map<string, { seq: number; type: string; summary: string; ts: string }[]>();

  function appendEvent(sessionId: string, type: string, summary: string) {
    if (!events.has(sessionId)) events.set(sessionId, []);
    const list = events.get(sessionId)!;
    list.push({ seq: list.length + 1, type, summary, ts: new Date().toISOString() });
  }

  function mutateFrame(frame: number[][]): number[][] {
    return frame.map((row, r) => row.map((cell, c) => (cell + r + c + 1) % 10));
  }

  return [
    // Health
    http.get('/api/apps/arc-agi/health', async () => {
      if (delayMs > 0) await wait(delayMs);
      return HttpResponse.json({ status: 'ok' });
    }),

    // List games
    http.get('/api/apps/arc-agi/games', async () => {
      if (delayMs > 0) await wait(delayMs);
      return HttpResponse.json({ games });
    }),

    // Get game
    http.get('/api/apps/arc-agi/games/:gameId', async ({ params }) => {
      if (delayMs > 0) await wait(delayMs);
      const gameId = String(params.gameId);
      const game = games.find((g) => g.game_id === gameId);
      if (!game) return HttpResponse.json({ error: { message: 'game not found' } }, { status: 404 });
      return HttpResponse.json(game);
    }),

    // Create session
    http.post('/api/apps/arc-agi/sessions', async () => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = `s-mock-${nextSessionCounter++}`;
      sessions.set(sessionId, {
        gameId: null,
        guid: '',
        actionCount: 0,
        frame: [],
        levelsCompleted: 0,
        state: 'IDLE',
      });
      appendEvent(sessionId, 'arc.session.opened', 'Session opened');
      return HttpResponse.json({ session_id: sessionId });
    }),

    // Get session
    http.get('/api/apps/arc-agi/sessions/:sessionId', async ({ params }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      const session = sessions.get(sessionId);
      if (!session) return HttpResponse.json({ error: { message: 'session not found' } }, { status: 404 });
      return HttpResponse.json({ session_id: sessionId, status: 'active', game_id: session.gameId });
    }),

    // Close session
    http.delete('/api/apps/arc-agi/sessions/:sessionId', async ({ params }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      sessions.delete(sessionId);
      appendEvent(sessionId, 'arc.session.closed', 'Session closed');
      return HttpResponse.json({ session_id: sessionId, status: 'closed' });
    }),

    // Reset game
    http.post('/api/apps/arc-agi/sessions/:sessionId/games/:gameId/reset', async ({ params }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      const gameId = String(params.gameId);
      const session = sessions.get(sessionId);
      if (!session) return HttpResponse.json({ error: { message: 'session not found' } }, { status: 404 });

      session.gameId = gameId;
      session.guid = `guid-${Date.now()}`;
      session.actionCount = 0;
      session.frame = baseFrame.map((row) => [...row]);
      session.levelsCompleted = 0;
      session.state = 'RUNNING';
      appendEvent(sessionId, 'arc.game.reset', `${gameId} reset`);

      const envelope: FrameEnvelope = {
        session_id: sessionId,
        game_id: gameId,
        guid: session.guid,
        state: 'RUNNING',
        levels_completed: 0,
        win_levels: [2],
        available_actions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
        frame: session.frame,
      };
      return HttpResponse.json(envelope);
    }),

    // Perform action
    http.post('/api/apps/arc-agi/sessions/:sessionId/games/:gameId/actions', async ({ params, request }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      const gameId = String(params.gameId);
      const session = sessions.get(sessionId);
      if (!session) return HttpResponse.json({ error: { message: 'session not found' } }, { status: 404 });

      const body = (await request.json()) as { action: string; data?: Record<string, unknown> };
      session.actionCount += 1;
      session.frame = mutateFrame(session.frame);
      session.guid = `guid-${Date.now()}`;

      // Simulate win after 10 actions
      if (session.actionCount >= 10 && session.levelsCompleted < 1) {
        session.levelsCompleted = 1;
      }
      if (session.actionCount >= 20) {
        session.levelsCompleted = 2;
        session.state = 'WON';
      }

      appendEvent(sessionId, 'arc.action.completed', `${body.action} completed`);

      const envelope: FrameEnvelope = {
        session_id: sessionId,
        game_id: gameId,
        guid: session.guid,
        state: session.state as FrameEnvelope['state'],
        levels_completed: session.levelsCompleted,
        win_levels: [2],
        available_actions:
          session.state === 'WON' ? [] : ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
        frame: session.frame,
        action: { id: body.action, data: body.data },
      };
      return HttpResponse.json(envelope);
    }),

    // Get events
    http.get('/api/apps/arc-agi/sessions/:sessionId/events', async ({ params, request }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      const url = new URL(request.url);
      const afterSeq = Number.parseInt(url.searchParams.get('after_seq') ?? '0', 10);
      const list = (events.get(sessionId) ?? []).filter((e) => e.seq > afterSeq);
      return HttpResponse.json({ session_id: sessionId, events: list });
    }),

    // Timeline
    http.get('/api/apps/arc-agi/sessions/:sessionId/timeline', async ({ params }) => {
      if (delayMs > 0) await wait(delayMs);
      const sessionId = String(params.sessionId);
      const list = events.get(sessionId) ?? [];
      const counts: Record<string, number> = {};
      for (const e of list) {
        counts[e.type] = (counts[e.type] ?? 0) + 1;
      }
      return HttpResponse.json({
        session_id: sessionId,
        status: sessions.has(sessionId) ? 'active' : 'closed',
        counts,
        items: list.map((e) => ({ seq: e.seq, type: e.type, summary: e.summary })),
      });
    }),
  ];
}
