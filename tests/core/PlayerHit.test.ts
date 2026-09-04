import { describe, expect, it, vi } from 'vitest';
import { CombatResolver } from '@core/combat/CombatResolver';
import { ProjectileManager } from '@core/combat/Projectile';
import { Player } from '@core/player/Player';
import { createEmptyIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { loadBalance, loadTitanBlade, loadValgaron } from '@data/DataRegistry';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import type { HeightProvider } from '@core/world/Terrain';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance();
const weapon = loadTitanBlade();
const def = loadValgaron();
const flat: HeightProvider = { getHeight: () => 0 };
const bite = def.attacks.find((a) => a.id === 'vg_bite')!;
const rock = def.attacks.find((a) => a.id === 'vg_rock_throw')!;

function setup() {
  const events = new EventBus<GameEvents>();
  const player = new Player(balance.player, weapon, flat);
  const projectiles = new ProjectileManager(flat);
  const monster = new Monster('m', def, balance.combat, flat, {
    spawnProjectile: (attack, origin, target) => projectiles.spawnArc('m', attack, origin, target, balance.player.hurtboxHeight),
  });
  // プレイヤー（原点）の目の前、頭がプレイヤー側を向く
  monster.teleport(0, 6, Math.PI);
  const resolver = new CombatResolver(events, balance.combat, new Random(1));
  return { events, player, projectiles, monster, resolver };
}

function runUntilActiveEnds(ctx: ReturnType<typeof setup>, intentFactory = () => createEmptyIntent()) {
  const { player, monster, projectiles, resolver } = ctx;
  const target = player.controller.position;
  const total = bite.telegraphSeconds + bite.startupSeconds + bite.activeSeconds + bite.recoverySeconds;
  let hits = 0;
  for (let i = 0; i < Math.round(total / DT) + 2; i++) {
    player.update(intentFactory(), DT);
    monster.update(DT, target);
    projectiles.update(DT);
    hits += resolver.resolveMonsterAttacks([monster], projectiles.projectiles, player);
  }
  return hits;
}

describe('Player taking hits', () => {
  it('bite hits the player once, applies defense formula and knockback state', () => {
    const ctx = setup();
    const onHit = vi.fn();
    ctx.events.on('playerHit', onHit);
    ctx.monster.combat.startAttack(bite, ctx.player.controller.position);
    const hits = runUntilActiveEnds(ctx);
    expect(hits).toBe(1);
    const k = balance.combat.defenseConstant;
    const expected = Math.round(bite.damage * (k / (k + ctx.player.stats.defense)));
    expect(ctx.player.stats.hp).toBe(balance.player.maxHp - expected);
    expect(onHit).toHaveBeenCalledTimes(1);
    // 吹き飛ばされて後退している（モンスターは +Z 側なので -Z へ）
    expect(ctx.player.controller.position.z).toBeLessThan(-bite.knockback.distance * 0.9);
  });

  it('does not hit while the player is in dodge i-frames', () => {
    const ctx = setup();
    ctx.monster.combat.startAttack(bite, ctx.player.controller.position);
    // active 開始の直前に回避を入力して無敵で抜ける
    const activeStart = bite.telegraphSeconds + bite.startupSeconds;
    const target = ctx.player.controller.position;
    let hits = 0;
    const steps = Math.round((activeStart + bite.activeSeconds + 0.1) / DT);
    for (let i = 0; i < steps; i++) {
      const intent = createEmptyIntent();
      const t = i * DT;
      if (Math.abs(t - (activeStart - balance.player.dodge.invulnStartSeconds - DT)) < DT / 2) intent.dodge = true;
      // 回避は横方向（判定球の外へ出ない程度）ではなく、無敵だけで抜けることを確認したいので移動入力なし
      ctx.player.update(intent, DT);
      ctx.monster.update(DT, target);
      hits += ctx.resolver.resolveMonsterAttacks([ctx.monster], [], ctx.player);
    }
    // 回避で前方 4m 進むため active 中に判定外へ出ている可能性もあるが、いずれにせよ被弾 0
    expect(hits).toBe(0);
    expect(ctx.player.stats.hp).toBe(balance.player.maxHp);
  });

  it('interrupts the player attack on hit and downs the player at 0 HP', () => {
    const ctx = setup();
    const onDown = vi.fn();
    ctx.events.on('playerDowned', onDown);
    ctx.player.stats.hp = 5;
    ctx.monster.combat.startAttack(bite, ctx.player.controller.position);
    const hits = runUntilActiveEnds(ctx, () => {
      const i = createEmptyIntent();
      i.lightAttack = true;
      return i;
    });
    expect(hits).toBe(1);
    expect(ctx.player.isDowned).toBe(true);
    expect(ctx.player.combat.state).toBe('idle');
    expect(onDown).toHaveBeenCalledTimes(1);
  });

  it('rock throw projectile reaches and damages the player', () => {
    const ctx = setup();
    ctx.monster.teleport(0, 20, Math.PI);
    ctx.monster.combat.startAttack(rock, ctx.player.controller.position);
    const target = ctx.player.controller.position;
    let hits = 0;
    for (let i = 0; i < 60 * 6 && hits === 0; i++) {
      ctx.player.update(createEmptyIntent(), DT);
      ctx.monster.update(DT, target);
      ctx.projectiles.update(DT);
      hits += ctx.resolver.resolveMonsterAttacks([ctx.monster], ctx.projectiles.projectiles, ctx.player);
    }
    expect(hits).toBe(1);
    expect(ctx.player.stats.hp).toBeLessThan(balance.player.maxHp);
    expect(ctx.projectiles.projectiles.every((p) => !p.alive)).toBe(true);
  });
});
