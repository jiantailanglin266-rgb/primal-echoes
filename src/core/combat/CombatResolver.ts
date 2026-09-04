import type { CombatBalance } from '@data/schemas/balance';
import type { Player } from '@core/player/Player';
import type { Monster, MonsterHitOutcome } from '@core/monster/Monster';
import type { MonsterPart } from '@core/monster/MonsterPart';
import type { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import type { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import { computeDamage, createDamageResult, type DamageInput } from './DamageSystem';
import { findHitPart, type HitCandidate } from './HitDetection';
import type { WorldHitbox } from './PlayerCombat';

/**
 * 「プレイヤーの攻撃がモンスターに当たった」を 1 ステップ分解決する。
 * HitDetection（どこに当たったか）と DamageSystem（いくら削るか）を繋ぎ、
 * 結果をイベントとして発行する。core 内で完結し、描画や UI は知らない。
 */
export class CombatResolver {
  private readonly hitboxes: WorldHitbox[] = [];
  private readonly candidate: HitCandidate = { part: null as unknown as MonsterPart, depth: 0, contact: new Vec3() };
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
    partDamageMultiplier: 1,
    stunDamage: 0,
    stunMultiplier: 0,
    flinchDamage: 0,
    minimumDamage: 1,
  };
  private readonly outcome: MonsterHitOutcome = { broke: false, severed: false, flinched: false, died: false, stunned: false };

  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly balance: CombatBalance,
    private readonly rng: Random,
  ) {}

  /** 戻り値: このステップで成立したヒット数。 */
  resolvePlayerAttacks(player: Player, monsters: readonly Monster[]): number {
    const { controller, combat } = player;
    combat.getActiveHitboxes(controller.position, controller.yaw, this.hitboxes);
    if (this.hitboxes.length === 0) return 0;

    let hits = 0;
    for (const monster of monsters) {
      if (!monster.isAlive) continue;
      for (const hitbox of this.hitboxes) {
        // 1 攻撃インスタンスにつき同じモンスターへは 1 回だけ
        if (hitbox.source.hitKeys.has(monster.id)) continue;
        const hit = findHitPart(hitbox, monster, this.candidate);
        if (!hit) continue;
        hitbox.source.hitKeys.add(monster.id);
        this.applyHit(player, monster, hitbox, hit);
        hits++;
      }
    }
    return hits;
  }

  private applyHit(player: Player, monster: Monster, hitbox: WorldHitbox, hit: HitCandidate): void {
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
    if (outcome.broke) this.events.emit('partBroken', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.severed) this.events.emit('partSevered', { monsterId: monster.id, partId: hit.part.id });
    if (outcome.died) this.events.emit('monsterDied', { monsterId: monster.id });
  }
}
