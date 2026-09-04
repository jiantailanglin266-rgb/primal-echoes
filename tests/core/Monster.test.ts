import { beforeEach, describe, expect, it } from 'vitest';
import { Monster, type MonsterHitOutcome } from '@core/monster/Monster';
import { createDamageResult, type DamageResult } from '@core/combat/DamageSystem';
import { loadBalance, loadValgaron } from '@data/DataRegistry';
import { sphereToShapeDistance } from '@core/combat/shapes';
import { findHitPart, type HitCandidate } from '@core/combat/HitDetection';
import type { MonsterPart } from '@core/monster/MonsterPart';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { Vec3 } from '@shared/math/Vec3';

const balance = loadBalance().combat;
const def = loadValgaron();

function damage(total: number, overrides: Partial<DamageResult> = {}): DamageResult {
  const r = createDamageResult();
  r.total = total;
  r.partDamage = total;
  r.damageType = 'slash';
  Object.assign(r, overrides);
  return r;
}

function outcome(): MonsterHitOutcome {
  return { broke: false, severed: false, flinched: false, died: false, stunned: false };
}

function hitboxAt(x: number, y: number, z: number, radius = 1): WorldHitbox {
  return {
    center: new Vec3(x, y, z),
    radius,
    source: {
      attack: def as never,
      instanceId: 1,
      elapsed: 0,
      chargeLevel: -1,
      motionValueMultiplier: 1,
      partDamageMultiplier: 1,
      hitStopSeconds: 0,
      hitKeys: new Set(),
    },
  };
}

describe('Monster parts', () => {
  let monster: Monster;

  beforeEach(() => {
    monster = new Monster('m1', def, balance);
  });

  it('breaks a breakable part when partHp reaches zero', () => {
    const head = monster.getPart('head');
    const o = outcome();
    monster.applyHit('head', damage(head.def.partHp - 1), o);
    expect(o.broke).toBe(false);
    monster.applyHit('head', damage(5), o);
    expect(o.broke).toBe(true);
    expect(head.state).toBe('broken');
    expect(monster.stats.hp).toBe(def.stats.maxHp - head.def.partHp - 4);
  });

  it('severs the tail only with slash damage', () => {
    const tail = monster.getPart('tail');
    const o = outcome();
    monster.applyHit('tail', damage(tail.def.partHp, { damageType: 'impact' }), o);
    expect(o.severed).toBe(false);
    expect(o.broke).toBe(true);
    expect(tail.state).toBe('broken');

    const fresh = new Monster('m2', def, balance);
    const o2 = outcome();
    fresh.applyHit('tail', damage(tail.def.partHp, { damageType: 'slash' }), o2);
    expect(o2.severed).toBe(true);
    expect(fresh.getPart('tail').isSevered).toBe(true);
  });

  it('does not track partHp for unbreakable parts', () => {
    const o = outcome();
    monster.applyHit('body', damage(9999), o);
    expect(o.broke).toBe(false);
    expect(monster.getPart('body').state).toBe('intact');
  });

  it('flinches when accumulated flinch reaches the threshold and raises the threshold', () => {
    const leg = monster.getPart('foreleg_l');
    const threshold = leg.def.flinchThreshold;
    const o = outcome();
    monster.applyHit('foreleg_l', damage(1, { partDamage: 0, flinchDamage: threshold - 1 }), o);
    expect(o.flinched).toBe(false);
    monster.applyHit('foreleg_l', damage(1, { partDamage: 0, flinchDamage: 1 }), o);
    expect(o.flinched).toBe(true);
    expect(leg.flinchThreshold).toBeCloseTo(threshold * balance.flinchThresholdGrowth);
    expect(leg.flinchAccumulated).toBe(0);
  });

  it('decays flinch accumulation over time', () => {
    const leg = monster.getPart('foreleg_l');
    monster.applyHit('foreleg_l', damage(1, { partDamage: 0, flinchDamage: 50 }), outcome());
    monster.update(1);
    expect(leg.flinchAccumulated).toBeCloseTo(50 - balance.flinchDecayPerSecond);
  });

  it('reports death and stun', () => {
    const o = outcome();
    monster.applyHit('head', damage(1, { partDamage: 0, stunDamage: def.stats.stunThreshold }), o);
    expect(o.stunned).toBe(true);
    monster.applyHit('body', damage(def.stats.maxHp), o);
    expect(o.died).toBe(true);
    expect(monster.isAlive).toBe(false);
  });
});

describe('HitDetection', () => {
  const monster = new Monster('m1', def, balance);
  monster.teleport(0, 0, 10, Math.PI); // プレイヤー（原点）の方を向く: 頭が -Z 側
  const candidate: HitCandidate = { part: null as unknown as MonsterPart, depth: 0, contact: new Vec3() };

  it('shape distance is negative when overlapping', () => {
    const shapes = monster.getWorldShapes();
    const head = shapes.find((s) => s.part.id === 'head')!;
    expect(sphereToShapeDistance(head.shape.a, 0.1, head.shape)).toBeLessThan(0);
    expect(sphereToShapeDistance(new Vec3(100, 0, 0), 0.1, head.shape)).toBeGreaterThan(0);
  });

  it('hits the head when the hitbox is in front of the facing monster', () => {
    const headOffset = def.parts.find((p) => p.id === 'head')!.shape;
    const z = headOffset.type === 'sphere' ? 10 - headOffset.offset.z : 0;
    const hit = findHitPart(hitboxAt(0, 2.0, z, 0.8), monster, candidate);
    expect(hit?.part.id).toBe('head');
    expect(hit?.contact.z).toBeLessThan(z + 1);
  });

  it('picks the most deeply overlapped part', () => {
    // 胴体中心付近: body と脚が重なるが body の方が深い
    const hit = findHitPart(hitboxAt(0, 1.9, 10, 0.5), monster, candidate);
    expect(hit?.part.id).toBe('body');
  });

  it('ignores severed parts and misses far away', () => {
    expect(findHitPart(hitboxAt(0, 2, -20, 1), monster, candidate)).toBeNull();
    const tailZ = 10 + 4; // tail は +Z 側（後方）
    expect(findHitPart(hitboxAt(0, 1.3, tailZ, 0.8), monster, candidate)?.part.id).toBe('tail');
    monster.getPart('tail').state = 'severed';
    expect(findHitPart(hitboxAt(0, 1.3, tailZ, 0.8), monster, candidate)).toBeNull();
  });
});
