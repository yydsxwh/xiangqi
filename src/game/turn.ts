import type { PlayerMove, Side } from '../domain/types.ts';
import type { Player } from '../players/types.ts';
import { seatForTurn, type MatchSnapshot } from './match.ts';

export interface MoveRequest {
  matchId: string;
  fen: string;
  turn: Side;
}

export async function requestTurnMove(
  match: MatchSnapshot,
  players: ReadonlyMap<string, Player>,
): Promise<PlayerMove | null> {
  if (match.status === 'checkmate' || match.status === 'stalemate' || match.status === 'draw') {
    return null;
  }

  const playerId = seatForTurn(match);
  const player = players.get(playerId);
  if (!player) {
    throw new Error(`座位上没有棋手: ${playerId}`);
  }

  return player.requestMove({
    matchId: match.id,
    fen: match.fen,
    turn: match.turn,
  });
}
