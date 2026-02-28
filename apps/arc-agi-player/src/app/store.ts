import {
  debugReducer,
  hypercardArtifactsReducer,
  notificationsReducer,
  pluginCardRuntimeReducer,
} from '@hypercard/engine';
import { windowingReducer } from '@hypercard/engine/desktop-core';
import { configureStore } from '@reduxjs/toolkit';
import { arcApi } from '../api/arcApi';
import arcPlayerReducer from '../features/arcPlayer/arcPlayerSlice';

function createArcPlayerStore() {
  return configureStore({
    reducer: {
      pluginCardRuntime: pluginCardRuntimeReducer,
      windowing: windowingReducer,
      notifications: notificationsReducer,
      debug: debugReducer,
      hypercardArtifacts: hypercardArtifactsReducer,
      arcPlayer: arcPlayerReducer,
      [arcApi.reducerPath]: arcApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(arcApi.middleware),
  });
}

export const store = createArcPlayerStore();
export { createArcPlayerStore };

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
