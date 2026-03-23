import { showToast } from '@hypercard/engine';
import { authorizeDomainIntent, ingestRuntimeAction } from '@hypercard/hypercard-runtime';
import type { Dispatch, Middleware, UnknownAction } from '@reduxjs/toolkit';
import {
  arcCommandFailed,
  arcCommandStarted,
  arcCommandSucceeded,
  arcGameSnapshotUpserted,
  arcSessionSnapshotUpserted,
} from './slice';
import type { ArcCommandMeta, ArcCommandRequestPayload, ArcCommandSuccessPayload } from './contracts';
import { validateArcCommandRequestPayload } from './contracts';

export interface ArcBridgeMiddlewareOptions {
  fetchImpl?: typeof fetch;
}

interface ArcBridgeCommandError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

interface ArcBridgeExecutionResult {
  result: Record<string, unknown>;
  sessionSnapshot?: {
    sessionId: string;
    gameId?: string;
    state?: Record<string, unknown>;
  };
  gameSnapshot?: {
    sessionId: string;
    gameId?: string;
    frame?: Record<string, unknown>;
    state?: string;
  };
}

interface RuntimeSessionLike {
  capabilities?: unknown;
}

interface PluginRuntimeLike {
  sessions?: Record<string, RuntimeSessionLike>;
}

interface RootStateLike {
  runtimeSessions?: PluginRuntimeLike;
  arcBridge?: {
    commands?: {
      byId?: Record<string, { status?: string }>;
    };
  };
}

interface RuntimeActionMeta {
  source?: string;
  sessionId?: string;
  cardId?: string;
}

interface RuntimeActionLike {
  type: string;
  payload?: unknown;
  meta?: RuntimeActionMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractGamesPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asObject(value);
  if (Array.isArray(record.games)) {
    return record.games;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  if (Array.isArray(record.results)) {
    return record.results;
  }
  return [];
}

function mergeMeta(payload: ArcCommandRequestPayload, actionMeta?: RuntimeActionMeta): ArcCommandMeta {
  return {
    ...payload.meta,
    source: payload.meta?.source ?? (actionMeta?.source as ArcCommandMeta['source'] | undefined),
    runtimeSessionId: payload.meta?.runtimeSessionId ?? actionMeta?.sessionId,
    cardId: payload.meta?.cardId ?? actionMeta?.cardId,
  };
}

function normalizeError(error: unknown): ArcBridgeCommandError {
  if (isRecord(error)) {
    return {
      code: asString(error.code) ?? 'arc_bridge_error',
      message: asString(error.message) ?? 'ARC bridge request failed',
      status: asNumber(error.status),
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'arc_bridge_error',
      message: error.message,
    };
  }

  return {
    code: 'arc_bridge_error',
    message: String(error),
  };
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

async function requestJson(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, init);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw {
      code: 'http_error',
      message: `ARC request failed (${response.status})`,
      status: response.status,
      details: payload,
    };
  }

  return asObject(payload);
}

async function requestUnknown(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetchImpl(url, init);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw {
      code: 'http_error',
      message: `ARC request failed (${response.status})`,
      status: response.status,
      details: payload,
    };
  }

  return payload;
}

function inferSessionId(payload: ArcCommandRequestPayload, result: Record<string, unknown>): string | undefined {
  return (
    asString(result.session_id) ??
    asString(result.sessionId) ??
    asString(asObject(payload.args).sessionId) ??
    asString(asObject(payload.args).session_id)
  );
}

function inferGameId(payload: ArcCommandRequestPayload, result: Record<string, unknown>): string | undefined {
  return (
    asString(result.game_id) ??
    asString(result.gameId) ??
    asString(asObject(payload.args).gameId) ??
    asString(asObject(payload.args).game_id)
  );
}

