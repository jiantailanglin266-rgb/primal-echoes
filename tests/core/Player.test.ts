import { beforeEach, describe, expect, it } from 'vitest';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import type { HeightProvider } from '@core/world/Terrain';
import { loadBalance, loadTitanBlade } from '@data/DataRegistry';
import { attackTotalSeconds } from '@core/combat/AttackData';

const DT = 1 / 60;
const balance = loadBalance().player;
const weapon = loadTitanBlade();
const flat: HeightProvider = { getHeight: () => 0 };
const light1 = weapon.attacks.find((a) => a.id === 'tb_light_1')!;

function step(player: Player, intent: PlayerIntent, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    player.update(intent, DT);
    intent.dodge = false;
    intent.lightAttack = false;
    intent.heavyAttack = false;
  }
}

describe('Player aggregate', () => {
  let player: Player;
  let intent: PlayerIntent;

  beforeEach(() => {
    player = new Player(balance, weapon, flat);
    intent = createEmptyIntent();
  });

  it('locks movement during an attack but applies the forward step', () => {
    intent.move.set(0, 0, 1);
    intent.lightAttack = true;
    step(player, intent, attackTotalSeconds(light1) - DT);
    expect(player.controller.position.z).toBeCloseTo(light1.forwardStep, 3);
    expect(player.controller.state).toBe('idle');
  });

  it('turns toward the input direction during startup at the weapon turn speed', () => {
    intent.move.set(1, 0, 0);
    intent.lightAttack = true;
    step(player, intent, light1.startupSeconds);
    const expected = Math.min(Math.PI / 2, weapon.startupTurnSpeedRadPerSecond * light1.startupSeconds);
    expect(player.controller.yaw).toBeCloseTo(expected, 1);
  });

  it('dodge cancels the attack after the cancel window opens', () => {
    intent.lightAttack = true;
    step(player, intent, DT);
    intent.dodge = true;
    step(player, intent, DT);
    expect(player.combat.state).toBe('attacking');
    expect(player.controller.state).not.toBe('dodge');

    step(player, intent, light1.dodgeCancelFromSeconds);
    intent.dodge = true;
    step(player, intent, DT);
    expect(player.controller.state).toBe('dodge');
    expect(player.combat.state).toBe('idle');
  });

  it('performs the dodge attack when light is pressed as the dodge ends', () => {
    intent.dodge = true;
    step(player, intent, balance.dodge.durationSeconds + DT * 2);
    expect(player.controller.state).toBe('idle');
    intent.lightAttack = true;
    step(player, intent, DT);
    expect(player.combat.current?.attack.id).toBe(weapon.dodgeAttackId);
  });

  it('cannot dash while charging', () => {
    intent.move.set(0, 0, 1);
    intent.dash = true;
    intent.heavyAttack = true;
    intent.heavyHeld = true;
    step(player, intent, 0.5);
    expect(player.combat.state).toBe('charging');
    expect(player.controller.position.z).toBeCloseTo(0, 3);
  });
});
