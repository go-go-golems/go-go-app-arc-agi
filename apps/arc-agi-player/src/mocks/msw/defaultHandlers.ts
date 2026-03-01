import type { ArcHandlerData, CreateArcHandlersOptions } from './createArcHandlers';
import { createArcHandlers } from './createArcHandlers';

export function createDefaultArcHandlers(overrides?: Partial<ArcHandlerData>, opts?: { delayMs?: number }) {
  return createArcHandlers({
    data: overrides,
    delayMs: opts?.delayMs,
  });
}

export { createArcHandlers };
export type { ArcHandlerData, CreateArcHandlersOptions };
