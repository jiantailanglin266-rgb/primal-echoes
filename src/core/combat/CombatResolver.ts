import type { CombatBalance } from '@data/schemas/balance';
import type { MonsterAttackDefinition } from '@data/schemas/monster';
import type { Player } from '@core/player/Player';
import type { Monster, MonsterHitOutcome } from '@core/monster/Monster';
import type { MonsterHitbox } from '@core/monster/MonsterCombat';
import type { MonsterPart } from '@core/monster/MonsterPart';
import type { Projectile } from './Projectile';
import type { EcosystemManager } from '@core/ecosystem/EcosystemManager';
import type { HitZoneModifiers } from './elements';

/** 小型生物用: 全種別 1.0 の肉質。倍率は hitZoneMultiplier で与える。 */
const UNIFORM_HIT_ZONE: HitZoneModifiers = { slash: 1, impact: 1, projectile: 1, fire: 1, water: 1, thunder: 1, ice: 1, aether: 1 };
import type { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import type { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import { computeDamage, createDamageResult, type DamageInput } from './DamageSystem';
import { findHitPart, type HitCandidate } from './HitDetection';
import type { WorldHitbox } from './PlayerCombat';
import { spheresOverlap } from './shapes';

/**
 * 攻撃の命中を 1 ステップ分解決する。
 * - プレイヤー -> モンスター: HitDetection（部位）+ DamageSystem（式）
 * - モンスター/投射物 -> プレイヤー: 被弾球との重なり + 防御式
 * 結果はイベントとして発行する。core 内で完結し、描画や UI は知らない。
 */
export class CombatResolver {
  private readonly playerHitboxes: WorldHitbox[] = [];
  private readonly monsterHitboxes: MonsterHitbox[] = [];
  private readonly candidate: HitCandidate = { part: null as unknown as MonsterPart, depth: 0, contact: new Vec3() };
  private readonly hurtboxCenter = new Vec3();
  private readonly creatureCenter = new Vec3();
  private readonly awayDirection = new Vec3();
  private readonly damageInput: DamageInput = {
    weaponPower: 0,
    motionValue: 0,
    motionValueMultiplier: 1,
    damageType: 'slash',
    elementType: 'none',
    elementPower: 0,
    elementMotionValue: 0,
    sharpnessPhysicalModifier: 1,
    sharpnessElementModifier: 1,
    critRate: 0,
    critMultiplier: 1,
    hitZone: { slash: 1, impact: 1, projectile: 1, fire: 1, water: 1, thunder: 1, ice: 1, aether: 1 },
    hitZoneMultiplier: 1,
    partDamageMultiplier: 1,
    stunDamage: 0,
    stunMultiplier: 0,
    flinchDamage: 0,
    minimumDamage: 1,
  };
  private readonly outcome: MonsterHitOutcome = { broke: false, severed: false, flinched: false, died: false, stunned: false, enraged: false, toppled: false };

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly balance: CombatBalance,
    private readonly rng: Random,
  ) {}

  /** 戻り値: このステップで成立したヒット数。 */
  resolvePlayerAttacks(player: Player, monsters: readonly Monster[]): number {
    const { controller, combat } = player;
    combat.getActiveHitboxes(controller.position, controller.yaw, this.playerHitboxes);
    if (this.playerHitboxes.length === 0) return 0;

    let hits = 0;
    for (const monster of monsters) {
      if (!monster.isAlive) continue;
      for (const hitbox of this.playerHitboxes) {
        // 1 攻撃インスタンスにつき同じモンスターへは 1 回だけ
        if (hitbox.source.hitKeys.has(monster.id)) continue;
        const hit = findHitPart(hitbox, monster, this.candidate);
        if (!hit) continue;
        hitbox.source.hitKeys.add(monster.id);
        this.applyPlayerHit(player, monster, hitbox, hit);
        hits++;
      }
    }
    return hits;
  }

  /**
   * プレイヤーの攻撃が小型生物に当たったかを解決する。
   * 小型生物は部位を持たないので、体の球 1 つとの重なりで判定し、肉質は定義の hitZone スカラー。
   */
  resolvePlayerAttacksOnCreatures(player: Player, ecosystem: EcosystemManager): number {
    const { controller, combat } = player;
    combat.getActiveHitboxes(controller.position, controller.yaw, this.playerHitboxes);
    if (this.playerHitboxes.length === 0) return 0;
    const weapon = combat.weapon;
    const sharpness = this.balance.sharpnessModifiers[weapon.sharpness];
    let hits = 0;

    for (const creature of ecosystem.creatures) {
      if (!creature.isAlive) continue;
      creature.getBodyCenter(this.creatureCenter);
      for (const hitbox of this.playerHitboxes) {
        const key = `creature:${creature.id}`;
        if (hitbox.source.hitKeys.has(key)) continue;
        if (!spheresOverlap(hitbox.center, hitbox.radius, this.creatureCenter, creature.def.bodyRadius)) continue;
        hitbox.source.hitKeys.add(key);
        const attack = hitbox.source.attack;
        const input = this.damageInput;
        input.weaponPower = weapon.weaponPower;
        input.motionValue = attack.motionValue;
        input.motionValueMultiplier = hitbox.source.motionValueMultiplier;
        input.damageType = attack.damageType;
        input.elementType = weapon.element.type;
        input.elementPower = weapon.element.power;
        input.elementMotionValue = attack.elementMotionValue;
        input.sharpnessPhysicalModifier = sharpness.physical;
        input.sharpnessElementModifier = sharpness.element;
        input.critRate = weapon.critRate;
        input.critMultiplier = this.balance.critMultiplier;
        input.hitZone = UNIFORM_HIT_ZONE;
        input.hitZoneMultiplier = creature.def.hitZone;
        input.partDamageMultiplier = 0;
        input.stunDamage = 0;
        input.stunMultiplier = 0;
        input.flinchDamage = 0;
        input.minimumDamage = this.balance.minimumDamage;
        const result = computeDamage(input, this.rng.next(), createDamageResult());
        const died = ecosystem.damageCreature(creature, result.total);
        this.events.emit('creatureHit', { creatureId: creature.id, position: this.creatureCenter.clone(), damage: result.total, died });
        hits++;
      }
    }
    return hits;
  }

  /** モンスターの攻撃と投射物がプレイヤーに当たったかを解決する。戻り値: ヒット数。 */
  resolveMonsterAttacks(monsters: readonly Monster[], projectiles: readonly Projectile[], player: Player): number {
    if (player.isDowned) return 0;
    const controller = player.controller;
    controller.getHurtboxCenter(this.hurtboxCenter);
    const radius = controller.hurtboxRadius;
    let hits = 0;

    for (const monster of monsters) {
      if (!monster.isAlive) continue;
      monster.combat.getActiveHitboxes(this.monsterHitboxes);
      for (const hitbox of this.monsterHitboxes) {
        if (hitbox.attack.hasHitPlayer) continue;
        if (!spheresOverlap(hitbox.center, hitbox.radius, this.hurtboxCenter, radius)) continue;
        // 無敵中は「当たったが効かない」。判定自体は消費しないので、無敵が切れた後に持続判定へ触れれば当たる。
        if (controller.isInvulnerable) continue;
        hitbox.attack.hasHitPlayer = true;
        this.awayDirection.copy(controller.position).sub(monster.position);
        this.applyMonsterHit(player, hitbox.attack.def, monster.totalAttackDamageMultiplier(hitbox.attack.def.id), hitbox.center);
        hits++;
      }
    }

    for (const projectile of projectiles) {
      if (!projectile.alive || projectile.hasHitPlayer) continue;
      if (!spheresOverlap(projectile.position, projectile.radius, this.hurtboxCenter, radius)) continue;
      if (controller.isInvulnerable) continue;
      projectile.hasHitPlayer = true;
      projectile.alive = false;
      this.awayDirection.copy(projectile.velocity);
      this.applyMonsterHit(player, projectile.attack, projectile.damageMultiplier, projectile.position);
      hits++;
    }
    return hits;
  }

  private applyPlayerHit(player: Player, monster: Monster, hitbox: WorldHitbox, hit: HitCandidate): void {
    const weapon = player.combat.weapon;
    const attack = hitbox.source.attack;
    const sharpness = this.balance.sharpnessModifiers[weapon.sharpness];
    const input = this.damageInput;

    input.weaponPower = weapon.weaponPower;
    input.motionValue = attack.motionValue;
    input.motionValueMultiplier = hitbox.source.motionValueMultiplier;
    input.damageType = attack.damageType;
    input.elementType = weapon.element.type;
    input.elementPower = weapon.element.power;
    input.elementMotionValue = attack.elementMotionValue;
    input.sharpnessPhysicalModifier = sharpness.physical;
    input.sharpnessElementModifier = sharpness.element;
    input.critRate = weapon.critRate;
    input.critMultiplier = this.balance.critMultiplier;
    input.hitZone = hit.part.def.hitZone;
    input.hitZoneMultiplier = monster.condition.hitZoneMultiplierFor(hit.part.id);
    input.partDamageMultiplier = attack.partDamageMultiplier * hitbox.source.partDamageMultiplier;
    input.stunDamage = attack.stunDamage;
    input.stunMultiplier = hit.part.def.stunMultiplier;
    input.flinchDamage = attack.flinchDamage;
    input.minimumDamage = this.balance.minimumDamage;

    // イベントは購読側が保持する可能性があるので、結果と位置は毎回新しく作る
    const result = computeDamage(input, this.rng.next(), createDamageResult());
    const outcome = monster.applyHit(hit.part.id, result, this.outcome);

    this.events.emit('hit', {
      monsterId: monster.id,
      partId: hit.part.id,
      position: hit.contact.clone(),
      result,
      hitStopSeconds: hitbox.source.hitStopSeconds,
    });
    if (outcome.flinched) this.events.emit('monsterFlinched', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.stunned) this.events.emit('monsterStunned', { monsterId: monster.id });
    if (outcome.toppled) this.events.emit('monsterToppled', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.enraged) this.events.emit('monsterEnraged', { monsterId: monster.id });
    if (outcome.broke) this.events.emit('partBroken', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.severed) this.events.emit('partSevered', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.died) this.events.emit('monsterDied', { monsterId: monster.id });
  }

  private applyMonsterHit(player: Player, attack: MonsterAttackDefinition, multiplier: number, contact: Vec3): void {
    const defense = player.stats.defense;
    const k = this.balance.defenseConstant;
    const physical = attack.damage * multiplier * (k / (k + defense));
    const element = attack.element.type === 'none' ? 0 : attack.element.power * (1 - player.stats.getElementResist(attack.element.type));
    const damage = Math.max(this.balance.minimumDamage, Math.round(physical + element));

    const died = player.applyHit(damage, this.awayDirection, attack.knockback);
    this.events.emit('playerHit', { damage, position: contact.clone(), attackId: attack.id });
    if (died) this.events.emit('playerDowned', { position: player.controller.position.clone() });
  }
}
