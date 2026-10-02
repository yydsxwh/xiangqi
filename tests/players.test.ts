import { describe, expect, it } from 'vitest';
import { createInitialPosition } from '../src/domain/position.ts';
import { moveRequestFor, requestTurnMove } from '../src/game/turn.ts';
import type { MatchSnapshot } from '../src/game/match.ts';
import { createPlayer } from '../src/players/create-player.ts';
import { FutureAIPlayer } from '../src/players/future-ai-player.ts';
import { HumanPlayer } from '../src/players/human-player.ts';
import { LocalAIPlayer } from '../src/players/local-ai-player.ts';
import { CloudAIPlayer } from '../src/players/cloud-ai-player.ts';
import { OpenAIPlayer } from '../src/players/openai-player.ts';
import { PikafishPlayer } from '../src/players/pikafish-player.ts';

function match(side: 'red' | 'black' = 'red'): MatchSnapshot {
  const position = createInitialPosition();
  position.sideToMove = side;
  return {
    id: 'm1',
    mode: 'human-vs-local',
    position,
    seats: {
      red: { playerId: 'human-red', kind: 'human', name: '我' },
      black: { playerId: 'engine-black', kind: 'local-ai', name: '本地 AI' },
    },
    history: [],
    status: 'ongoing',
    subStatus: null,
  };
}

describe('棋手抽象', () => {
  it('人类棋手等人提交，新的请求会取消上一手', async () => {
    const human = new HumanPlayer('human-red');
    const request = moveRequestFor(match());
    const first = human.requestMove(request);
    const second = human.requestMove(request);
    human.submit({ ucci: 'h2e2' });
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual({ ucci: 'h2e2' });
  });

  it('回合导演按座位询问对应棋手', async () => {
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

  it('云端棋手把合法着法交给 transport', async () => {
    const seen: string[] = [];
    const player = new CloudAIPlayer('cloud-red', {
      requestMove: async (input) => {
        seen.push(input.turnId);
        expect(input.legalMoves.length).toBeGreaterThan(0);
        return { ucci: input.legalMoves[0] ?? 'h2e2' };
      },
    });
    const request = moveRequestFor(match());
    await expect(player.requestMove(request)).resolves.toMatchObject({ ucci: expect.any(String) });
    expect(seen).toEqual([request.turnId]);
  });

  it('Pikafish 棋手只接收外部进程返回的着法', async () => {
    const player = new PikafishPlayer('pikafish-black', {
      bestMove: async () => 'h7e7',
    });
    expect(player.distribution).toBe('external-process');
    await expect(player.requestMove(moveRequestFor(match('black')))).resolves.toEqual({ ucci: 'h7e7' });
  });

  it('尚未实现的棋手会失败', async () => {
    const player = new FutureAIPlayer('next', 'custom-net');
    await expect(player.requestMove(moveRequestFor(match()))).rejects.toThrow(/尚未实现/);
  });

  it('工厂可以造出云端棋手和旧入口', () => {
    expect(createPlayer({ kind: 'human', id: 'h' })).toBeInstanceOf(HumanPlayer);
    expect(createPlayer({
      kind: 'local-ai',
      id: 'l',
      difficulty: 'master',
      engine: { findMove: async () => null },
    })).toBeInstanceOf(LocalAIPlayer);
    expect(createPlayer({
      kind: 'cloud-ai',
      id: 'c',
      transport: { requestMove: async () => null },
    })).toBeInstanceOf(CloudAIPlayer);
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
