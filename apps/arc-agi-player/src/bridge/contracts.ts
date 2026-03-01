export type ArcCommandOp =
  | 'list-games'
  | 'create-session'
  | 'reset-game'
  | 'perform-action'
  | 'load-timeline'
  | 'load-events';

export type ArcCommandStatus = 'requested' | 'started' | 'succeeded' | 'failed';

export interface ArcCommandMeta {
  stackId?: string;
  cardId?: string;
  runtimeSessionId?: string;
  interactionId?: string;
  source?: 'plugin-runtime' | 'arc-ui' | 'debug';
  sessionId?: string;
}

export interface ArcCommandRequestPayload {
  op: ArcCommandOp;
  requestId: string;
  args: Record<string, unknown>;
  meta?: ArcCommandMeta;
}

export interface ArcCommandSuccessPayload {
  requestId: string;
  result?: Record<string, unknown>;
  meta?: ArcCommandMeta;
}

export interface ArcCommandFailurePayload {
  requestId: string;
  error: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  };
  meta?: ArcCommandMeta;
}

export interface ArcSessionSnapshot {
  sessionId: string;
  gameId?: string;
  state?: Record<string, unknown>;
  updatedAt: string;
}

export interface ArcGameSnapshot {
  sessionId: string;
  gameId?: string;
  frame?: Record<string, unknown>;
  state?: string;
  updatedAt: string;
}

export interface ArcCommandRecord {
  requestId: string;
  op: ArcCommandOp;
  args: Record<string, unknown>;
  status: ArcCommandStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  };
  meta?: ArcCommandMeta;
}

export interface ArcCommandError {
  requestId: string;
  timestamp: string;
  op: ArcCommandOp;
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  meta?: ArcCommandMeta;
}

export interface ArcBridgeState {
  commands: {
    byId: Record<string, ArcCommandRecord>;
    order: string[];
  };
  sessions: Record<string, ArcSessionSnapshot>;
  games: Record<string, ArcGameSnapshot>;
  lastCommandByRuntimeSession: Record<string, string>;
  recentErrors: ArcCommandError[];
}

const ALLOWED_OPS: ArcCommandOp[] = [
  'list-games',
  'create-session',
  'reset-game',
  'perform-action',
  'load-timeline',
  'load-events',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArcCommandOp(value: unknown): value is ArcCommandOp {
  return typeof value === 'string' && ALLOWED_OPS.includes(value as ArcCommandOp);
}

export function validateArcCommandRequestPayload(
  value: unknown,
): { ok: true; payload: ArcCommandRequestPayload } | { ok: false; reason: string } {
  if (!isRecord(value)) {
    return { ok: false, reason: 'payload_not_object' };
  }

  if (!isArcCommandOp(value.op)) {
    return { ok: false, reason: 'invalid_op' };
  }

  if (typeof value.requestId !== 'string' || value.requestId.trim().length === 0) {
    return { ok: false, reason: 'missing_request_id' };
  }

  if (!isRecord(value.args)) {
    return { ok: false, reason: 'args_must_be_object' };
  }

  if (value.meta !== undefined && !isRecord(value.meta)) {
    return { ok: false, reason: 'meta_must_be_object' };
  }

  return {
    ok: true,
    payload: {
      op: value.op,
      requestId: value.requestId,
      args: value.args,
      meta: isRecord(value.meta) ? (value.meta as ArcCommandMeta) : undefined,
    },
  };
}
