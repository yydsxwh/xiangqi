import type { Side } from '../domain/types.ts';

/**
 * 棋盘是哑视图。
 * 合法落点、将军和提示由外面算好后传入。本文件不引用棋手、权限或服务端。
 */
export interface BoardViewModel {
  fen: string;
  orientation: Side;
  turn: Side;
  destinations: Readonly<Record<string, readonly string[]>>;
  lastMove?: readonly [string, string];
  check: Side | null;
  hintArrow?: readonly [string, string];
  interactive: boolean;
}

export interface BoardIntent {
  type: 'select' | 'move' | 'cancel';
  from?: string;
  to?: string;
}

export function createBoardViewModel(input: BoardViewModel): BoardViewModel {
  return {
    fen: input.fen,
    orientation: input.orientation,
    turn: input.turn,
    destinations: input.destinations,
    lastMove: input.lastMove,
    check: input.check,
    hintArrow: input.hintArrow,
    interactive: input.interactive,
  };
}
