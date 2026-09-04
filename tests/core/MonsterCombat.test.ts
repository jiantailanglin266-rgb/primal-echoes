import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Monster } from '@core/monster/Monster';
import { monsterAttackTotalSeconds, type MonsterHitbox } from '@core/monster/MonsterCombat';
import { MonsterAI } from '@core/monster/MonsterAI';
import { loadBalance, loadValgaron } from '@data/DataRegistry';
import type { HeightProvider } from '@core/world/Terrain';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import type { MonsterAttackDefinition } from '@data/schemas/monster';

type SpawnFn = (attack: MonsterAttackDefinition, origin: Vec3, target: Vec3) => void;

const DT = 1 / 60;
const balance = loadBalance().combat;
const def = loadValgaron();
const flat: HeightProvider = { getHeight: () => 0 };
const attack = (id: string) => {
  const a = def.attacks.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
};

function stepFor(monster: Monster, target: Vec3, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) monster.update(DT, target);
}

describe('MonsterCombat', () => {
  let monster: Monster;
  let spawn: ReturnType<typeof vi.fn<SpawnFn>>;
  const target = new Vec3(0, 0, -10);

  beforeEach(() => {
    spawn = vi.fn<SpawnFn>();
    monster = new Monster('m', def, balance, flat, { spawnProjectile: spawn });
    monster.teleport(0, 0, Math.PI); // -Z（ターゲット方向）を向く
  });

  it('runs telegraph -> startup -> active -> recovery and exposes hitboxes only in active', () => {
    const bite = attack('vg_bite');
    monster.combat.startAttack(bite, target);
    const out: MonsterHitbox[] = [];
    const seen = new Set<string>();
    let activeFrames = 0;
    while (monster.combat.state === 'attacking') {
      const phase = monster.combat.phase;
      if (phase) seen.add(phase);
      const boxes = monster.combat.getActiveHitboxes(out);
      if (phase === 'active') {
        expect(boxes.length).toBe(bite.hitboxes.length);
        activeFrames++;
      } else {
        expect(boxes.length).toBe(0);
      }
      monster.update(DT, target);
    }
    expect([...seen].sort()).toEqual(['active', 'recovery', 'startup', 'telegraph']);
    expect(activeFrames).toBeGreaterThan(0);
    expect(monster.combat.state).toBe('idle');
  });

  it('places bite hitbox in front of the monster (toward the target)', () => {
    const bite = attack('vg_bite');
    monster.combat.startAttack(bite, target);
    stepFor(monster, target, bite.telegraphSeconds + bite.startupSeconds + DT);
    const boxes = monster.combat.getActiveHitboxes([]);
    expect(boxes[0]?.center.z).toBeLessThan(-3);
  });

  it('charge moves the monster forward during active only', () => {
    const charge = attack('vg_charge');
    monster.combat.startAttack(charge, target);
    stepFor(monster, target, charge.telegraphSeconds + charge.startupSeconds);
    expect(monster.position.z).toBeCloseTo(0, 3);
    stepFor(monster, target, charge.activeSeconds);
    expect(monster.position.z).toBeCloseTo(-(charge.motion.speed ?? 0) * charge.activeSeconds, 0);
  });

  it('lunge relocates toward the target clamped to maxDistance', () => {
    const jump = attack('vg_jump_slam');
    const far = new Vec3(0, 0, -40);
    monster.combat.startAttack(jump, far);
    stepFor(monster, far, jump.telegraphSeconds + jump.startupSeconds + DT);
    expect(monster.position.z).toBeCloseTo(-(jump.motion.maxDistance ?? 0), 3);
  });

  it('spawns a projectile once at active start', () => {
    const rock = attack('vg_rock_throw');
    monster.combat.startAttack(rock, target);
    stepFor(monster, target, monsterAttackTotalSeconds(rock) + DT);
    expect(spawn).toHaveBeenCalledTimes(1);
    const [, origin, aimed] = spawn.mock.calls[0] as [unknown, Vec3, Vec3];
    expect(origin.y).toBeGreaterThan(1);
    expect(aimed.z).toBeCloseTo(target.z);
  });

  it('respects cooldown, range band and facing arc in canUse', () => {
    const bite = attack('vg_bite');
    const tail = attack('vg_tail_sweep');
    expect(monster.combat.canUse(bite, 4, 0.1)).toBe(true);
    expect(monster.combat.canUse(bite, 12, 0.1)).toBe(false);
    expect(monster.combat.canUse(bite, 4, 2.5)).toBe(false);
    expect(monster.combat.canUse(tail, 4, 0.1)).toBe(false);
    expect(monster.combat.canUse(tail, 4, 3.0)).toBe(true);

    monster.combat.startAttack(bite, target);
    stepFor(monster, target, monsterAttackTotalSeconds(bite) + DT);
    expect(monster.combat.state).toBe('idle');
    expect(monster.combat.canUse(bite, 4, 0.1)).toBe(false);
    stepFor(monster, target, bite.cooldownSeconds);
    expect(monster.combat.canUse(bite, 4, 0.1)).toBe(true);
  });

  it('flinch interrupts the attack and stun outranks flinch', () => {
    monster.combat.startAttack(attack('vg_bite'), target);
    monster.combat.interrupt('flinch', 1);
    expect(monster.combat.state).toBe('flinch');
    expect(monster.combat.current).toBeNull();
    monster.combat.interrupt('stunned', 3);
    expect(monster.combat.state).toBe('stunned');
    monster.combat.interrupt('flinch', 1);
    expect(monster.combat.state).toBe('stunned');
    stepFor(monster, target, 3.1);
    expect(monster.combat.state).toBe('idle');
  });

  it('turns toward the target during telegraph but not after', () => {
    const bite = attack('vg_bite');
    const side = new Vec3(5, 0, -5);
    monster.combat.startAttack(bite, side);
    const yawStart = monster.yaw;
    stepFor(monster, side, bite.telegraphSeconds - DT);
    const yawAfterTelegraph = monster.yaw;
    expect(yawAfterTelegraph).not.toBeCloseTo(yawStart, 3);
    stepFor(monster, side, bite.startupSeconds + bite.activeSeconds);
    expect(monster.yaw).toBeCloseTo(yawAfterTelegraph, 5);
  });
});

