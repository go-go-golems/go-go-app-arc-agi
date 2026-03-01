import { createAction, createSlice } from '@reduxjs/toolkit';
import type {
  ArcBridgeState,
  ArcCommandFailurePayload,
  ArcCommandRecord,
  ArcCommandRequestPayload,
  ArcCommandSuccessPayload,
  ArcGameSnapshot,
  ArcSessionSnapshot,
} from './contracts';
import { validateArcCommandRequestPayload } from './contracts';

const MAX_COMMAND_HISTORY = 250;
const MAX_RECENT_ERRORS = 100;

function nowIso() {
  return new Date().toISOString();
}

function pruneCommandHistory(state: ArcBridgeState) {
  if (state.commands.order.length <= MAX_COMMAND_HISTORY) {
    return;
  }

  const removeCount = state.commands.order.length - MAX_COMMAND_HISTORY;
  const toRemove = state.commands.order.slice(0, removeCount);
  for (const requestId of toRemove) {
    delete state.commands.byId[requestId];
  }
  state.commands.order = state.commands.order.slice(removeCount);
}

function upsertCommand(state: ArcBridgeState, record: ArcCommandRecord) {
  if (!state.commands.byId[record.requestId]) {
    state.commands.order.push(record.requestId);
  }

  state.commands.byId[record.requestId] = record;

  const runtimeSessionId = record.meta?.runtimeSessionId;
  if (runtimeSessionId) {
    state.lastCommandByRuntimeSession[runtimeSessionId] = record.requestId;
  }

  pruneCommandHistory(state);
}

const initialState: ArcBridgeState = {
  commands: {
    byId: {},
    order: [],
  },
  sessions: {},
  games: {},
  lastCommandByRuntimeSession: {},
  recentErrors: [],
};

export const arcCommandRequested = createAction<ArcCommandRequestPayload>('arc/command.request');
export const arcCommandStarted = createAction<
  Pick<ArcCommandRequestPayload, 'requestId' | 'meta'> & { startedAt?: string }
>('arc/command.started');
export const arcCommandSucceeded = createAction<ArcCommandSuccessPayload>('arc/command.succeeded');
export const arcCommandFailed = createAction<ArcCommandFailurePayload>('arc/command.failed');
export const arcSessionSnapshotUpserted = createAction<ArcSessionSnapshot>('arc/session.snapshot.upsert');
export const arcGameSnapshotUpserted = createAction<ArcGameSnapshot>('arc/game.snapshot.upsert');

const arcBridgeSlice = createSlice({
  name: 'arcBridge',
  initialState,
  reducers: {
    clearArcBridgeState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(arcCommandRequested, (state, action) => {
        const parsed = validateArcCommandRequestPayload(action.payload);
        if (!parsed.ok) {
          return;
        }
        const payload = parsed.payload;
        upsertCommand(state, {
          requestId: payload.requestId,
          op: payload.op,
          args: payload.args,
          status: 'requested',
          requestedAt: nowIso(),
          meta: payload.meta,
        });
      })
      .addCase(arcCommandStarted, (state, action) => {
        const record = state.commands.byId[action.payload.requestId];
        if (!record) {
          return;
        }

        record.status = 'started';
        record.startedAt = action.payload.startedAt ?? nowIso();
        if (action.payload.meta) {
          record.meta = { ...record.meta, ...action.payload.meta };
        }
      })
      .addCase(arcCommandSucceeded, (state, action) => {
        const record = state.commands.byId[action.payload.requestId];
        if (!record) {
          return;
        }

        record.status = 'succeeded';
        record.completedAt = nowIso();
        record.result = action.payload.result;
        record.error = undefined;
        if (action.payload.meta) {
          record.meta = { ...record.meta, ...action.payload.meta };
        }
      })
      .addCase(arcCommandFailed, (state, action) => {
        const record = state.commands.byId[action.payload.requestId];
        if (!record) {
          return;
        }

        record.status = 'failed';
        record.completedAt = nowIso();
        record.error = action.payload.error;
        if (action.payload.meta) {
          record.meta = { ...record.meta, ...action.payload.meta };
        }

        state.recentErrors.push({
          requestId: record.requestId,
          op: record.op,
          timestamp: record.completedAt,
          code: action.payload.error.code,
          message: action.payload.error.message,
          status: action.payload.error.status,
          details: action.payload.error.details,
          meta: record.meta,
        });

        if (state.recentErrors.length > MAX_RECENT_ERRORS) {
          state.recentErrors.splice(0, state.recentErrors.length - MAX_RECENT_ERRORS);
        }
      })
      .addCase(arcSessionSnapshotUpserted, (state, action) => {
        state.sessions[action.payload.sessionId] = action.payload;
      })
      .addCase(arcGameSnapshotUpserted, (state, action) => {
        state.games[action.payload.sessionId] = action.payload;
      });
  },
});

export const { clearArcBridgeState } = arcBridgeSlice.actions;

export const arcBridgeReducer = arcBridgeSlice.reducer;
