import { describe, expect, it } from 'vitest';
import { parseUcciMove, squareToUcci, ucciToSquare } from '../src/domain/coordinates.ts';

describe('UCCI 坐标', () => {
  it('红方底线左侧是 a0，对应内部第 9 行第 0 列', () => {
    expect(squareToUcci({ row: 9, col: 0 })).toBe('a0');
    expect(ucciToSquare('a0')).toEqual({ row: 9, col: 0 });
  });

  it('黑方底线右侧是 i9，对应内部第 0 行第 8 列', () => {
    expect(squareToUcci({ row: 0, col: 8 })).toBe('i9');
    expect(ucciToSquare('i9')).toEqual({ row: 0, col: 8 });
  });

  it('解析四字符着法', () => {
    expect(parseUcciMove('h2e2')).toEqual({
      from: { row: 7, col: 7 },
      to: { row: 7, col: 4 },
    });
  });

  it('拒绝棋盘外的坐标和残缺着法', () => {
    expect(() => squareToUcci({ row: 10, col: 0 })).toThrow(/超出棋盘/);
    expect(() => parseUcciMove('a0')).toThrow(/无效的 UCCI/);
  });
});
