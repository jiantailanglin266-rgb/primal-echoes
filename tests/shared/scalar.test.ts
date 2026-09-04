import { describe, expect, it } from 'vitest';
import { clamp, rotateTowards, wrapAngle } from '@shared/math/scalar';

describe('scalar math', () => {
  it('clamp bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('wrapAngle keeps angles in [-PI, PI)', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI * 0.5);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
  });

  it('rotateTowards takes the shortest path and respects max delta', () => {
    // 350度 -> 10度 は +20度 が最短
    const from = (350 * Math.PI) / 180;
    const to = (10 * Math.PI) / 180;
    const step = (5 * Math.PI) / 180;
    const result = rotateTowards(from, to, step);
    expect(wrapAngle(result - from)).toBeCloseTo(step);
    expect(rotateTowards(0, 0.1, 1)).toBeCloseTo(0.1);
  });
});
