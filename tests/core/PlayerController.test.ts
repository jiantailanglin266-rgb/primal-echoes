import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerController } from '@core/player/PlayerController';
import { PlayerStats } from '@core/player/PlayerStats';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import type { HeightProvider } from '@core/world/Terrain';
import { loadBalance } from '@data/DataRegistry';

const DT = 1 / 60;
const balance = loadBalance().player;

const flat: HeightProvider = { getHeight: () => 0 };
const sloped: HeightProvider = { getHeight: (x) => x * 0.5 };

function stepFor(player: PlayerController, intent: PlayerIntent, seconds: number): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    player.update(intent, DT);
    player.stats.update(DT);
    // エッジ入力は 1 ステップだけ有効
    intent.dodge = false;
  }
}

describe('PlayerController', () => {
  let player: PlayerController;
  let intent: PlayerIntent;

  beforeEach(() => {
    player = new PlayerController(new PlayerStats(balance), flat, balance);
    intent = createEmptyIntent();
  });

  it('walks in the intent direction at walk speed', () => {
    intent.move.set(0, 0, 1);
    stepFor(player, intent, 1);
    expect(player.state).toBe('walk');
    expect(player.position.z).toBeCloseTo(balance.walkSpeed, 1);
    expect(player.position.x).toBeCloseTo(0, 3);
  });

  it('turns to face the movement direction', () => {
    intent.move.set(1, 0, 0);
    stepFor(player, intent, 0.5);
    expect(player.yaw).toBeCloseTo(Math.PI / 2, 2);
  });

  it('dashes faster and drains stamina, then falls back to walking when exhausted', () => {
    intent.move.set(0, 0, 1);
    intent.dash = true;
    stepFor(player, intent, 1);
    expect(player.state).toBe('dash');
    expect(player.position.z).toBeCloseTo(balance.dashSpeed, 1);
    expect(player.stats.stamina).toBeLessThan(balance.maxStamina);

    player.stats.stamina = 0;
    stepFor(player, intent, 0.1);
    expect(player.state).toBe('walk');
  });

  it('dodge consumes stamina, grants i-frames inside the window and covers the configured distance', () => {
    intent.move.set(0, 0, 1);
    intent.dodge = true;
    player.update(intent, DT);
    intent.dodge = false;

    expect(player.state).toBe('dodge');
    expect(player.stats.stamina).toBeCloseTo(balance.maxStamina - balance.dodge.staminaCost, 5);

    let sawInvuln = false;
    let elapsed = DT;
    while (player.state === 'dodge') {
      const inWindow = elapsed >= balance.dodge.invulnStartSeconds && elapsed < balance.dodge.invulnEndSeconds;
      expect(player.isInvulnerable).toBe(inWindow);
      sawInvuln ||= player.isInvulnerable;
      player.update(intent, DT);
      elapsed += DT;
    }
    expect(sawInvuln).toBe(true);
    expect(player.position.z).toBeCloseTo(balance.dodge.distance, 1);
    expect(player.isInvulnerable).toBe(false);
  });

  it('dodges toward facing direction when no movement input', () => {
    player.yaw = Math.PI / 2; // +X を向く
    intent.dodge = true;
    stepFor(player, intent, balance.dodge.durationSeconds + DT);
    expect(player.position.x).toBeCloseTo(balance.dodge.distance, 1);
  });

  it('refuses to dodge without enough stamina', () => {
    player.stats.stamina = balance.dodge.staminaCost - 1;
    intent.dodge = true;
    player.update(intent, DT);
    expect(player.state).not.toBe('dodge');
  });

  it('cannot start a second dodge while dodging', () => {
    intent.dodge = true;
    player.update(intent, DT);
    intent.dodge = true;
    player.update(intent, DT);
    expect(player.stats.stamina).toBeCloseTo(balance.maxStamina - balance.dodge.staminaCost, 5);
  });

  it('stays on sloped terrain', () => {
    const p = new PlayerController(new PlayerStats(balance), sloped, balance);
    const i = createEmptyIntent();
    i.move.set(1, 0, 0);
    stepFor(p, i, 2);
    expect(p.position.y).toBeCloseTo(p.position.x * 0.5, 1);
  });
});

describe('PlayerStats', () => {
  it('delays stamina regen after use, then regenerates', () => {
    const stats = new PlayerStats(balance);
    stats.tryConsumeStamina(50);
    const delaySteps = Math.floor(balance.staminaRegenDelaySeconds / DT) - 1;
    for (let i = 0; i < delaySteps; i++) stats.update(DT);
    expect(stats.stamina).toBeCloseTo(50, 5);
    for (let i = 0; i < 60; i++) stats.update(DT);
    expect(stats.stamina).toBeGreaterThan(50);
    expect(stats.stamina).toBeLessThanOrEqual(balance.maxStamina);
  });

  it('infiniteStamina prevents drain', () => {
    const stats = new PlayerStats(balance);
    stats.infiniteStamina = true;
    expect(stats.tryConsumeStamina(1000)).toBe(true);
    expect(stats.stamina).toBe(balance.maxStamina);
  });
});
