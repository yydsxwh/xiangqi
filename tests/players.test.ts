import { describe, expect, it } from 'vitest';
import { START_FEN } from '../src/domain/types.ts';
import { requestTurnMove } from '../src/game/turn.ts';
import type { MatchSnapshot } from '../src/game/match.ts';
import { createPlayer } from '../src/players/create-player.ts';
import { FutureAIPlayer } from '../src/players/future-ai-player.ts';
import { HumanPlayer } from '../src/players/human-player.ts';
import { LocalAIPlayer } from '../src/players/local-ai-player.ts';
import { OpenAIPlayer } from '../src/players/openai-player.ts';
import { PikafishPlayer } from '../src/players/pikafish-player.ts';

function match(turn: 'red' | 'black' = 'red'): MatchSnapshot {
  return {
    id: 'm1',
    mode: 'human-vs-ai',
    fen: START_FEN,
    turn,
    seats: { red: 'human-red', black: 'engine-black' },
    status: 'ongoing',
    history: [],
  };
}

describe('棋手抽象', () => {
  it('人类棋手等人提交，新的请求会取消上一手', async () => {
    const human = new HumanPlayer('human-red');
    const first = human.requestMove({ matchId: 'm1', fen: START_FEN, turn: 'red' });
    const second = human.requestMove({ matchId: 'm1', fen: START_FEN, turn: 'red' });
    human.submit({ ucci: 'b2e2' });
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual({ ucci: 'b2e2' });
  });

  it('回合导演按座位询问对应棋手，不在棋盘里分支', async () => {
    const human = new HumanPlayer('human-red');
    const local = new LocalAIPlayer('engine-black', {
      findMove: async () => ({ ucci: 'b7e7' }),
    }, 'beginner');
    const players = new Map<string, HumanPlayer | LocalAIPlayer>([
      [human.id, human],
      [local.id, local],
    ]);

    const redMove = requestTurnMove(match('red'), players);
    human.submit({ ucci: 'h2e2' });
    await expect(redMove).resolves.toEqual({ ucci: 'h2e2' });

    await expect(requestTurnMove(match('black'), players)).resolves.toEqual({ ucci: 'b7e7' });
  });

  it('OpenAI 棋手只把局面交给 transport', async () => {
    const seen: Array<{ matchId: string; fen: string }> = [];
    const player = new OpenAIPlayer('openai-red', {
      requestMove: async (input) => {
        seen.push({ matchId: input.matchId, fen: input.fen });
        return { ucci: 'a3a4' };
      },
    });
    await expect(player.requestMove({ matchId: 'm9', fen: START_FEN, turn: 'red' })).resolves.toEqual({
      ucci: 'a3a4',
    });
    expect(seen).toEqual([{ matchId: 'm9', fen: START_FEN }]);
  });

  it('Pikafish 棋手只接收外部进程返回的着法', async () => {
    const player = new PikafishPlayer('pikafish-black', {
      bestMove: async () => 'h7e7',
    });
    expect(player.distribution).toBe('external-process');
    await expect(player.requestMove({ matchId: 'm1', fen: START_FEN, turn: 'black' })).resolves.toEqual({
      ucci: 'h7e7',
    });
  });

  it('尚未实现的棋手会失败，而不是返回空着', async () => {
    const player = new FutureAIPlayer('next', 'custom-net');
    await expect(player.requestMove({ matchId: 'm1', fen: START_FEN, turn: 'red' })).rejects.toThrow(/尚未实现/);
  });

  it('工厂可以造出五种棋手', () => {
    expect(createPlayer({ kind: 'human', id: 'h' })).toBeInstanceOf(HumanPlayer);
    expect(createPlayer({
      kind: 'local-ai',
      id: 'l',
      difficulty: 'master',
      engine: { findMove: async () => null },
    })).toBeInstanceOf(LocalAIPlayer);
    expect(createPlayer({
      kind: 'openai',
      id: 'o',
      transport: { requestMove: async () => null },
    })).toBeInstanceOf(OpenAIPlayer);
    expect(createPlayer({
      kind: 'pikafish',
      id: 'p',
      transport: { bestMove: async () => null },
    })).toBeInstanceOf(PikafishPlayer);
    expect(createPlayer({ kind: 'future', id: 'f', provider: 'later' })).toBeInstanceOf(FutureAIPlayer);
  });

  it('终局不再向棋手要着', async () => {
    const human = new HumanPlayer('human-red');
    const ended = { ...match(), status: 'checkmate' as const };
    await expect(requestTurnMove(ended, new Map([[human.id, human]]))).resolves.toBeNull();
  });
});
