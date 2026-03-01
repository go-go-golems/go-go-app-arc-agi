/** Core game state returned by reset and action endpoints. */
export interface FrameEnvelope {
  session_id: string;
  game_id: string;
  guid: string;
  state: GameState;
  levels_completed: number;
  win_levels: number[];
  available_actions: string[];
  frame: number[][];
  action?: {
    id: string;
    data?: Record<string, unknown>;
  };
}

export type GameState = 'RUNNING' | 'WON' | 'LOST' | 'IDLE';

export interface ActionRequest {
  action: string;
  data?: Record<string, unknown>;
  reasoning?: unknown;
}

export interface GameSummary {
  game_id: string;
  name?: string;
}

export interface SessionEvent {
  seq: number;
  ts: string;
  session_id: string;
  game_id?: string;
  type: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

export interface EventsResponse {
  session_id: string;
  events: SessionEvent[];
}

export interface TimelineResponse {
  session_id: string;
  status: string;
  counts: Record<string, number>;
  items: { seq: number; type: string; summary: string }[];
}

export interface CreateSessionRequest {
  source_url?: string;
  tags?: string[];
  opaque?: Record<string, unknown>;
}

export interface ActionLogEntry {
  action: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
