import { beforeEach, describe, expect, it } from 'vitest';
import { Monster, type MonsterHitOutcome } from '@core/monster/Monster';
import type { MonsterHitbox } from '@core/monster/MonsterCombat';
import { createDamageResult, type DamageResult } from '@core/combat/DamageSystem';
import { loadBalance, loadValgaron } from '@data/DataRegistry';
import type { MonsterDefinition } from '@data/schemas/monster';
import type { HeightProvider } from '@core/world/Terrain';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance().combat;
const def = loadValgaron();
const flat: HeightProvider = { getHeight: () => 0 };
const attack = (id: string) => def.attacks.find((a) => a.id === id)!;

function damage(total: number, overrides: Partial<DamageResult> = {}): DamageResult {
  const r = createDamageResult();
  r.total = total;
  r.partDamage = total;
  r.damageType = 'slash';
  Object.assign(r, overrides);
  return r;
}

function outcome(): MonsterHitOutcome {
  return { broke: false, severed: false, flinched: false, died: false, stunned: false, enraged: false, toppled: false };
}

describe('Part break effects', () => {
  let monster: Monster;

  beforeEach(() => {
    monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
  });

  it('breaking the head weakens charge and bite damage', () => {
    expect(monster.attackDamageMultiplier('vg_charge')).toBe(1);
    monster.applyHit('head', damage(monster.getPart('head').def.partHp, { flinchDamage: 0 }), outcome());
    expect(monster.getPart('head').isBroken).toBe(true);
    expect(monster.attackDamageMultiplier('vg_charge')).toBeCloseTo(0.7);
    expect(monster.attackDamageMultiplier('vg_bite')).toBeCloseTo(0.85);
    expect(monster.attackDamageMultiplier('vg_claw')).toBe(1);
    expect(monster.totalAttackDamageMultiplier('vg_charge')).toBeCloseTo(0.7);
  });

  it('severing the tail shrinks the tail sweep hitboxes', () => {
    const target = new Vec3(0, 0, 10); // 背後
    const tail = attack('vg_tail_sweep');
    const out: MonsterHitbox[] = [];

    monster.combat.startAttack(tail, target);
    for (let i = 0; i < Math.round((tail.telegraphSeconds + tail.startupSeconds) / DT) + 1; i++) monster.update(DT, target);
    const before = monster.combat.getActiveHitboxes(out).map((h) => ({ z: h.center.z, r: h.radius }));
    expect(before.length).toBe(tail.hitboxes.length);
    monster.combat.reset();

    monster.applyHit('tail', damage(monster.getPart('tail').def.partHp, { flinchDamage: 0 }), outcome());
    expect(monster.getPart('tail').isSevered).toBe(true);
    monster.combat.reset();
    monster.combat.startAttack(tail, target);
    for (let i = 0; i < Math.round((tail.telegraphSeconds + tail.startupSeconds) / DT) + 1; i++) monster.update(DT, target);
    const after = monster.combat.getActiveHitboxes(out).map((h) => ({ z: h.center.z, r: h.radius }));
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!.r).toBeCloseTo(before[i]!.r * 0.6);
      expect(Math.abs(after[i]!.z)).toBeLessThan(Math.abs(before[i]!.z) + 1e-6);
    }
  });

  it('leg flinch topples the monster, and a broken foreleg lowers the topple threshold', () => {
    const leg = monster.getPart('foreleg_l');
    const o = outcome();
    monster.applyHit('foreleg_l', damage(1, { partDamage: 0, flinchDamage: leg.effectiveFlinchThreshold }), o);
    expect(o.toppled).toBe(true);
    expect(monster.combat.state).toBe('toppled');

    const fresh = new Monster('f', def, balance, flat);
    const legR = fresh.getPart('foreleg_r');
    const baseThreshold = legR.effectiveFlinchThreshold;
    fresh.applyHit('foreleg_l', damage(fresh.getPart('foreleg_l').def.partHp, { flinchDamage: 0 }), outcome());
    expect(fresh.getPart('foreleg_l').isBroken).toBe(true);
    expect(legR.effectiveFlinchThreshold).toBeCloseTo(baseThreshold * 0.7);
    expect(fresh.getPart('head').thresholdMultiplier).toBe(1);
  });

  it('disableAttack effect removes the attack from selection', () => {
    const modified: MonsterDefinition = structuredClone(def);
    const head = modified.parts.find((p) => p.id === 'head')!;
    head.breakEffects = [{ kind: 'disableAttack', attackId: 'vg_rock_throw' }];
    const m = new Monster('d', modified, balance, flat);
    m.teleport(0, 0, Math.PI);
    const rock = attack('vg_rock_throw');
    expect(m.combat.canUse(rock, 20, 0)).toBe(true);
    m.applyHit('head', damage(head.partHp, { flinchDamage: 0 }), outcome());
    m.combat.reset();
    expect(m.isAttackDisabledByBreak('vg_rock_throw')).toBe(true);
    expect(m.combat.canUse(rock, 20, 0)).toBe(false);
  });

  it('reset clears break effects', () => {
    monster.applyHit('head', damage(monster.getPart('head').def.partHp, { flinchDamage: 0 }), outcome());
    monster.reset();
    expect(monster.attackDamageMultiplier('vg_charge')).toBe(1);
    expect(monster.getPart('head').isBroken).toBe(false);
  });
});
