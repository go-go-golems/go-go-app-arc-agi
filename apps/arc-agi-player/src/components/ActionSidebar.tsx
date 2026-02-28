import { actionGlyph } from '../domain/actionLog';
import './ActionSidebar.css';

export interface ActionSidebarProps {
  actionCount: number;
  availableActions: string[];
  levelsCompleted: number;
  winLevels: number[];
  gameState: string;
  onAction: (action: string, data?: Record<string, unknown>) => void;
  onReset: () => void;
  onUndo?: () => void;
}

function DPad({ availableActions, onAction }: { availableActions: string[]; onAction: (action: string) => void }) {
  const directions = [
    { action: 'ACTION1', label: '\u25B2', gridArea: 'up' },
    { action: 'ACTION3', label: '\u25C4', gridArea: 'left' },
    { action: 'ACTION4', label: '\u25BA', gridArea: 'right' },
    { action: 'ACTION2', label: '\u25BC', gridArea: 'down' },
  ];

  return (
    <div data-part="arc-dpad">
      {directions.map((d) => {
        const enabled = availableActions.includes(d.action);
        return (
          <button
            key={d.action}
            type="button"
            data-part="arc-dpad-button"
            data-state={enabled ? undefined : 'disabled'}
            style={{ gridArea: d.gridArea }}
            disabled={!enabled}
            onClick={() => onAction(d.action)}
            title={`${d.action} (${actionGlyph(d.action)})`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function ScoreBar({ levelsCompleted, winLevels }: { levelsCompleted: number; winLevels: number[] }) {
  const maxLevel = Math.max(...winLevels, 1);
  const pct = Math.min(100, Math.round((levelsCompleted / maxLevel) * 100));
  return (
    <div data-part="arc-score-section">
      <div data-part="arc-score-label">Score: {pct}%</div>
      <div data-part="arc-score-bar">
        <div data-part="arc-score-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ActionSidebar({
  actionCount,
  availableActions,
  levelsCompleted,
  winLevels,
  gameState,
  onAction,
  onReset,
  onUndo,
}: ActionSidebarProps) {
  const isGameOver = gameState === 'WON' || gameState === 'LOST';

  return (
    <div data-part="arc-sidebar">
      <div data-part="arc-sidebar-counter">Actions: {actionCount}</div>

      <DPad availableActions={availableActions} onAction={onAction} />

      <div data-part="arc-sidebar-actions">
        {(['ACTION5', 'ACTION6'] as const).map((a) => {
          const enabled = !isGameOver && availableActions.includes(a);
          return (
            <button
              key={a}
              type="button"
              data-part="arc-action-button"
              data-state={enabled ? undefined : 'disabled'}
              disabled={!enabled}
              onClick={() => onAction(a)}
            >
              {actionGlyph(a)}
            </button>
          );
        })}
      </div>

      <div data-part="arc-sidebar-controls">
        {onUndo && (
          <button type="button" data-part="arc-control-button" onClick={onUndo} disabled={actionCount === 0}>
            Undo
          </button>
        )}
        <button type="button" data-part="arc-control-button" onClick={onReset}>
          Reset
        </button>
      </div>

      <ScoreBar levelsCompleted={levelsCompleted} winLevels={winLevels} />

      {isGameOver && (
        <div data-part="arc-game-state-badge" data-variant={gameState.toLowerCase()}>
          {gameState}
        </div>
      )}
    </div>
  );
}
