import { useEffect, useRef } from 'react';
import { formatActionGlyph } from '../domain/actionLog';
import type { ActionLogEntry } from '../domain/types';
import './ActionLog.css';

export interface ActionLogProps {
  actions: ActionLogEntry[];
}

export function ActionLog({ actions }: ActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const actionCount = actions.length;
  useEffect(() => {
    if (actionCount === 0) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [actionCount]);

  if (actions.length === 0) {
    return (
      <div data-part="arc-action-log" data-state="empty">
        <span data-part="arc-action-log-placeholder">No actions yet</span>
      </div>
    );
  }

  return (
    <div data-part="arc-action-log" ref={scrollRef}>
      {actions.map((entry, i) => (
        <span key={`${entry.action}-${entry.timestamp}-${i}`} data-part="arc-action-log-entry">
          {formatActionGlyph(entry)}
        </span>
      ))}
    </div>
  );
}
