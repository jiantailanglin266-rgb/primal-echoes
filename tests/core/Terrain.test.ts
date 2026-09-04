import { describe, expect, it } from 'vitest';
import { ProceduralTerrain } from '@core/world/Terrain';
import { loadDevTerrain } from '@data/DataRegistry';
import { Vec3 } from '@shared/math/Vec3';

describe('ProceduralTerrain', () => {
  const terrain = new ProceduralTerrain(loadDevTerrain());

  it('is flat inside the base camp radius', () => {
    const r = terrain.data.flatRadius * 0.9;
    expect(terrain.getHeight(0, 0)).toBeCloseTo(0, 10);
    expect(terrain.getHeight(r, 0)).toBeCloseTo(0, 10);
    expect(terrain.getHeight(0, -r)).toBeCloseTo(0, 10);
  });

  it('has relief outside the blend zone', () => {
    const far = terrain.data.flatRadius + terrain.data.flatBlendWidth + 30;
    let maxAbs = 0;
    for (let i = 0; i < 50; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(terrain.getHeight(far + i * 0.7, far - i * 0.3)));
    }
    expect(maxAbs).toBeGreaterThan(0.1);
  });

  it('clamps positions to bounds', () => {
    const p = new Vec3(1000, 0, -1000);
    terrain.clampToBounds(p, 1);
    expect(p.x).toBe(terrain.halfSize - 1);
    expect(p.z).toBe(-(terrain.halfSize - 1));
  });

  it('returns unit normals pointing mostly up', () => {
    const n = terrain.getNormal(40, 40);
    expect(n.length()).toBeCloseTo(1);
    expect(n.y).toBeGreaterThan(0.5);
  });
});
