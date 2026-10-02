import { describe, expect, it } from 'vitest';
import { createInitialPosition, legalUcciMoves, playUcci } from '../src/domain/position.ts';
import { PikafishPlayer } from '../src/players/pikafish-player.ts';
import { moveRequestFor } from '../src/game/turn.ts';
import type { MatchSnapshot } from '../src/game/match.ts';

function snapshot(side: 'red' | 'black'): MatchSnapshot {
  const position = createInitialPosition();
  return {
    id: 'engine-match',
    mode: 'human-vs-engine',
    position,
    history: [],
    status: 'ongoing',
    subStatus: null,
    seats: {
      red: { playerId: 'red', kind: side === 'red' ? 'pikafish' : 'human', name: '红' },
      black: { playerId: 'black', kind: side === 'black' ? 'pikafish' : 'human', name: '黑' },
    },
  };
}

describe('Pikafish 对局边界', () => {
  it('从初始局面连续 30 个回合都落在合法着法里', async () => {
    let position = createInitialPosition();
    const player = new PikafishPlayer('pikafish', {
      bestMove: async (input) => input.legalMoves?.[0] ?? null,
    });
    for (let ply = 0; ply < 30; ply += 1) {
      const legal = legalUcciMoves(position);
      expect(legal.length).toBeGreaterThan(0);
      const request = moveRequestFor({
        ...snapshot(position.sideToMove),
        position,
      });
      const move = await player.requestMove(request);
      expect(move?.ucci && legal.includes(move.ucci)).toBe(true);
      const played = playUcci(position, move!.ucci, { playerKind: 'pikafish', ply: ply + 1 });
      expect(played.ok).toBe(true);
      if (!played.ok) break;
      position = played.position;
      if (played.end.status === 'checkmate' || played.end.status === 'stalemate') break;
    }
    expect(position).toBeTruthy();
  });

  it('红方和黑方都能把引擎着法走下去', () => {
    for (const side of ['red', 'black'] as const) {
      let position = createInitialPosition();
      if (side === 'black') {
        const first = legalUcciMoves(position)[0];
        const played = playUcci(position, first, { playerKind: 'human', ply: 1 });
        expect(played.ok).toBe(true);
        if (played.ok) position = played.position;
      }
      expect(position.sideToMove).toBe(side);
      const ucci = legalUcciMoves(position)[0];
      const played = playUcci(position, ucci, { playerKind: 'pikafish', ply: 2 });
      expect(played.ok).toBe(true);
    }
  });
});
