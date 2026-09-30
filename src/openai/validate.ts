import { isUcciMove } from '../domain/coordinates.ts';
import { isEngineFen } from '../domain/position.ts';

export const MAX_FEN_LENGTH = 160;
export const MAX_LEGAL_MOVES = 120;
export const MAX_OPENAI_PLIES = 40;

export interface OpenAIMoveBody {
  matchId: string;
  fen: string;
  sideToMove: 'red' | 'black';
  legalMoves: string[];
  recentNotation: string[];
  turnId: string;
}

export function parseOpenAIMoveBody(input: unknown): { ok: true; value: OpenAIMoveBody } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: '请求格式不正确' };
  const body = input as Record<string, unknown>;
  const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
  const fen = typeof body.fen === 'string' ? body.fen.trim() : '';
  const sideToMove = body.sideToMove;
  const turnId = typeof body.turnId === 'string' ? body.turnId.trim() : '';
  const legalMoves = body.legalMoves;
  const recentNotation = body.recentNotation;

  if (!matchId || matchId.length > 80) return { ok: false, reason: '对局编号无效' };
  if (!turnId || turnId.length > 160) return { ok: false, reason: '回合编号无效' };
  if (!fen || fen.length > MAX_FEN_LENGTH || !isEngineFen(fen)) return { ok: false, reason: 'FEN 无效' };
  if (sideToMove !== 'red' && sideToMove !== 'black') return { ok: false, reason: '行棋方无效' };
  if (fen.split(/\s+/)[1] !== (sideToMove === 'red' ? 'w' : 'b')) {
    return { ok: false, reason: 'FEN 与行棋方不一致' };
  }
  if (!Array.isArray(legalMoves) || legalMoves.length < 1 || legalMoves.length > MAX_LEGAL_MOVES) {
    return { ok: false, reason: '合法着法列表无效' };
  }
  if (!legalMoves.every((move) => typeof move === 'string' && isUcciMove(move))) {
    return { ok: false, reason: '合法着法里有无法识别的着法' };
  }
  const notes = Array.isArray(recentNotation) ? recentNotation : [];
  if (notes.length > 30 || notes.some((item) => typeof item !== 'string' || item.length > 32)) {
    return { ok: false, reason: '近期棋谱无效' };
  }
  return {
    ok: true,
    value: {
      matchId,
      fen,
      sideToMove,
      legalMoves: [...new Set(legalMoves)],
      recentNotation: notes,
      turnId,
    },
  };
}

/** 模型着法必须落在本回合提交的合法列表里。不在列表中就拒绝。 */
export function acceptModelMove(ucci: string, legalMoves: readonly string[]): boolean {
  return isUcciMove(ucci) && legalMoves.includes(ucci);
}
