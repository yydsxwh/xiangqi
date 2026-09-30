import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canUseOpenAI } from '../src/permissions/access.ts';
import { handleOpenAIMoveRequest, OPENAI_MOVE_ROUTE } from '../src/server/openai-move.ts';

describe('OpenAI 服务端闸门', () => {
  it('路由固定在我们自己的服务端', () => {
    expect(OPENAI_MOVE_ROUTE).toBe('/api/matches/:matchId/ai/openai');
  });

  it('未登录与匿名用户返回 401', () => {
    expect(handleOpenAIMoveRequest(null)).toMatchObject({ ok: false, status: 401 });
    expect(handleOpenAIMoveRequest({ userId: 'guest', role: 'ANONYMOUS' })).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('普通用户返回 403', () => {
    expect(canUseOpenAI('USER')).toBe(false);
    expect(handleOpenAIMoveRequest({ userId: 'u1', role: 'USER' })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('站长通过角色检查，但本轮仍不调用模型', () => {
    expect(canUseOpenAI('SUPER_ADMIN')).toBe(true);
    expect(handleOpenAIMoveRequest({ userId: 'owner', role: 'SUPER_ADMIN' })).toEqual({
      ok: false,
      status: 501,
      reason: 'OpenAI 接入尚未启用',
    });
  });

  it('棋手与棋盘源码不包含 OpenAI 的地址或密钥入口', () => {
    const openaiPlayer = readFileSync(new URL('../src/players/openai-player.ts', import.meta.url), 'utf8');
    const board = readFileSync(new URL('../src/ui/board-view.ts', import.meta.url), 'utf8');
    const pikafish = readFileSync(new URL('../src/players/pikafish-player.ts', import.meta.url), 'utf8');

    expect(openaiPlayer).not.toMatch(/api\.openai\.com/);
    expect(openaiPlayer).not.toMatch(/sk-/);
    expect(board).not.toMatch(/openai/i);
    expect(board).not.toMatch(/pikafish/i);
    expect(pikafish).not.toMatch(/\.wasm/);
    expect(pikafish).not.toMatch(/xiangqiai\.com/);
  });
});
