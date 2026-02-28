import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ActionLogEntry, FrameEnvelope } from '../../domain/types';

export interface ArcPlayerState {
  sessionId: string | null;
  gameId: string | null;
  currentFrame: FrameEnvelope | null;
  actionHistory: ActionLogEntry[];
  actionCount: number;
  elapsedSeconds: number;
  status: 'idle' | 'loading' | 'playing' | 'won' | 'lost';
}

const initialState: ArcPlayerState = {
  sessionId: null,
  gameId: null,
  currentFrame: null,
  actionHistory: [],
  actionCount: 0,
  elapsedSeconds: 0,
  status: 'idle',
};

const arcPlayerSlice = createSlice({
  name: 'arcPlayer',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ sessionId: string; gameId: string }>) {
      state.sessionId = action.payload.sessionId;
      state.gameId = action.payload.gameId;
      state.status = 'loading';
    },
    setFrame(state, action: PayloadAction<FrameEnvelope>) {
      state.currentFrame = action.payload;
      if (action.payload.state === 'WON') {
        state.status = 'won';
      } else if (action.payload.state === 'LOST') {
        state.status = 'lost';
      } else {
        state.status = 'playing';
      }
    },
    pushAction(state, action: PayloadAction<ActionLogEntry>) {
      state.actionHistory.push(action.payload);
      state.actionCount += 1;
    },
    incrementTimer(state) {
      state.elapsedSeconds += 1;
    },
    resetState() {
      return initialState;
    },
    clearHistory(state) {
      state.actionHistory = [];
      state.actionCount = 0;
    },
    setStatus(state, action: PayloadAction<ArcPlayerState['status']>) {
      state.status = action.payload;
    },
  },
});

export const { setSession, setFrame, pushAction, incrementTimer, resetState, clearHistory, setStatus } =
  arcPlayerSlice.actions;
export default arcPlayerSlice.reducer;
