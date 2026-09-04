import { describe, expect, it, vi } from 'vitest';
import { CombatResolver } from '@core/combat/CombatResolver';
import { Player } from '@core/player/Player';
import { createEmptyIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { loadBalance, loadTitanBlade, loadValgaron } from '@data/DataRegistry';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import type { HeightProvider } from '@core/world/Terrain';
import { attackTotalSeconds } from '@core/combat/AttackData';

const DT = 1 / 60;
const balance = loadBalance();
const weapon = loadTitanBlade();
const flat: HeightProvider = { getHeight: () => 0 };

function setup() {
  const events = new EventBus<GameEvents>();
  const player = new Player(balance.player, weapon, flat);
  const monster = new Monster('valgaron_01', loadValgaron(), balance.combat);
  // 頭がプレイヤーの目の前に来るよう配置（頭は +Z 3.2 なので、向きを反転して手前に）
  monster.teleport(0, 0, 5.5, Math.PI);
  const resolver = new CombatResolver(events, balance.combat, new Random(1));
  return { events, player, monster, resolver };
}

describe('CombatResolver', () => {
  it('lands exactly one hit per attack instance and emits a hit event with damage', () => {
    const { events, player, monster, resolver } = setup();
    const onHit = vi.fn();
    events.on('hit', onHit);

    const intent = createEmptyIntent();
    intent.lightAttack = true;
    const light1 = weapon.attacks.find((a) => a.id === 'tb_light_1')!;
    let hits = 0;
    for (let i = 0; i < Math.round(attackTotalSeconds(light1) / DT) + 1; i++) {
      player.update(intent, DT);
      intent.lightAttack = false;
      hits += resolver.resolvePlayerAttacks(player, [monster]);
    }
    expect(hits).toBe(1);
    expect(onHit).toHaveBeenCalledTimes(1);
    const payload = onHit.mock.calls[0]?.[0] as GameEvents['hit'];
    expect(payload.monsterId).toBe('valgaron_01');
    expect(payload.result.total).toBeGreaterThan(0);
    expect(monster.stats.hp).toBe(monster.stats.maxHp - payload.result.total);
    expect(payload.hitStopSeconds).toBe(light1.hitStopSeconds);
  });

  it('uses the part hit zone in the damage formula', () => {
    const { events, player, monster, resolver } = setup();
    let payload: GameEvents['hit'] | null = null;
    events.on('hit', (e) => (payload = e));
    const intent = createEmptyIntent();
    intent.lightAttack = true;
    for (let i = 0; i < 60 && !payload; i++) {
      player.update(intent, DT);
      intent.lightAttack = false;
      resolver.resolvePlayerAttacks(player, [monster]);
    }
    expect(payload).not.toBeNull();
    const p = payload as unknown as GameEvents['hit'];
    const part = monster.getPart(p.partId);
    const light1 = weapon.attacks.find((a) => a.id === 'tb_light_1')!;
    const sharp = balance.combat.sharpnessModifiers[weapon.sharpness].physical;
    const expected = weapon.weaponPower * light1.motionValue * part.def.hitZone.slash * sharp;
    const crit = p.result.isCritical ? balance.combat.critMultiplier : 1;
    expect(p.result.total).toBe(Math.round(expected * crit));
  });

  it('does not hit dead monsters', () => {
    const { player, monster, resolver } = setup();
    monster.stats.takeDamage(monster.stats.maxHp);
    const intent = createEmptyIntent();
    intent.lightAttack = true;
    let hits = 0;
    for (let i = 0; i < 60; i++) {
      player.update(intent, DT);
      intent.lightAttack = false;
      hits += resolver.resolvePlayerAttacks(player, [monster]);
    }
    expect(hits).toBe(0);
  });
});
