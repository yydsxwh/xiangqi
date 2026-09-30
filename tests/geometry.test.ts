import { describe, expect, it } from 'vitest';
import { metricsForWidth, nearestSquare, squareCenter } from '../src/ui/geometry.ts';

describe('棋盘尺寸', () => {
  for (const width of [390, 412]) {
    it(`${width} 宽时交叉点可往返，并且不越出棋盘`, () => {
      const metrics = metricsForWidth(width);
      expect(metrics.width).toBeGreaterThanOrEqual(width);
      expect(metrics.height).toBeGreaterThan(metrics.width);
      for (let row = 0; row < 10; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          for (const flipped of [false, true]) {
            const center = squareCenter({ row, col }, metrics, flipped);
            expect(center.x).toBeGreaterThanOrEqual(0);
            expect(center.x).toBeLessThanOrEqual(metrics.width);
            expect(center.y).toBeGreaterThanOrEqual(0);
            expect(center.y).toBeLessThanOrEqual(metrics.height);
            expect(nearestSquare(center.x, center.y, metrics, flipped)).toEqual({ row, col });
          }
        }
      }
    });
  }
});
