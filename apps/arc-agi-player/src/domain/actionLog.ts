import type { ActionLogEntry } from './types';

const ACTION_GLYPHS: Record<string, string> = {
  ACTION1: '\u25B2', // ▲
  ACTION2: '\u25BC', // ▼
  ACTION3: '\u25C4', // ◄
  ACTION4: '\u25BA', // ►
  ACTION5: 'A5',
  ACTION6: 'A6',
  ACTION7: 'A7',
};

/** Format an action log entry as a compact glyph string. */
export function formatActionGlyph(entry: ActionLogEntry): string {
  const glyph = ACTION_GLYPHS[entry.action] ?? entry.action;
  if (entry.data && typeof entry.data.x === 'number' && typeof entry.data.y === 'number') {
    return `${glyph}(${entry.data.x},${entry.data.y})`;
  }
  return glyph;
}

/** Map action name to directional glyph or short label. */
export function actionGlyph(action: string): string {
  return ACTION_GLYPHS[action] ?? action;
}
