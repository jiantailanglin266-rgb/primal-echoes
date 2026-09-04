import { beforeEach, describe, expect, it } from 'vitest';
import { Monster, type MonsterHitOutcome } from '@core/monster/Monster';
import { MonsterAI } from '@core/monster/MonsterAI';
import { monsterAttackTotalSeconds } from '@core/monster/MonsterCombat';
import { createDamageResult, type DamageResult } from '@core/combat/DamageSystem';
import { loadBalance, loadValgaron } from '@data/DataRegistry';
import type { HeightProvider } from '@core/world/Terrain';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance().combat;
const def = loadValgaron();
const flat: HeightProvider = { getHeight: () => 0 };

function damage(total: number): DamageResult {
  const r = createDamageResult();
  r.total = total;
  r.partDamage = 0;
  r.flinchDamage = 0;
  return r;
}

function outcome(): MonsterHitOutcome {
  return { broke: false, severed: false, flinched: false, died: false, stunned: false, enraged: false };
}

function stepFor(monster: Monster, seconds: number, target = new Vec3(0, 0, -10)): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) monster.update(DT, target);
}

describe('MonsterCondition - enrage', () => {
  let monster: Monster;

  beforeEach(() => {
    monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
  });

  it('enrages once accumulated damage reaches the trigger and roars', () => {
    const o = outcome();
    monster.applyHit('body', damage(def.enrage.damageToTrigger - 10), o);
    expect(o.enraged).toBe(false);
    expect(monster.condition.isEnraged).toBe(false);
    monster.applyHit('body', damage(10), o);
    expect(o.enraged).toBe(true);
    expect(monster.condition.isEnraged).toBe(true);
    expect(monster.combat.state).toBe('roar');
    stepFor(monster, def.enrage.roarSeconds + DT);
    expect(monster.combat.state).toBe('idle');
  });

  it('applies enrage multipliers and weak-part hit zone', () => {
    monster.forceEnrage();
    const c = monster.condition;
    expect(c.damageMultiplier).toBe(def.enrage.damageMultiplier);
    expect(c.speedMultiplier).toBe(def.enrage.speedMultiplier);
    expect(c.staminaCostMultiplier).toBe(def.enrage.staminaCostMultiplier);
    expect(c.attackIntervalMultiplier).toBe(def.enrage.attackIntervalMultiplier);
    expect(c.hitZoneMultiplierFor('head')).toBe(def.enrage.weakPartHitZoneMultiplier);
    expect(c.hitZoneMultiplierFor('body')).toBe(1);
  });

  it('ends after the duration and cannot re-trigger during cooldown', () => {
    monster.forceEnrage();
    stepFor(monster, def.enrage.durationSeconds + DT);
    expect(monster.condition.isEnraged).toBe(false);
    expect(monster.condition.enrageCooldownRemaining).toBeGreaterThan(0);
    const o = outcome();
    monster.applyHit('body', damage(def.enrage.damageToTrigger * 2), o);
    expect(o.enraged).toBe(false);
    stepFor(monster, def.enrage.cooldownSeconds + DT);
    monster.applyHit('body', damage(1), o);
    expect(o.enraged).toBe(true);
  });

  it('speeds up the attack timeline while enraged', () => {
    const bite = def.attacks.find((a) => a.id === 'vg_bite')!;
    const target = new Vec3(0, 0, -10);
    const normal = new Monster('n', def, balance, flat);
    normal.teleport(0, 0, Math.PI);
    normal.combat.startAttack(bite, target);
    let normalSteps = 0;
    while (normal.combat.state === 'attacking') {
      normal.update(DT, target);
      normalSteps++;
    }

    monster.forceEnrage();
    stepFor(monster, def.enrage.roarSeconds + DT);
    monster.combat.startAttack(bite, target);
    let enragedSteps = 0;
    while (monster.combat.state === 'attacking') {
      monster.update(DT, target);
      enragedSteps++;
    }
    expect(enragedSteps).toBeLessThan(normalSteps);
    expect(enragedSteps * def.enrage.speedMultiplier).toBeCloseTo(normalSteps, -1);
    expect(monsterAttackTotalSeconds(bite)).toBeCloseTo(normalSteps * DT, 1);
  });
});

describe('MonsterCondition - exhaustion', () => {
  let monster: Monster;

  beforeEach(() => {
    monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
  });

  it('becomes exhausted when stamina drops below the threshold and recovers later', () => {
    // 閾値ちょうどだと同ステップの自然回復で上回るため、少し下に置く
    monster.stats.stamina = def.exhaustion.staminaThreshold - 1;
    const r = monster.update(DT, new Vec3());
    expect(r.exhaustionStarted).toBe(true);
    expect(monster.condition.isExhausted).toBe(true);
    expect(monster.condition.speedMultiplier).toBe(def.exhaustion.speedMultiplier);
    expect(monster.condition.isAttackDisabled('vg_charge')).toBe(true);
    expect(monster.condition.isAttackDisabled('vg_bite')).toBe(false);

    const secondsToRecover = (def.exhaustion.recoverToStamina - def.exhaustion.staminaThreshold) / def.exhaustion.exhaustedRegenPerSecond;
    stepFor(monster, secondsToRecover + 0.5);
    expect(monster.condition.isExhausted).toBe(false);
  });

  it('exhaustion cancels enrage', () => {
    monster.forceEnrage();
    monster.stats.stamina = 0;
    const r = monster.update(DT, new Vec3());
    expect(r.exhaustionStarted).toBe(true);
    expect(r.enrageEnded).toBe(true);
    expect(monster.condition.isEnraged).toBe(false);
  });

  it('does not regenerate stamina while attacking', () => {
    const bite = def.attacks.find((a) => a.id === 'vg_bite')!;
    monster.stats.stamina = 50;
    monster.combat.startAttack(bite, new Vec3(0, 0, -10));
    const after = monster.stats.stamina;
    stepFor(monster, 0.5);
    expect(monster.stats.stamina).toBeCloseTo(after, 5);
  });

  it('AI never picks disabled attacks while exhausted', () => {
    monster.stats.stamina = 0;
    monster.update(DT, new Vec3());
    expect(monster.condition.isExhausted).toBe(true);
    const ai = new MonsterAI(monster, new Random(11));
    const target = new Vec3(0, 0, -20); // far: 通常なら突進/投石が候補
    const chosen = new Set<string>();
    for (let i = 0; i < 60 * 30; i++) {
      ai.update(DT, target);
      monster.update(DT, target);
      if (ai.lastChosenAttackId) chosen.add(ai.lastChosenAttackId);
      monster.stats.stamina = 0; // 疲労を維持
      monster.teleport(0, 0, Math.PI); // 距離を維持
    }
    for (const id of def.exhaustion.disabledAttackIds) expect(chosen.has(id)).toBe(false);
  });
});
