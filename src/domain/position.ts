/**
 * 局面只有一份真相：棋盘、行棋方、着数和重复检测。
 * FEN 由这里序列化，不再另存一个可能打架的 turn。
 *
 * 走子规则来自 MIT 引擎 src/engine（Copyright (c) 2024 hkm-a）。
 */

import { squareToUcci, parseUcciMove, isUcciMove } from './coordinates.ts';
import type { Side } from './types.ts';
import { PIECE_CHARS, RED, BLACK } from '../engine/constants.js';
import { boardToFEN, isValidFEN, fenToBoard, fenToTurn } from '../engine/fen.js';
import { formatDisplayMove } from '../engine/notation.js';
import { RepetitionDetector } from '../engine/perpetual.js';
import {
  cloneBoard,
  createInitialBoard,
  getAllMoves,
  getValidMoves,
  isCheckmate,
  isInCheck,
  isStalemate,
} from '../engine/pieces.js';

export type Piece = { type: string; color: Side };
export type Board = (Piece | null)[][];

export interface Position {
  board: Board;
  sideToMove: Side;
  halfmove: number;
  fullmove: number;
  repetition: RepetitionDetector;
}

export interface MoveRecord {
  ply: number;
  side: Side;
  ucci: string;
  notation: string;
  fenBefore: string;
  fenAfter: string;
  capturedPiece?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  playerKind: string;
  startedAt?: number;
  completedAt?: number;
  thinkingMs?: number;
  ai?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    costUsd?: number;
    requestId?: string;
  };
}

export type EndKind = 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface EndState {
  status: EndKind;
  subStatus: 'perpetual_check' | 'threefold' | null;
}

export function createInitialPosition(): Position {
  return {
    board: createInitialBoard(),
    sideToMove: 'red',
    halfmove: 0,
    fullmove: 1,
    repetition: new RepetitionDetector(),
  };
}

export function fenOf(position: Position): string {
  return boardToFEN(position.board, position.sideToMove, position.halfmove, position.fullmove);
}

export function clonePosition(position: Position): Position {
  const repetition = new RepetitionDetector();
  const source = position.repetition as unknown as {
    history: Map<number, number>;
    moveLog: { hash: number; wasCheck: boolean }[];
  };
  const target = repetition as unknown as typeof source;
  target.history = new Map(source.history);
  target.moveLog = source.moveLog.map((item) => ({ ...item }));
  return {
    board: cloneBoard(position.board),
    sideToMove: position.sideToMove,
    halfmove: position.halfmove,
    fullmove: position.fullmove,
    repetition,
  };
}

export function endStateOf(position: Position): EndState {
  const color = position.sideToMove;
  let status: EndKind = 'ongoing';
  if (isCheckmate(position.board, color)) status = 'checkmate';
  else if (isStalemate(position.board, color)) status = 'stalemate';
  else if (isInCheck(position.board, color)) status = 'check';

  let subStatus: EndState['subStatus'] = null;
  if (status !== 'checkmate' && status !== 'stalemate') {
    if (position.repetition.getCount(position.board, color) >= 3) {
      status = 'draw';
      subStatus = 'threefold';
    }
    if (position.repetition.isPerpetualCheck()) {
      status = 'checkmate';
      subStatus = 'perpetual_check';
    }
  }
  return { status, subStatus };
}

export function legalUcciMoves(position: Position): string[] {
  return getAllMoves(position.board, position.sideToMove).map((move: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  }) => squareToUcci({ row: move.fromRow, col: move.fromCol }) + squareToUcci({ row: move.toRow, col: move.toCol }));
}

export function destinationsFrom(position: Position, row: number, col: number): string[] {
  const piece = position.board[row]?.[col];
  if (!piece || piece.color !== position.sideToMove) return [];
  return getValidMoves(position.board, row, col, true).map((move: { row: number; col: number }) =>
    squareToUcci({ row: move.row, col: move.col }),
  );
}

export interface PlayMeta {
  playerKind: string;
  ply: number;
  startedAt?: number;
  completedAt?: number;
  thinkingMs?: number;
  ai?: MoveRecord['ai'];
}

export type PlayResult =
  | { ok: true; position: Position; record: MoveRecord; end: EndState }
  | { ok: false; reason: string };

export function playUcci(position: Position, ucci: string, meta: PlayMeta): PlayResult {
  if (!isUcciMove(ucci)) return { ok: false, reason: '着法格式不正确' };
  const { from, to } = parseUcciMove(ucci);
  const piece = position.board[from.row]?.[from.col];
  if (!piece || piece.color !== position.sideToMove) {
    return { ok: false, reason: '起点没有当前行棋方的棋子' };
  }
  const allowed = getValidMoves(position.board, from.row, from.col, true) as { row: number; col: number }[];
  if (!allowed.some((move) => move.row === to.row && move.col === to.col)) {
    return { ok: false, reason: '这步不合法' };
  }

  const board = cloneBoard(position.board) as Board;
  const captured = board[to.row][to.col];
  const notation = formatDisplayMove({
    piece,
    from,
    to,
    captured,
  });
  board[to.row][to.col] = { ...piece };
  board[from.row][from.col] = null;

  const nextSide: Side = position.sideToMove === 'red' ? 'black' : 'red';
  const gaveCheck = Boolean(isInCheck(board, nextSide));
  const repetition = clonePosition({ ...position, board, sideToMove: nextSide }).repetition;
  repetition.record(board, nextSide, gaveCheck);

  const next: Position = {
    board,
    sideToMove: nextSide,
    halfmove: captured ? 0 : position.halfmove + 1,
    fullmove: position.sideToMove === 'black' ? position.fullmove + 1 : position.fullmove,
    repetition,
  };
  const end = endStateOf(next);
  const chars = PIECE_CHARS as Record<string, Record<string, string>>;
  const record: MoveRecord = {
    ply: meta.ply,
    side: position.sideToMove,
    ucci,
    notation,
    fenBefore: fenOf(position),
    fenAfter: fenOf(next),
    capturedPiece: captured ? chars[captured.color][captured.type] : undefined,
    isCheck: gaveCheck,
    isCheckmate: end.status === 'checkmate',
    playerKind: meta.playerKind,
    startedAt: meta.startedAt,
    completedAt: meta.completedAt,
    thinkingMs: meta.thinkingMs,
    ai: meta.ai,
  };
  return { ok: true, position: next, record, end };
}

export function replay(records: readonly MoveRecord[]): { position: Position; end: EndState } {
  let position = createInitialPosition();
  let end = endStateOf(position);
  for (const record of records) {
    const played = playUcci(position, record.ucci, {
      playerKind: record.playerKind,
      ply: record.ply,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      thinkingMs: record.thinkingMs,
      ai: record.ai,
    });
    if (!played.ok) throw new Error(played.reason);
    position = played.position;
    end = played.end;
  }
  return { position, end };
}

export function pieceLabel(piece: Piece): string {
  const chars = PIECE_CHARS as Record<string, Record<string, string>>;
  return chars[piece.color][piece.type] ?? '';
}

export function isEngineFen(fen: string): boolean {
  return Boolean(isValidFEN(fen) && fenToBoard(fen) && fenToTurn(fen));
}

export { RED, BLACK };
