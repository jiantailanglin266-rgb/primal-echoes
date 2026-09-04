import { describe, expect, it } from 'vitest';
import { Vec3 } from '@shared/math/Vec3';

describe('Vec3', () => {
  it('adds and scales in place', () => {
    const v = new Vec3(1, 2, 3).add(new Vec3(1, 1, 1)).scale(2);
    expect(v.equals(new Vec3(4, 6, 8))).toBe(true);
  });

  it('normalizes non-zero vectors and leaves zero vector untouched', () => {
    expect(new Vec3(3, 0, 4).normalize().length()).toBeCloseTo(1);
    const zero = Vec3.zero().normalize();
    expect(zero.length()).toBe(0);
    expect(Number.isNaN(zero.x)).toBe(false);
  });

  it('computes horizontal distance ignoring height', () => {
    const a = new Vec3(0, 10, 0);
    const b = new Vec3(3, -5, 4);
    expect(a.horizontalDistanceTo(b)).toBeCloseTo(5);
    expect(a.distanceTo(b)).toBeGreaterThan(5);
  });

  it('cross product follows right-hand rule', () => {
    const c = new Vec3(1, 0, 0).cross(new Vec3(0, 1, 0));
    expect(c.equals(new Vec3(0, 0, 1))).toBe(true);
  });

  it('clone does not alias', () => {
    const a = new Vec3(1, 1, 1);
    const b = a.clone().scale(5);
    expect(a.x).toBe(1);
    expect(b.x).toBe(5);
  });
});
