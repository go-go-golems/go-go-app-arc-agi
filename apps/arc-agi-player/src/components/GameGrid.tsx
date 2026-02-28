import { type MouseEvent, useCallback, useEffect, useRef } from 'react';
import { pixelToCell, renderFrame } from '../domain/palette';
import './GameGrid.css';

export interface GameGridProps {
  frame: number[][];
  onCellClick?: (row: number, col: number) => void;
}

const CANVAS_SIZE = 480;

export function GameGrid({ frame, onCellClick }: GameGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rows = frame.length;
  const cols = rows > 0 ? frame[0].length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, frame, CANVAS_SIZE, CANVAS_SIZE);
  }, [frame]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!onCellClick || rows === 0 || cols === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const { row, col } = pixelToCell(px, py, CANVAS_SIZE, CANVAS_SIZE, cols, rows);
      onCellClick(row, col);
    },
    [onCellClick, rows, cols],
  );

  if (rows === 0) {
    return (
      <div data-part="arc-game-grid" data-state="empty">
        <div data-part="arc-game-grid-empty">No frame data</div>
      </div>
    );
  }

  return (
    <div data-part="arc-game-grid">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        data-part="arc-game-canvas"
        onClick={handleClick}
      />
      <div data-part="arc-game-grid-info">
        {cols} &times; {rows}
      </div>
    </div>
  );
}
