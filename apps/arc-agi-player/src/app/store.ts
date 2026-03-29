import {
  debugReducer,
  notificationsReducer,
} from '@go-go-golems/os-core';
import { hypercardArtifactsReducer, runtimeSessionsReducer } from '@go-go-golems/os-scripting';
import { windowingReducer } from '@go-go-golems/os-core/desktop-core';
import { configureStore } from '@reduxjs/toolkit';
import { arcApi } from '../api/arcApi';
import { arcBridgeReducer, createArcBridgeMiddleware } from '../bridge';
import arcPlayerReducer from '../features/arcPlayer/arcPlayerSlice';

function createArcPlayerStore() {
  const arcBridgeMiddleware = createArcBridgeMiddleware();
  return configureStore({
    reducer: {
      runtimeSessions: runtimeSessionsReducer,
      arcBridge: arcBridgeReducer,
      windowing: windowingReducer,
      notifications: notificationsReducer,
      debug: debugReducer,
      hypercardArtifacts: hypercardArtifactsReducer,
      arcPlayer: arcPlayerReducer,
      [arcApi.reducerPath]: arcApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(arcBridgeMiddleware, arcApi.middleware),
  });
}

export const store = createArcPlayerStore();
export { createArcPlayerStore };

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
