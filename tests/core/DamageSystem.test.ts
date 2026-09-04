import { describe, expect, it } from 'vitest';
import { computeDamage, type DamageInput } from '@core/combat/DamageSystem';

const baseInput = (): DamageInput => ({
  weaponPower: 100,
  motionValue: 0.5,
  motionValueMultiplier: 1,
  damageType: 'slash',
  elementType: 'none',
  elementPower: 0,
  elementMotionValue: 0,
  sharpnessPhysicalModifier: 1,
  sharpnessElementModifier: 1,
  critRate: 0,
  critMultiplier: 1.25,
  hitZone: { slash: 0.5, impact: 0.3, projectile: 0.4, fire: 0.2, water: 0.1, thunder: 0.15, ice: 0.1, aether: 0.3 },
  hitZoneMultiplier: 1,
  partDamageMultiplier: 1,
  stunDamage: 0,
  stunMultiplier: 0,
  flinchDamage: 10,
  minimumDamage: 1,
});

describe('computeDamage', () => {
  it('multiplies weapon power, motion value and hit zone', () => {
    const r = computeDamage(baseInput(), 0.99);
    expect(r.physical).toBeCloseTo(100 * 0.5 * 0.5);
    expect(r.total).toBe(25);
    expect(r.isCritical).toBe(false);
  });

  it('uses the hit zone matching the physical damage type', () => {
    const input = baseInput();
    input.damageType = 'impact';
    expect(computeDamage(input, 0.99).total).toBe(15);
  });

  it('applies sharpness and charge multipliers', () => {
    const input = baseInput();
    input.sharpnessPhysicalModifier = 1.2;
    input.motionValueMultiplier = 1.5;
    expect(computeDamage(input, 0.99).total).toBe(45);
  });

  it('applies the hit zone multiplier (enraged weak part) to physical and element', () => {
    const input = baseInput();
    input.hitZoneMultiplier = 1.3;
    input.elementType = 'fire';
    input.elementPower = 30;
    input.elementMotionValue = 1;
    const r = computeDamage(input, 0.99);
    expect(r.physical).toBeCloseTo(25 * 1.3);
    expect(r.element).toBeCloseTo(6 * 1.3);
  });

  it('rolls criticals against critRate', () => {
    const input = baseInput();
    input.critRate = 0.3;
    expect(computeDamage(input, 0.29).isCritical).toBe(true);
    expect(computeDamage(input, 0.29).total).toBe(Math.round(25 * 1.25));
    expect(computeDamage(input, 0.31).isCritical).toBe(false);
  });

  it('adds element damage separately using the element hit zone', () => {
    const input = baseInput();
    input.elementType = 'fire';
    input.elementPower = 30;
    input.elementMotionValue = 1;
    const r = computeDamage(input, 0.99);
    expect(r.element).toBeCloseTo(30 * 0.2);
    expect(r.total).toBe(31);
  });

  it('ignores element for elementless weapons', () => {
    const input = baseInput();
    input.elementType = 'none';
    input.elementPower = 999;
    input.elementMotionValue = 1;
    expect(computeDamage(input, 0.99).element).toBe(0);
  });

  it('enforces minimum damage and computes part / stun / flinch', () => {
    const input = baseInput();
    input.hitZone.slash = 0.001;
    input.partDamageMultiplier = 2;
    input.stunDamage = 10;
    input.stunMultiplier = 0.5;
    const r = computeDamage(input, 0.99);
    expect(r.total).toBe(1);
    expect(r.partDamage).toBe(2);
    expect(r.stunDamage).toBe(5);
    expect(r.flinchDamage).toBe(10);
  });
});
