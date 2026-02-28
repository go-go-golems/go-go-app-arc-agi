import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useCloseSessionMutation,
  useCreateSessionMutation,
  usePerformActionMutation,
  useResetGameMutation,
} from '../api/arcApi';
import type { AppDispatch, RootState } from '../app/store';
import type { ActionLogEntry } from '../domain/types';
import {
  clearHistory,
  incrementTimer,
  pushAction,
  setFrame,
  setSession,
  setStatus,
} from '../features/arcPlayer/arcPlayerSlice';
import { ActionLog } from './ActionLog';
import { ActionSidebar } from './ActionSidebar';
import './ArcPlayerWindow.css';
import { GameGrid } from './GameGrid';

export interface ArcPlayerWindowProps {
  initialGameId?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ArcPlayerWindow({ initialGameId }: ArcPlayerWindowProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { sessionId, gameId, currentFrame, actionHistory, actionCount, elapsedSeconds, status } = useSelector(
    (state: RootState) => state.arcPlayer,
  );

  const [createSession] = useCreateSessionMutation();
  const [resetGame] = useResetGameMutation();
  const [performAction] = usePerformActionMutation();
  const [closeSession] = useCloseSessionMutation();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Start session on mount
  useEffect(() => {
    const gid = initialGameId ?? 'bt11-fd9df0622a1a';

    async function init() {
      try {
        const result = await createSession({ source_url: 'arc-player-window' }).unwrap();
        const sid = result.session_id;
        sessionIdRef.current = sid;
        dispatch(setSession({ sessionId: sid, gameId: gid }));

        const frame = await resetGame({ sessionId: sid, gameId: gid }).unwrap();
        dispatch(setFrame(frame));
      } catch {
        dispatch(setStatus('idle'));
      }
    }

    init();

    return () => {
      if (sessionIdRef.current) {
        closeSession(sessionIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSession, createSession, dispatch, initialGameId, resetGame]);

  // Timer
  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(() => {
        dispatch(incrementTimer());
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, dispatch]);

  const handleAction = useCallback(
    async (action: string, data?: Record<string, unknown>) => {
      if (!sessionId || !gameId) return;
      try {
        const frame = await performAction({
          sessionId,
          gameId,
          action: { action, data },
        }).unwrap();
        dispatch(setFrame(frame));
        const entry: ActionLogEntry = { action, data, timestamp: Date.now() };
        dispatch(pushAction(entry));
      } catch {
        // Action failed — no state change
      }
    },
    [sessionId, gameId, performAction, dispatch],
  );

  const handleReset = useCallback(async () => {
    if (!sessionId || !gameId) return;
    try {
      const frame = await resetGame({ sessionId, gameId }).unwrap();
      dispatch(setFrame(frame));
      dispatch(clearHistory());
    } catch {
      // Reset failed
    }
  }, [sessionId, gameId, resetGame, dispatch]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!currentFrame?.available_actions.includes('ACTION6')) return;
      handleAction('ACTION6', { x: col, y: row });
    },
    [currentFrame, handleAction],
  );

  // Title bar info
  const gameName = gameId?.split('-')[0]?.toUpperCase() ?? 'ARC-AGI';
  const levelDisplay = currentFrame
    ? `Level ${currentFrame.levels_completed}/${Math.max(...currentFrame.win_levels, 1)}`
    : '';

  if (status === 'idle' || status === 'loading') {
    return (
      <div data-part="arc-player-window">
        <div data-part="arc-player-header">
          <span data-part="arc-player-title">ARC-AGI</span>
        </div>
        <div data-part="arc-player-loading">{status === 'loading' ? 'Starting game\u2026' : 'Idle'}</div>
      </div>
    );
  }

  return (
    <div data-part="arc-player-window">
      <div data-part="arc-player-header">
        <span data-part="arc-player-title">{gameName}</span>
        <span data-part="arc-player-level">{levelDisplay}</span>
        <span data-part="arc-player-timer">
          {'\u25F7'} {formatTime(elapsedSeconds)}
        </span>
      </div>
      <div data-part="arc-player-body">
        <GameGrid frame={currentFrame?.frame ?? []} onCellClick={handleCellClick} />
        <ActionSidebar
          actionCount={actionCount}
          availableActions={currentFrame?.available_actions ?? []}
          levelsCompleted={currentFrame?.levels_completed ?? 0}
          winLevels={currentFrame?.win_levels ?? [1]}
          gameState={currentFrame?.state ?? 'IDLE'}
          onAction={handleAction}
          onReset={handleReset}
        />
      </div>
      <ActionLog actions={actionHistory} />
    </div>
  );
}
