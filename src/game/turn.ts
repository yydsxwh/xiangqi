import { legalUcciMoves, type MoveRecord } from '../domain/position.ts';
import type { PlayerMove, Side } from '../domain/types.ts';
import type { Player } from '../players/types.ts';
import { matchFen, seatForTurn, type MatchSnapshot } from './match.ts';

export interface MoveRequest {
  matchId: string;
  fen: string;
  sideToMove: Side;
  legalMoves: readonly string[];
  recentNotation: readonly string[];
  turnId: string;
}

export function moveRequestFor(match: MatchSnapshot): MoveRequest {
  return {
    matchId: match.id,
    fen: matchFen(match),
    sideToMove: match.position.sideToMove,
    legalMoves: legalUcciMoves(match.position),
    recentNotation: match.history.slice(-8).map((record: MoveRecord) => record.notation),
    turnId: `${match.id}:${match.history.length}:${match.position.sideToMove}`,
  };
}

export async function requestTurnMove(
  match: MatchSnapshot,
  players: ReadonlyMap<string, Player>,
): Promise<PlayerMove | null> {
  if (match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') {
    return null;
  }
  const seat = seatForTurn(match);
  const player = players.get(seat.playerId);
  if (!player) throw new Error(`座位上没有棋手: ${seat.playerId}`);
  return player.requestMove(moveRequestFor(match));
}
