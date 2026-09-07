import { describe, expect, it } from 'vitest';
import { fadeSeconds, layerTargets } from '@audio/Music';
import { ambienceTargets } from '@audio/Ambience';
import { randomPitch, SFX } from '@audio/Sfx';

describe('music layer targets', () => {
  it('explore keeps drums silent and combat brings them in with heat', () => {
    expect(layerTargets('explore').drums).toBe(0);
    const calm = layerTargets('combat', 0);
    const enraged = layerTargets('combat', 1);
    expect(calm.drums).toBeGreaterThan(0);
    expect(enraged.drums).toBeGreaterThan(calm.drums);
    expect(enraged.strings).toBeGreaterThan(calm.strings);
  });
  it('none silences every layer and resolve drops the pulse', () => {
    expect(Object.values(layerTargets('none')).every((v) => v === 0)).toBe(true);
    expect(layerTargets('resolve').pulse).toBe(0);
  });
  it('fades out of combat slowly and into resolve quickly', () => {
    expect(fadeSeconds('combat', 'explore')).toBeGreaterThan(fadeSeconds('explore', 'combat'));
    expect(fadeSeconds('combat', 'resolve')).toBeLessThan(1);
  });
});

describe('ambience targets', () => {
  it('river has water, cave has no insects, rain silences insects', () => {
    expect(ambienceTargets('river', false).water).toBeGreaterThan(0);
    expect(ambienceTargets('cave', false).insects).toBe(0);
    expect(ambienceTargets('forest', false).insects).toBeGreaterThan(0);
    expect(ambienceTargets('forest', true).insects).toBe(0);
    expect(ambienceTargets('forest', true).rain).toBeGreaterThan(ambienceTargets('cave', true).rain);
  });
});

describe('sfx definitions', () => {
  it('pitch variation stays inside the declared range', () => {
    expect(randomPitch(0.1, () => 1)).toBeCloseTo(1.1);
    expect(randomPitch(0.1, () => 0)).toBeCloseTo(0.9);
    expect(randomPitch(0, () => 0.3)).toBe(1);
  });
  it('never uses square waves (stone, bone and hide, not chiptune)', () => {
    for (const def of Object.values(SFX)) {
      for (const layer of def.layers) {
        if (layer.kind === 'tone') expect(layer.type).not.toBe('square');
        expect(layer.seconds).toBeGreaterThan(0);
        expect(layer.gain).toBeGreaterThan(0);
      }
    }
  });
  it('hits are short and the logo is about two seconds', () => {
    const longest = (id: keyof typeof SFX): number => Math.max(...SFX[id].layers.map((l) => (l.kind === 'tone' ? (l.delay ?? 0) : 0) + l.seconds));
    expect(longest('hitLight')).toBeLessThan(0.15);
    expect(longest('hitHeavy')).toBeLessThan(0.35);
    expect(longest('logo')).toBeGreaterThanOrEqual(1.8);
    expect(longest('logo')).toBeLessThanOrEqual(2.2);
  });
});
