import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialPosition, fenOf, legalUcciMoves } from '../src/domain/position.ts';
import { createTurnLock, turnKey } from '../src/openai/lock.ts';
import { acceptModelMove, parseOpenAIMoveBody } from '../src/openai/validate.ts';
import { CLOUD_AI_MOVE_ROUTE, OPENAI_MOVE_ROUTE } from '../src/server/openai-move.ts';

describe('OpenAI 请求校验', () => {
  const position = createInitialPosition();
  const legalMoves = legalUcciMoves(position);

  it('只请求主站同域路径', () => {
    expect(CLOUD_AI_MOVE_ROUTE).toBe('/api/games/xiangqi/ai-move');
    expect(OPENAI_MOVE_ROUTE).toBe('/api/games/xiangqi/openai-move');
  });

  it('拒绝坏掉的 FEN，并要求行棋方一致', () => {
    expect(parseOpenAIMoveBody({ fen: 'nope', sideToMove: 'red', legalMoves, turnId: 't', matchId: 'm' }).ok).toBe(false);
    const flipped = parseOpenAIMoveBody({
      fen: fenOf(position).replace(' w ', ' b '),
      sideToMove: 'red',
      legalMoves,
      turnId: 't',
      matchId: 'm',
    });
    expect(flipped.ok).toBe(false);
  });

  it('模型着法必须在合法列表中', () => {
    expect(acceptModelMove(legalMoves[0] ?? '', legalMoves)).toBe(true);
    expect(acceptModelMove('a0i9', legalMoves)).toBe(false);
    expect(acceptModelMove('炮飞出界', legalMoves)).toBe(false);
  });

  it('同一局面不能同时开始两次请求', () => {
    const lock = createTurnLock();
    const key = turnKey('m', fenOf(position));
    expect(lock.tryBegin(key, 'a')).toBe(true);
    expect(lock.tryBegin(key, 'b')).toBe(false);
    lock.finish(key, 'a');
    expect(lock.tryBegin(key, 'b')).toBe(true);
  });

  it('棋盘和棋手源码不包含密钥或直连地址', () => {
    const board = readFileSync(new URL('../src/ui/XiangqiBoard.tsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../src/ui/MatchApp.tsx', import.meta.url), 'utf8');
    const player = readFileSync(new URL('../src/players/cloud-ai-player.ts', import.meta.url), 'utf8');
    expect(board + app + player).not.toMatch(/sk-/);
    expect(board + app + player).not.toMatch(/OPENAI_API_KEY/);
    expect(app).not.toMatch(/openai-move/);
    expect(player).not.toMatch(/api\.openai\.com/);
  });
});
