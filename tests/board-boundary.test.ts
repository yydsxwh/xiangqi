import { describe, expect, it } from 'vitest';
import { START_FEN } from '../src/domain/types.ts';
import { createBoardViewModel } from '../src/ui/board-view.ts';

describe('棋盘视图边界', () => {
  it('只保存外面给来的局面和落点', () => {
    const model = createBoardViewModel({
      fen: START_FEN,
      orientation: 'black',
      turn: 'red',
      destinations: { b2: ['b3', 'e2'] },
      lastMove: ['a3', 'a4'],
      check: null,
      hintArrow: ['h2', 'e2'],
      interactive: true,
    });

    expect(model.orientation).toBe('black');
    expect(model.destinations.b2).toEqual(['b3', 'e2']);
    expect(model.hintArrow).toEqual(['h2', 'e2']);
    expect(model).not.toHaveProperty('player');
    expect(model).not.toHaveProperty('role');
  });
});