async function executeArcCommand(
  payload: ArcCommandRequestPayload,
  fetchImpl: typeof fetch,
): Promise<ArcBridgeExecutionResult> {
  const args = asObject(payload.args);

  if (payload.op === 'list-games') {
    const responsePayload = await requestUnknown(fetchImpl, '/api/apps/arc-agi/games', { method: 'GET' });
    return {
      result: {
        games: extractGamesPayload(responsePayload),
      },
    };
  }

  if (payload.op === 'create-session') {
    const result = await requestJson(fetchImpl, '/api/apps/arc-agi/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });

    const sessionId = inferSessionId(payload, result);
    const gameId = inferGameId(payload, result);

    return {
      result,
      sessionSnapshot: sessionId
        ? {
            sessionId,
            gameId,
            state: result,
          }
        : undefined,
    };
  }

  const sessionId = asString(args.sessionId);
  if (!sessionId) {
    throw {
      code: 'invalid_request',
      message: `ARC ${payload.op} requires args.sessionId`,
    };
  }

  if (payload.op === 'load-events') {
    const afterSeq = asNumber(args.afterSeq);
    const suffix = typeof afterSeq === 'number' ? `?after_seq=${afterSeq}` : '';
    const result = await requestJson(fetchImpl, `/api/apps/arc-agi/sessions/${sessionId}/events${suffix}`, {
      method: 'GET',
    });

    return { result };
  }

  if (payload.op === 'load-timeline') {
    const result = await requestJson(fetchImpl, `/api/apps/arc-agi/sessions/${sessionId}/timeline`, {
      method: 'GET',
    });

    return { result };
  }

  const gameId = asString(args.gameId);
  if (!gameId) {
    throw {
      code: 'invalid_request',
      message: `ARC ${payload.op} requires args.gameId`,
    };
  }

  if (payload.op === 'reset-game') {
    const result = await requestJson(fetchImpl, `/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    return {
      result,
      gameSnapshot: {
        sessionId,
        gameId,
        frame: result,
        state: asString(result.state),
      },
    };
  }

  if (payload.op === 'perform-action') {
    const action = asObject(args.action);
    const result = await requestJson(fetchImpl, `/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action),
    });

    return {
      result,
      gameSnapshot: {
        sessionId,
        gameId,
        frame: result,
        state: asString(result.state),
      },
    };
  }

  throw {
    code: 'invalid_request',
    message: `Unsupported ARC command op: ${payload.op}`,
  };
}

function isArcCommandRequest(action: unknown): action is RuntimeActionLike {
  return isRecord(action) && action.type === 'arc/command.request';
}

function checkCapability(state: RootStateLike, meta: ArcCommandMeta): ArcBridgeCommandError | null {
  if (meta.source !== 'plugin-runtime') {
    return null;
  }

  const runtimeSessionId = meta.runtimeSessionId;
  if (!runtimeSessionId) {
    return {
      code: 'capability_denied',
      message: 'Missing runtime session id for plugin-runtime ARC command',
    };
  }

  const runtimeSession = state.runtimeSessions?.sessions?.[runtimeSessionId];
  if (!runtimeSession?.capabilities) {
    return {
      code: 'capability_denied',
      message: `Missing capabilities for runtime session: ${runtimeSessionId}`,
    };
  }

  const decision = authorizeDomainIntent(runtimeSession.capabilities as any, 'arc');
  if (!decision.allowed) {
    return {
      code: 'capability_denied',
      message: decision.reason ?? 'ARC domain intent denied by capability policy',
    };
  }

  return null;
}

function shouldSkipDuplicate(state: RootStateLike, requestId: string): boolean {
  const command = state.arcBridge?.commands?.byId?.[requestId];
  if (!command) {
    return false;
  }

  return command.status === 'requested' || command.status === 'started' || command.status === 'succeeded';
}

function mirrorRuntimeSessionState(
  dispatch: Dispatch<UnknownAction>,
  meta: ArcCommandMeta,
  payload: Record<string, unknown>,
) {
  const runtimeSessionId = meta.runtimeSessionId;
  if (!runtimeSessionId) {
    return;
  }

  dispatch(
    ingestRuntimeAction({
      sessionId: runtimeSessionId,
      cardId: meta.cardId ?? 'home',
      action: {
        type: 'filters.patch',
        payload,
      },
    }),
  );
}