describe('MonsterAI (combat layer)', () => {
  it('attacks when the target is in range and facing', () => {
    const monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
    const ai = new MonsterAI(monster, new Random(7));
    const target = new Vec3(0, 0, -4);
    let started = false;
    for (let i = 0; i < 60 * 4 && !started; i++) {
      ai.update(DT, target);
      monster.update(DT, target);
      started = monster.combat.isAttacking;
    }
    expect(started).toBe(true);
    expect(ai.lastChosenAttackId).not.toBeNull();
    expect(attack(ai.lastChosenAttackId!).ranges).toContain('near');
  });

  it('approaches a far target', () => {
    const monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
    const ai = new MonsterAI(monster, new Random(3));
    const target = new Vec3(0, 0, -60);
    const startZ = monster.position.z;
    for (let i = 0; i < 60; i++) {
      ai.update(DT, target);
      monster.update(DT, target);
      if (monster.combat.isBusy) break;
    }
    expect(monster.position.z).toBeLessThan(startZ);
  });

  it('does nothing while paused', () => {
    const monster = new Monster('m', def, balance, flat);
    monster.teleport(0, 0, Math.PI);
    const ai = new MonsterAI(monster, new Random(3));
    ai.paused = true;
    const target = new Vec3(0, 0, -4);
    for (let i = 0; i < 240; i++) {
      ai.update(DT, target);
      monster.update(DT, target);
    }
    expect(monster.combat.isBusy).toBe(false);
    expect(monster.position.z).toBe(0);
  });
});
