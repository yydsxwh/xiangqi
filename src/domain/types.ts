/** 红方先走。内部行号 0 是黑方底线，与 FEN 从上到下的顺序一致。 */
export const SIDES = ['red', 'black'] as const;
export type Side = (typeof SIDES)[number];

export interface Square {
  row: number;
  col: number;
}

/** 棋手之间交换的一步。UCCI 四字符，例如 `h2e2`。 */
export interface PlayerMove {
  ucci: string;
}

export const START_FEN =
  'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;
