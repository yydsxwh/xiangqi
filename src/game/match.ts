import type { Side } from '../domain/types.ts';

export const MATCH_MODES = ['human-vs-human', 'human-vs-ai', 'ai-vs-ai', 'online'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const MATCH_STATUSES = ['ongoing', 'check', 'checkmate', 'stalemate', 'draw'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** 对局快照。座位只保存棋手 id，不保存某种 AI 的私有参数。 */
export interface MatchSnapshot {
  id: string;
  mode: MatchMode;
  fen: string;
  turn: Side;
  seats: Record<Side, string>;
  status: MatchStatus;
  history: readonly string[];
}

export function seatForTurn(match: MatchSnapshot): string {
  return match.seats[match.turn];
}
