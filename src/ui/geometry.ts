export interface BoardMetrics {
  width: number;
  height: number;
  pad: number;
  cell: number;
}

export interface BoardPoint {
  row: number;
  col: number;
}

/** 棋盘按宽度撑开。9 条竖线、10 条横线，棋子落在交叉点上。 */
export function metricsForWidth(width: number): BoardMetrics {
  const safe = Math.max(240, width);
  const pad = Math.max(18, Math.round(safe * 0.06));
  const cell = (safe - pad * 2) / 8;
  return {
    width: safe,
    height: pad * 2 + cell * 9,
    pad,
    cell,
  };
}

export function squareCenter(
  point: BoardPoint,
  metrics: BoardMetrics,
  flipped: boolean,
): { x: number; y: number } {
  const visual = toVisual(point, flipped);
  return {
    x: metrics.pad + visual.col * metrics.cell,
    y: metrics.pad + visual.row * metrics.cell,
  };
}

export function nearestSquare(
  x: number,
  y: number,
  metrics: BoardMetrics,
  flipped: boolean,
): BoardPoint | null {
  const col = Math.round((x - metrics.pad) / metrics.cell);
  const row = Math.round((y - metrics.pad) / metrics.cell);
  if (col < 0 || col > 8 || row < 0 || row > 9) return null;
  const centerX = metrics.pad + col * metrics.cell;
  const centerY = metrics.pad + row * metrics.cell;
  if (Math.hypot(x - centerX, y - centerY) > metrics.cell * 0.5) return null;
  return fromVisual({ row, col }, flipped);
}

export function toVisual(point: BoardPoint, flipped: boolean): BoardPoint {
  if (!flipped) return point;
  return { row: 9 - point.row, col: 8 - point.col };
}

export function fromVisual(point: BoardPoint, flipped: boolean): BoardPoint {
  return toVisual(point, flipped);
}
