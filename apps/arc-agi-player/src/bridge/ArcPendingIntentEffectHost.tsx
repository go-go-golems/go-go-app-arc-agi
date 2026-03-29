import {
  dequeuePendingDomainIntent,
  ingestRuntimeAction,
  selectPendingDomainIntents,
  type DomainIntentEnvelope,
} from '@go-go-golems/os-scripting';
import {
  showToast,
} from '@go-go-golems/os-core';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  arcCommandFailed,
  arcCommandStarted,
  arcCommandSucceeded,
  arcGameSnapshotUpserted,
  arcSessionSnapshotUpserted,
} from './slice';
import type { ArcCommandMeta, ArcCommandRequestPayload, ArcCommandSuccessPayload } from './contracts';
import { validateArcCommandRequestPayload } from './contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function toMeta(intent: DomainIntentEnvelope, payload: ArcCommandRequestPayload): ArcCommandMeta {
  return {
    ...payload.meta,
    source: 'plugin-runtime',
    runtimeSessionId: intent.sessionId,
    surfaceId: payload.meta?.surfaceId ?? intent.surfaceId,
    cardId: payload.meta?.cardId ?? payload.meta?.surfaceId ?? intent.surfaceId,
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

async function requestJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
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

async function requestUnknown(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
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

function normalizeError(error: unknown): { code: string; message: string; status?: number; details?: unknown } {
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

async function executeArcCommand(payload: ArcCommandRequestPayload): Promise<{
  result: Record<string, unknown>;
  sessionId?: string;
  gameId?: string;
  gameState?: string;
}> {
  const args = asObject(payload.args);

  if (payload.op === 'list-games') {
    const responsePayload = await requestUnknown('/api/apps/arc-agi/games', { method: 'GET' });
    return { result: { games: extractGamesPayload(responsePayload) } };
  }

  if (payload.op === 'create-session') {
    const result = await requestJson('/api/apps/arc-agi/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    return {
      result,
      sessionId: inferSessionId(payload, result),
      gameId: inferGameId(payload, result),
      gameState: asString(result.state),
    };
  }

  const sessionId = asString(args.sessionId);
  if (!sessionId) {
    throw { code: 'invalid_request', message: `ARC ${payload.op} requires args.sessionId` };
  }

  if (payload.op === 'load-events') {
    const afterSeq = asNumber(args.afterSeq);
    const suffix = typeof afterSeq === 'number' ? `?after_seq=${afterSeq}` : '';
    const result = await requestJson(`/api/apps/arc-agi/sessions/${sessionId}/events${suffix}`, { method: 'GET' });
    return { result, sessionId };
  }

  if (payload.op === 'load-timeline') {
    const result = await requestJson(`/api/apps/arc-agi/sessions/${sessionId}/timeline`, { method: 'GET' });
    return { result, sessionId };
  }

  const gameId = asString(args.gameId);
  if (!gameId) {
    throw { code: 'invalid_request', message: `ARC ${payload.op} requires args.gameId` };
  }

  if (payload.op === 'reset-game') {
    const result = await requestJson(`/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { result, sessionId, gameId, gameState: asString(result.state) };
  }

  if (payload.op === 'perform-action') {
    const action = asObject(args.action);
    const result = await requestJson(`/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action),
    });
    return { result, sessionId, gameId, gameState: asString(result.state) };
  }

  throw { code: 'invalid_request', message: `Unsupported ARC command op: ${payload.op}` };
}

function mirrorRuntimeSessionState(
  dispatch: (action: unknown) => unknown,
  runtimeSessionId: string,
  surfaceId: string,
  payload: Record<string, unknown>,
) {
  dispatch(
    ingestRuntimeAction({
      sessionId: runtimeSessionId,
      surfaceId,
      action: {
        type: 'filters.patch',
        payload,
      },
    }),
  );
}

function extractGameIds(result: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const games = asArray(result.games);
  for (const item of games) {
    if (typeof item === 'string' && item.trim().length > 0) {
      seen.add(item.trim());
      continue;
    }
    const game = asObject(item);
    const nested = asObject(game.game);
    const gameId = asString(game.game_id) ?? asString(game.gameId) ?? asString(game.id);
    const nestedGameId = asString(nested.game_id) ?? asString(nested.gameId) ?? asString(nested.id);
    if (gameId) {
      seen.add(gameId);
    } else if (nestedGameId) {
      seen.add(nestedGameId);
    }
  }
  return Array.from(seen);
}

function buildSuccessRuntimePatch(
  requestId: string,
  op: ArcCommandRequestPayload['op'],
  execution: { sessionId?: string; gameId?: string; result: Record<string, unknown> },
) {
  const patch: Record<string, unknown> = {
    arcStatus: 'succeeded',
    arcLastRequestId: requestId,
    arcLastError: null,
    arcLastResult: execution.result,
  };

  if (execution.sessionId) {
    patch.arcSessionId = execution.sessionId;
  }
  if (execution.gameId) {
    patch.arcGameId = execution.gameId;
  }
  if (op === 'list-games') {
    patch.arcAvailableGames = extractGameIds(execution.result);
  }

  return patch;
}

export function ArcPendingIntentEffectHost() {
  const dispatch = useDispatch();
  const pendingDomainIntents = useSelector((state: unknown) => selectPendingDomainIntents(state as any));
  const processingRef = useRef(false);
  const inFlightRequestIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (processingRef.current) {
      return;
    }

    const nextIntent = (pendingDomainIntents as DomainIntentEnvelope[]).find(
      (intent) => intent.domain === 'arc' && intent.type === 'arc/command.request',
    );
    if (!nextIntent) {
      return;
    }

    processingRef.current = true;
    dispatch(dequeuePendingDomainIntent({ id: nextIntent.id }));

    const validated = validateArcCommandRequestPayload(nextIntent.payload);
    if (!validated.ok) {
      const requestId = asString(asObject(nextIntent.payload).requestId) ?? `invalid-${nextIntent.id}`;
      const error = {
        code: 'invalid_request',
        message: validated.reason,
      };
      dispatch(arcCommandFailed({ requestId, error }));
      mirrorRuntimeSessionState(dispatch as any, nextIntent.sessionId, nextIntent.surfaceId, {
        arcStatus: 'failed',
        arcLastRequestId: requestId,
        arcLastError: error.message,
      });
      dispatch(showToast(`ARC command invalid: ${error.message}`));
      processingRef.current = false;
      return;
    }

    const payload = validated.payload;
    if (inFlightRequestIdsRef.current.has(payload.requestId)) {
      processingRef.current = false;
      return;
    }

    inFlightRequestIdsRef.current.add(payload.requestId);
    const meta = toMeta(nextIntent, payload);

    mirrorRuntimeSessionState(dispatch as any, nextIntent.sessionId, nextIntent.surfaceId, {
      arcStatus: 'started',
      arcLastRequestId: payload.requestId,
      arcLastError: null,
    });

    dispatch(arcCommandStarted({ requestId: payload.requestId, meta }));

    void executeArcCommand(payload)
      .then((execution) => {
        if (execution.sessionId) {
          dispatch(
            arcSessionSnapshotUpserted({
              sessionId: execution.sessionId,
              gameId: execution.gameId,
              state: execution.result,
              updatedAt: new Date().toISOString(),
            }),
          );
        }

        if (execution.sessionId && execution.gameId) {
          dispatch(
            arcGameSnapshotUpserted({
              sessionId: execution.sessionId,
              gameId: execution.gameId,
              frame: execution.result,
              state: execution.gameState,
              updatedAt: new Date().toISOString(),
            }),
          );
        }

        dispatch(
          arcCommandSucceeded({
            requestId: payload.requestId,
            result: execution.result as ArcCommandSuccessPayload['result'],
            meta,
          }),
        );

        mirrorRuntimeSessionState(
          dispatch as any,
          nextIntent.sessionId,
          nextIntent.surfaceId,
          buildSuccessRuntimePatch(payload.requestId, payload.op, execution),
        );
      })
      .catch((error) => {
        const normalized = normalizeError(error);
        dispatch(
          arcCommandFailed({
            requestId: payload.requestId,
            error: normalized,
            meta,
          }),
        );
        mirrorRuntimeSessionState(dispatch as any, nextIntent.sessionId, nextIntent.surfaceId, {
          arcStatus: 'failed',
          arcLastRequestId: payload.requestId,
          arcLastError: normalized.message,
        });
        dispatch(showToast(`ARC command failed: ${normalized.message}`));
      })
      .finally(() => {
        inFlightRequestIdsRef.current.delete(payload.requestId);
        processingRef.current = false;
      });
  }, [dispatch, pendingDomainIntents]);

  return null;
}
