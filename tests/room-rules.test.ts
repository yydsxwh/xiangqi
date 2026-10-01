import { describe, expect, it } from 'vitest';
import { commitMove, emptyRoom } from '../server/rules.mjs';

describe('联网房间规则', () => {
  it('红方可以走炮二平五，黑方不能抢先', () => {
    const room = emptyRoom();
    expect(commitMove(room, 'h2e2', 'black').ok).toBe(false);
    const played = commitMove(room, 'h2e2', 'red');
    expect(played.ok).toBe(true);
    expect('moves' in played && played.moves).toEqual(['h2e2']);
    expect('side' in played && played.side).toBe('black');
  });

  it('拒绝非法着法，棋局步数不变', () => {
    const room = emptyRoom();
    const rejected = commitMove(room, 'a0b0', 'red');
    expect(rejected.ok).toBe(false);
    expect(room.moves).toEqual([]);
  });
});
