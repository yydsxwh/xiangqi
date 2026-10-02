import type { Side } from '../domain/types.ts';
import type { EndKind, MoveRecord, Position } from '../domain/position.ts';
import { fenOf } from '../domain/position.ts';
import type { PlayerKind } from '../players/types.ts';

export const MATCH_MODES = ['human-vs-human', 'online-vs-human', 'human-vs-local', 'human-vs-cloud', 'human-vs-engine', 'human-vs-hybrid', 'openai-vs-human'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export interface SeatBinding {
  playerId: string;
  kind: PlayerKind;
  name: string;
}

/** 行棋方只放在 position 里。需要 FEN 时现算。 */
export interface MatchSnapshot {
  id: string;
  mode: MatchMode;
  position: Position;
  seats: Record<Side, SeatBinding>;
  history: readonly MoveRecord[];
  status: EndKind;
  subStatus: 'perpetual_check' | 'threefold' | null;
}

export function sideToMove(match: MatchSnapshot): Side {
  return match.position.sideToMove;
}

export function matchFen(match: MatchSnapshot): string {
  return fenOf(match.position);
}

export function seatForTurn(match: MatchSnapshot): SeatBinding {
  return match.seats[match.position.sideToMove];
}
