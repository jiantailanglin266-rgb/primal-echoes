import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerCombat, type CombatContext, type WorldHitbox } from '@core/combat/PlayerCombat';
import { PlayerStats } from '@core/player/PlayerStats';
import { attackTotalSeconds } from '@core/combat/AttackData';
import { loadBalance, loadTitanBlade } from '@data/DataRegistry';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance().player;
const weapon = loadTitanBlade();
const attack = (id: string) => {
  const a = weapon.attacks.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
};

type Buttons = { lightAttack: boolean; heavyAttack: boolean; heavyHeld: boolean };
const none = (): Buttons => ({ lightAttack: false, heavyAttack: false, heavyHeld: false });
const idleCtx = (): CombatContext => ({ isDodging: false, timeSinceDodgeEnd: Infinity });

function run(combat: PlayerCombat, seconds: number, buttons: Buttons = none(), ctx = idleCtx()): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    combat.update(buttons, ctx, DT);
    buttons.lightAttack = false;
    buttons.heavyAttack = false;
  }
}

describe('PlayerCombat', () => {
  let stats: PlayerStats;
  let combat: PlayerCombat;

  beforeEach(() => {
    stats = new PlayerStats(balance);
    combat = new PlayerCombat(weapon, stats);
  });

  it('light attack goes through startup -> active -> recovery -> idle and only hits during active', () => {
    const buttons = none();
    buttons.lightAttack = true;
    combat.update(buttons, idleCtx(), DT);
    expect(combat.state).toBe('attacking');
    expect(combat.current?.attack.id).toBe('tb_light_1');

    const a = attack('tb_light_1');
    const out: WorldHitbox[] = [];
    const origin = new Vec3();
    const seen = { startup: false, active: false, recovery: false };
    while (combat.state === 'attacking') {
      const phase = combat.phase;
      const hitboxes = combat.getActiveHitboxes(origin, 0, out);
      if (phase === 'active') expect(hitboxes.length).toBe(a.hitboxes.length);
      else expect(hitboxes.length).toBe(0);
      if (phase) seen[phase] = true;
      combat.update(none(), idleCtx(), DT);
    }
    expect(seen).toEqual({ startup: true, active: true, recovery: true });
    expect(combat.state).toBe('idle');
  });

  it('chains light -> light -> light when input is buffered before the chain window', () => {
    const b = none();
    b.lightAttack = true;
    run(combat, DT, b);
    const a1 = attack('tb_light_1');
    // chain 窓が開く直前に先行入力
    run(combat, a1.chainFromSeconds - 0.2);
    b.lightAttack = true;
    run(combat, DT, b);
    expect(combat.current?.attack.id).toBe('tb_light_1');
    run(combat, 0.25);
    expect(combat.current?.attack.id).toBe('tb_light_2');

    const a2 = attack('tb_light_2');
    run(combat, a2.chainFromSeconds - 0.05);
    b.lightAttack = true;
    run(combat, 0.1, b);
    expect(combat.current?.attack.id).toBe('tb_light_3');
  });

  it('drops buffered input that is older than the buffer window', () => {
    const b = none();
    b.lightAttack = true;
    run(combat, DT, b);
    b.lightAttack = true;
    run(combat, DT, b); // 攻撃直後に先行入力（chain 窓まで 0.7 秒 > buffer 0.35 秒）
    run(combat, attackTotalSeconds(attack('tb_light_1')) + DT);
    expect(combat.state).toBe('idle');
  });

  it('heavy tap performs the normal heavy attack and costs stamina', () => {
    const b = none();
    b.heavyAttack = true;
    b.heavyHeld = true;
    run(combat, 0.1, b);
    expect(combat.state).toBe('charging');
    b.heavyHeld = false;
    run(combat, DT, b);
    expect(combat.state).toBe('attacking');
    expect(combat.current?.attack.id).toBe('tb_heavy');
    expect(stats.stamina).toBeLessThanOrEqual(balance.maxStamina - attack('tb_heavy').staminaCost);
  });

  it('holding heavy charges and releases a charge attack at the reached level', () => {
    const b = none();
    b.heavyAttack = true;
    b.heavyHeld = true;
    run(combat, 1.2, b);
    expect(combat.state).toBe('charging');
    expect(combat.chargeLevel).toBe(1);
    b.heavyHeld = false;
    run(combat, DT, b);
    expect(combat.current?.attack.id).toBe('tb_charge');
    expect(combat.current?.chargeLevel).toBe(1);
    expect(combat.current?.motionValueMultiplier).toBe(weapon.charge.levels[1]?.motionValueMultiplier);
  });

  it('auto-releases the charge when stamina runs out', () => {
    stats.stamina = attack('tb_charge').staminaCost + 1;
    const b = none();
    b.heavyAttack = true;
    b.heavyHeld = true;
    run(combat, 0.5, b);
    expect(combat.state).toBe('charging');
    stats.stamina = 0.01;
    run(combat, 0.05, b);
    expect(combat.state).not.toBe('charging');
  });

  it('fizzles an attack when stamina is insufficient', () => {
    stats.stamina = 1;
    const b = none();
    b.heavyAttack = true;
    b.heavyHeld = true;
    run(combat, 0.05, b);
    b.heavyHeld = false;
    run(combat, DT, b);
    expect(combat.state).toBe('idle');
    expect(combat.current).toBeNull();
  });

  it('allows dodge cancel only after dodgeCancelFromSeconds', () => {
    const b = none();
    b.lightAttack = true;
    let result = combat.update(b, idleCtx(), DT);
    expect(result.allowsDodge).toBe(false);
    expect(result.locksMovement).toBe(true);
    const a = attack('tb_light_1');
    run(combat, a.dodgeCancelFromSeconds - 0.05);
    result = combat.update(none(), idleCtx(), DT);
    expect(result.allowsDodge).toBe(false);
    run(combat, 0.1);
    result = combat.update(none(), idleCtx(), DT);
    expect(result.allowsDodge).toBe(true);
  });

  it('delivers the forward step across startup only', () => {
    const b = none();
    b.lightAttack = true;
    const a = attack('tb_light_1');
    let total = 0;
    let stepsWithMovement = 0;
    const ctx = idleCtx();
    let buttons: Buttons = b;
    for (let i = 0; i < Math.round(attackTotalSeconds(a) / DT) + 2; i++) {
      const r = combat.update(buttons, ctx, DT);
      buttons = none();
      total += r.forwardStep;
      if (r.forwardStep > 0) stepsWithMovement++;
    }
    expect(total).toBeCloseTo(a.forwardStep, 5);
    expect(stepsWithMovement).toBeLessThanOrEqual(Math.ceil(a.startupSeconds / DT) + 1);
  });

  it('uses the dodge attack when light is pressed right after a dodge', () => {
    const b = none();
    b.lightAttack = true;
    combat.update(b, { isDodging: false, timeSinceDodgeEnd: 0.1 }, DT);
    expect(combat.current?.attack.id).toBe(weapon.dodgeAttackId);
  });

  it('does not start attacks while dodging but keeps the buffer', () => {
    const b = none();
    b.lightAttack = true;
    combat.update(b, { isDodging: true, timeSinceDodgeEnd: Infinity }, DT);
    expect(combat.state).toBe('idle');
    combat.update(none(), { isDodging: false, timeSinceDodgeEnd: 0 }, DT);
    expect(combat.state).toBe('attacking');
  });

  it('transforms hitboxes by yaw', () => {
    const b = none();
    b.lightAttack = true;
    run(combat, DT, b);
    const a = attack('tb_light_1');
    run(combat, a.startupSeconds + DT);
    const out: WorldHitbox[] = [];
    const origin = new Vec3(10, 0, 5);
    combat.getActiveHitboxes(origin, Math.PI / 2, out); // +X を向く
    const offset = a.hitboxes[0]?.offset ?? { x: 0, y: 0, z: 0 };
    expect(out[0]?.center.x).toBeCloseTo(origin.x + offset.z, 5);
    expect(out[0]?.center.z).toBeCloseTo(origin.z, 5);
    expect(out[0]?.center.y).toBeCloseTo(offset.y, 5);
  });
});
