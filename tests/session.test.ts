import { describe, expect, it } from 'vitest';
import { explainPlain } from '../src/domain/explain.ts';
import {
  createInitialPosition,
  fenOf,
  playUcci,
  replay,
} from '../src/domain/position.ts';

describe('局面', () => {
  it('开局只有红方行棋，FEN 与行棋方一致', () => {
    const position = createInitialPosition();
    expect(position.sideToMove).toBe('red');
    expect(fenOf(position).split(' ')[1]).toBe('w');
  });

  it('炮二平五会改变局面，悔棋回放后恢复', () => {
    const start = createInitialPosition();
    const before = fenOf(start);
    const played = playUcci(start, 'h2e2', { playerKind: 'human', ply: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.record.notation).toContain('平');
    expect(played.record.side).toBe('red');
    expect(played.position.sideToMove).toBe('black');
    expect(fenOf(played.position).split(' ')[1]).toBe('b');
    expect(explainPlain(played.record.notation, 'red')).toContain('横移');
    const restored = replay([]);
    expect(fenOf(restored.position)).toBe(before);
  });

  it('拒绝非法着法，原局面不变', () => {
    const start = createInitialPosition();
    const played = playUcci(start, 'a0b0', { playerKind: 'human', ply: 1 });
    expect(played.ok).toBe(false);
    expect(fenOf(start).split(' ')[1]).toBe('w');
  });

  it('翻转标记不在局面里，回放不改真实坐标', () => {
    const start = createInitialPosition();
    const played = playUcci(start, 'h2e2', { playerKind: 'human', ply: 1 });
    if (!played.ok) throw new Error('expected move');
    const again = replay([played.record]);
    expect(again.position.sideToMove).toBe('black');
    expect(fenOf(again.position).split('/')[7]).toContain('C');
  });
});
