import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useCloseSessionMutation,
  useCreateSessionMutation,
  useGetGamesQuery,
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
  const { data: availableGames = [] } = useGetGamesQuery();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  // Start session on mount
  useEffect(() => {
    activeRef.current = true;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (initPromiseRef.current) {
      return () => {
        activeRef.current = false;
        const sid = sessionIdRef.current;
        if (!sid) return;
        closeTimerRef.current = setTimeout(() => {
          void closeSession(sid);
          if (sessionIdRef.current === sid) {
            sessionIdRef.current = null;
          }
        }, 250);
      };
    }

    const gid = initialGameId ?? 'bt11-fd9df0622a1a';

    initPromiseRef.current = (async () => {
      try {
        const result = await createSession({ source_url: 'arc-player-window' }).unwrap();
        const sid = result.session_id;
        sessionIdRef.current = sid;
        if (!activeRef.current) {
          void closeSession(sid);
          return;
        }
        dispatch(setSession({ sessionId: sid, gameId: gid }));

        const frame = await resetGame({ sessionId: sid, gameId: gid }).unwrap();
        if (!activeRef.current) {
          void closeSession(sid);
          return;
        }
        dispatch(setFrame(frame));
      } catch {
        if (activeRef.current) {
          dispatch(setStatus('idle'));
        }
        initPromiseRef.current = null;
      }
    })();

    return () => {
      activeRef.current = false;
      const sid = sessionIdRef.current;
      if (!sid) return;
      closeTimerRef.current = setTimeout(() => {
        void closeSession(sid);
        if (sessionIdRef.current === sid) {
          sessionIdRef.current = null;
        }
      }, 250);
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
      let resolvedData = data;
      // Some games require ACTION6 payload coordinates. When triggered from the sidebar
      // button, provide a sensible default target (grid center) instead of failing silently.
      if (action === 'ACTION6' && (!resolvedData || resolvedData.x == null || resolvedData.y == null)) {
        const rows = currentFrame?.frame?.length ?? 0;
        const cols = rows > 0 ? (currentFrame?.frame?.[0]?.length ?? 0) : 0;
        resolvedData = {
          x: cols > 0 ? Math.floor(cols / 2) : 0,
          y: rows > 0 ? Math.floor(rows / 2) : 0,
        };
      }
      try {
        const frame = await performAction({
          sessionId,
          gameId,
          action: { action, data: resolvedData },
        }).unwrap();
        dispatch(setFrame(frame));
        const entry: ActionLogEntry = { action, data: resolvedData, timestamp: Date.now() };
        dispatch(pushAction(entry));
      } catch {
        // Action failed — no state change
      }
    },
    [sessionId, gameId, performAction, dispatch, currentFrame],
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

  const gameOptions = useMemo(() => {
    const fromAPI = availableGames.map((g) => g.game_id).filter((id): id is string => typeof id === 'string' && id.length > 0);
    const pinned = [gameId, initialGameId].filter((id): id is string => typeof id === 'string' && id.length > 0);
    return Array.from(new Set([...pinned, ...fromAPI]));
  }, [availableGames, gameId, initialGameId]);

  const handleGameChange = useCallback(
    async (nextGameId: string) => {
      if (!sessionId) return;
      if (!nextGameId || nextGameId === gameId) return;
      dispatch(setSession({ sessionId, gameId: nextGameId }));
      try {
        const frame = await resetGame({ sessionId, gameId: nextGameId }).unwrap();
        dispatch(setFrame(frame));
        dispatch(clearHistory());
      } catch {
        dispatch(setStatus('idle'));
      }
    },
    [dispatch, gameId, resetGame, sessionId],
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!currentFrame?.available_actions.includes('ACTION6')) return;
      handleAction('ACTION6', { x: col, y: row });
    },
    [currentFrame, handleAction],
  );

  // Title bar info
  const gameName = gameId?.split('-')[0]?.toUpperCase() ?? 'ARC-AGI';
  const winLevels = Array.isArray(currentFrame?.win_levels) ? currentFrame.win_levels : [];
  const targetLevel = winLevels.length > 0 ? Math.max(...winLevels) : 1;
  const levelDisplay = currentFrame ? (winLevels.length > 0 ? `Level ${currentFrame.levels_completed}/${targetLevel}` : `Level ${currentFrame.levels_completed}`) : '';

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
        <label data-part="arc-player-game-picker">
          <span data-part="arc-player-game-picker-label">Game</span>
          <select
            data-part="arc-player-game-select"
            value={gameId ?? gameOptions[0] ?? ''}
            onChange={(event) => {
              void handleGameChange(event.currentTarget.value);
            }}
          >
            {gameOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
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
