import type { ArcBridgeState } from './contracts';

export interface ArcBridgeStateSlice {
  arcBridge: ArcBridgeState;
}

export const selectArcBridgeState = (state: ArcBridgeStateSlice): ArcBridgeState => state.arcBridge;

export const selectArcCommandById = (state: ArcBridgeStateSlice, requestId: string) =>
  state.arcBridge.commands.byId[requestId];

export const selectArcLatestCommandForRuntimeSession = (state: ArcBridgeStateSlice, runtimeSessionId: string) => {
  const requestId = state.arcBridge.lastCommandByRuntimeSession[runtimeSessionId];
  return requestId ? state.arcBridge.commands.byId[requestId] : undefined;
};

export const selectArcPendingByRuntimeSession = (state: ArcBridgeStateSlice, runtimeSessionId: string) => {
  const latest = selectArcLatestCommandForRuntimeSession(state, runtimeSessionId);
  if (!latest) {
    return false;
  }

  return latest.status === 'requested' || latest.status === 'started';
};

export const selectArcLastErrorByRuntimeSession = (state: ArcBridgeStateSlice, runtimeSessionId: string) => {
  const latest = selectArcLatestCommandForRuntimeSession(state, runtimeSessionId);
  if (!latest || latest.status !== 'failed') {
    return null;
  }
  return latest.error ?? null;
};