function buildSuccessRuntimePatch(
  requestId: string,
  op: ArcCommandRequestPayload['op'],
  execution: ArcBridgeExecutionResult,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    arcStatus: 'succeeded',
    arcLastRequestId: requestId,
    arcLastError: null,
    arcLastResult: execution.result,
  };

  const sessionId = execution.sessionSnapshot?.sessionId;
  const gameId = execution.sessionSnapshot?.gameId ?? execution.gameSnapshot?.gameId;
  if (sessionId) {
    patch.arcSessionId = sessionId;
  }
  if (gameId) {
    patch.arcGameId = gameId;
  }
  if (op === 'list-games') {
    const availableGames = asArray(execution.result.games)
      .map((item) => {
        if (typeof item === 'string' && item.trim().length > 0) {
          return item.trim();
        }
        const game = asObject(item);
        const nested = asObject(game.game);
        return (
          asString(game.game_id) ??
          asString(game.gameId) ??
          asString(game.id) ??
          asString(nested.game_id) ??
          asString(nested.gameId) ??
          asString(nested.id)
        );
      })
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    patch.arcAvailableGames = Array.from(new Set(availableGames));
  }

  return patch;
}

export function createArcBridgeMiddleware(options: ArcBridgeMiddlewareOptions = {}): Middleware {
  const fetchImpl = options.fetchImpl ?? fetch;
  const inFlight = new Set<string>();

  return (store) => (next) => (action) => {
    if (!isArcCommandRequest(action)) {
      return next(action);
    }

    const parsed = validateArcCommandRequestPayload(action.payload);
    if (!parsed.ok) {
      const requestId = asString(asObject(action.payload).requestId);
      if (requestId) {
        store.dispatch(
          arcCommandFailed({
            requestId,
            error: {
              code: 'invalid_request',
              message: parsed.reason,
              details: action.payload,
            },
          }),
        );
      }
      return action;
    }

    const result = next(action);
    const payload = parsed.payload;
    const meta = mergeMeta(payload, action.meta);

    if (shouldSkipDuplicate(store.getState() as RootStateLike, payload.requestId) || inFlight.has(payload.requestId)) {
      return result;
    }

    const capabilityError = checkCapability(store.getState() as RootStateLike, meta);
    if (capabilityError) {
      store.dispatch(
        arcCommandFailed({
          requestId: payload.requestId,
          error: capabilityError,
          meta,
        }),
      );
      mirrorRuntimeSessionState(store.dispatch, meta, {
        arcStatus: 'failed',
        arcLastRequestId: payload.requestId,
        arcLastError: capabilityError.message,
      });
      store.dispatch(showToast(`ARC command denied: ${capabilityError.message}`));
      return result;
    }

    inFlight.add(payload.requestId);
    mirrorRuntimeSessionState(store.dispatch, meta, {
      arcStatus: 'started',
      arcLastRequestId: payload.requestId,
      arcLastError: null,
    });

    void (async () => {
      store.dispatch(
        arcCommandStarted({
          requestId: payload.requestId,
          meta,
        }),
      );

      try {
        const execution = await executeArcCommand(payload, fetchImpl);

        if (execution.sessionSnapshot) {
          store.dispatch(
            arcSessionSnapshotUpserted({
              ...execution.sessionSnapshot,
              updatedAt: new Date().toISOString(),
            }),
          );
        }

        if (execution.gameSnapshot) {
          store.dispatch(
            arcGameSnapshotUpserted({
              ...execution.gameSnapshot,
              updatedAt: new Date().toISOString(),
            }),
          );
        }

        store.dispatch(
          arcCommandSucceeded({
            requestId: payload.requestId,
            result: execution.result as ArcCommandSuccessPayload['result'],
            meta,
          }),
        );

        mirrorRuntimeSessionState(store.dispatch, meta, buildSuccessRuntimePatch(payload.requestId, payload.op, execution));
      } catch (error) {
        const normalized = normalizeError(error);
        store.dispatch(
          arcCommandFailed({
            requestId: payload.requestId,
            error: normalized,
            meta,
          }),
        );

        mirrorRuntimeSessionState(store.dispatch, meta, {
          arcStatus: 'failed',
          arcLastRequestId: payload.requestId,
          arcLastError: normalized.message,
        });
        store.dispatch(showToast(`ARC command failed: ${normalized.message}`));
      } finally {
        inFlight.delete(payload.requestId);
      }
    })();

    return result;
  };
}
