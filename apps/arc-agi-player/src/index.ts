// API hooks
export { arcApi, useGetGamesQuery, usePerformActionMutation, useResetGameMutation } from './api/arcApi';

// Store
export { type AppDispatch, createArcPlayerStore, type RootState } from './app/store';
export { ActionLog } from './components/ActionLog';
export { ActionSidebar } from './components/ActionSidebar';
export { ArcPlayerWindow } from './components/ArcPlayerWindow';

// Components
export { GameGrid } from './components/GameGrid';
export { actionGlyph, formatActionGlyph } from './domain/actionLog';
export { ARC_PALETTE, cellColor, renderFrame } from './domain/palette';
// Domain
export type {
  ActionLogEntry,
  ActionRequest,
  EventsResponse,
  FrameEnvelope,
  GameState,
  GameSummary,
  SessionEvent,
  TimelineResponse,
} from './domain/types';

// Slice
export { default as arcPlayerReducer } from './features/arcPlayer/arcPlayerSlice';
