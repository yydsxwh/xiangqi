import { BLACK, RED, ROWS } from '../src/engine/constants.js';
import { boardToFEN } from '../src/engine/fen.js';
import { cloneBoard, createInitialBoard, getValidMoves, isCheckmate, isStalemate } from '../src/engine/pieces.js';

const UCCI = /^[a-i][0-9][a-i][0-9]$/;

export function emptyRoom() {
  return { moves: [], status: 'ongoing' };
}

/** 服务端重放。客户端传来的合法着法列表不参与判断。 */
export function commitMove(state, ucci, seat) {
  const current = replay(state.moves);
  if (!current.ok) return current;
  if (current.status !== 'ongoing') return { ok: false, reason: '这局已经结束' };
  if (current.side !== seat) return { ok: false, reason: '还没轮到你' };
  const nextMoves = [...state.moves, ucci];
  const next = replay(nextMoves);
  if (!next.ok) return next;
  return { ok: true, moves: nextMoves, status: next.status, side: next.side, fen: next.fen };
}

export function replay(moves) {
  let board = createInitialBoard();
  let side = RED;
  for (const ucci of moves) {
    if (!UCCI.test(ucci)) return { ok: false, reason: '着法格式不正确' };
    const from = square(ucci.slice(0, 2));
    const to = square(ucci.slice(2, 4));
    const piece = board[from.row]?.[from.col];
    if (!piece || piece.color !== side) return { ok: false, reason: '这步不合法' };
    const allowed = getValidMoves(board, from.row, from.col, true);
    if (!allowed.some((move) => move.row === to.row && move.col === to.col)) {
      return { ok: false, reason: '这步不合法' };
    }
    board = cloneBoard(board);
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
    side = side === RED ? BLACK : RED;
  }
  const status = isCheckmate(board, side) ? 'checkmate' : isStalemate(board, side) ? 'stalemate' : 'ongoing';
  return { ok: true, side, status, fen: boardToFEN(board, side, 0, Math.floor(moves.length / 2) + 1) };
}

function square(token) {
  const col = token.charCodeAt(0) - 97;
  const rank = Number(token[1]);
  return { row: ROWS - 1 - rank, col };
}
