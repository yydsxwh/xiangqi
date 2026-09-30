import { BOARD_COLS, BOARD_ROWS, type Square } from './types.ts';

const UCCI_MOVE = /^[a-i][0-9][a-i][0-9]$/;

export function isUcciMove(value: string): boolean {
  return UCCI_MOVE.test(value);
}

/** 内部坐标转 UCCI 格子。等级 0 在红方底线。 */
export function squareToUcci(square: Square): string {
  assertSquare(square);
  const file = String.fromCharCode(97 + square.col);
  const rank = BOARD_ROWS - 1 - square.row;
  return `${file}${rank}`;
}

export function ucciToSquare(token: string): Square {
  if (!/^[a-i][0-9]$/.test(token)) {
    throw new Error(`无效的 UCCI 格子: ${token}`);
  }
  const col = token.charCodeAt(0) - 97;
  const rank = Number(token[1]);
  return { row: BOARD_ROWS - 1 - rank, col };
}

export function parseUcciMove(ucci: string): { from: Square; to: Square } {
  if (!isUcciMove(ucci)) {
    throw new Error(`无效的 UCCI 着法: ${ucci}`);
  }
  return {
    from: ucciToSquare(ucci.slice(0, 2)),
    to: ucciToSquare(ucci.slice(2, 4)),
  };
}

function assertSquare(square: Square): void {
  if (
    !Number.isInteger(square.row) ||
    !Number.isInteger(square.col) ||
    square.row < 0 ||
    square.row >= BOARD_ROWS ||
    square.col < 0 ||
    square.col >= BOARD_COLS
  ) {
    throw new Error(`坐标超出棋盘: ${square.row},${square.col}`);
  }
}
