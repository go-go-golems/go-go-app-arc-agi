/** ARC-AGI standard 10-color palette (indices 0-9). */
export const ARC_PALETTE: readonly string[] = [
  '#000000', // 0 — black (background)
  '#1E93FF', // 1 — blue
  '#F93C31', // 2 — red
  '#4FCC30', // 3 — green
  '#FFDC00', // 4 — yellow
  '#999999', // 5 — grey
  '#E53AA3', // 6 — magenta
  '#FF851B', // 7 — orange
  '#87CEEB', // 8 — cyan
  '#921224', // 9 — maroon
] as const;

/** Grid line color between cells. */
export const GRID_LINE_COLOR = '#333333';

/** Get hex color for a cell value, defaulting to black for out-of-range. */
export function cellColor(value: number): string {
  return ARC_PALETTE[value] ?? ARC_PALETTE[0];
}

/** Render a frame onto a canvas 2D context. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  frame: number[][],
  canvasWidth: number,
  canvasHeight: number,
): void {
  const rows = frame.length;
  if (rows === 0) return;
  const cols = frame[0].length;
  if (cols === 0) return;

  const cellW = canvasWidth / cols;
  const cellH = canvasHeight / rows;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = cellColor(frame[r][c]);
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Grid lines
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellH);
    ctx.lineTo(canvasWidth, r * cellH);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellW, 0);
    ctx.lineTo(c * cellW, canvasHeight);
    ctx.stroke();
  }
}

/** Convert canvas pixel coordinates to grid cell coordinates. */
export function pixelToCell(
  pixelX: number,
  pixelY: number,
  canvasWidth: number,
  canvasHeight: number,
  cols: number,
  rows: number,
): { col: number; row: number } {
  const col = Math.floor((pixelX / canvasWidth) * cols);
  const row = Math.floor((pixelY / canvasHeight) * rows);
  return { col: Math.min(col, cols - 1), row: Math.min(row, rows - 1) };
}
