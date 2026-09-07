import { describe, expect, it } from 'vitest';
import { FpsGovernor, lowerQuality, recommendQuality, resolveInitialQuality, type DeviceProfile } from '@presentation/render/QualityManager';

const base: DeviceProfile = { gpu: '', mobile: false, devicePixelRatio: 1, screenPixels: 1920 * 1080, cores: 8 };

describe('recommendQuality', () => {
  it('mobile and low-end GPUs start at low', () => {
    expect(recommendQuality({ ...base, mobile: true })).toBe('low');
    expect(recommendQuality({ ...base, gpu: 'Mali-G78' })).toBe('low');
    expect(recommendQuality({ ...base, gpu: 'Google SwiftShader' })).toBe('low');
  });
  it('discrete high-end GPUs start at high unless the screen is 4K+', () => {
    expect(recommendQuality({ ...base, gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11)' })).toBe('high');
    expect(recommendQuality({ ...base, gpu: 'AMD Radeon RX 6700 XT' })).toBe('high');
    expect(recommendQuality({ ...base, gpu: 'Apple M2' })).toBe('high');
    expect(recommendQuality({ ...base, gpu: 'NVIDIA GeForce RTX 4090', screenPixels: 5120 * 2880 })).toBe('mid');
  });
  it('integrated GPUs start at mid, low on high-DPI screens', () => {
    expect(recommendQuality({ ...base, gpu: 'Intel(R) Iris(R) Xe Graphics' })).toBe('mid');
    expect(recommendQuality({ ...base, gpu: 'ANGLE (AMD, AMD Radeon (TM) Graphics (0x000015E7) Direct3D11 vs_5_0 ps_5_0, D3D11)' })).toBe('mid');
    expect(recommendQuality({ ...base, gpu: 'Intel(R) UHD Graphics 620', screenPixels: 2560 * 1600 * 4 })).toBe('low');
  });
  it('unknown GPU falls back on cores and resolution', () => {
    expect(recommendQuality({ ...base, cores: 4 })).toBe('mid');
    expect(recommendQuality({ ...base, cores: 12 })).toBe('high');
    expect(recommendQuality({ ...base, cores: 12, screenPixels: 3840 * 2160 })).toBe('mid');
  });
});

describe('resolveInitialQuality', () => {
  it('URL parameter wins and locks auto adjustment', () => {
    expect(resolveInitialQuality(base, '?quality=low', 'high')).toEqual({ quality: 'low', locked: true });
  });
  it('ignores invalid values and falls back to storage then detection', () => {
    expect(resolveInitialQuality(base, '?quality=ultra', 'mid')).toEqual({ quality: 'mid', locked: false });
    expect(resolveInitialQuality({ ...base, mobile: true }, '', 'bogus')).toEqual({ quality: 'low', locked: false });
  });
});

describe('FpsGovernor', () => {
  const run = (g: FpsGovernor, fps: number, seconds: number): ('downgrade' | null)[] => {
    const out: ('downgrade' | null)[] = [];
    const dt = 1 / fps;
    for (let t = 0; t < seconds; t += dt) out.push(g.sample(dt));
    return out;
  };
  it('does nothing while FPS stays above the threshold', () => {
    const g = new FpsGovernor(3, 55, 10);
    expect(run(g, 60, 7).filter(Boolean)).toHaveLength(0);
    expect(g.averageFps).toBeCloseTo(60, 0);
  });
  it('asks for one downgrade per cooldown when FPS is low', () => {
    const g = new FpsGovernor(3, 55, 10);
    const votes = run(g, 40, 12).filter(Boolean);
    // 3 秒で 1 回目、クールダウン 10 秒後（t≈12〜15 秒）は範囲外なので 1 回だけ
    expect(votes).toHaveLength(1);
    expect(run(g, 40, 6).filter(Boolean)).toHaveLength(1);
  });
  it('drops the window on a huge frame delta (tab switch)', () => {
    const g = new FpsGovernor(3, 55, 10);
    run(g, 40, 2.5);
    expect(g.sample(1.0)).toBeNull();
    expect(run(g, 40, 2.5).filter(Boolean)).toHaveLength(0);
  });
});

describe('lowerQuality', () => {
  it('steps down and stops at low', () => {
    expect(lowerQuality('high')).toBe('mid');
    expect(lowerQuality('mid')).toBe('low');
    expect(lowerQuality('low')).toBeNull();
  });
});
