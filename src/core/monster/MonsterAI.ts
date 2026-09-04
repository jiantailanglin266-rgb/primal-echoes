import type { MonsterAttackDefinition } from '@data/schemas/monster';
import type { Random } from '@shared/rng/Random';
import type { Vec3 } from '@shared/math/Vec3';
import type { Monster } from './Monster';

export type MonsterAIMode = 'combat';

/**
 * モンスター AI（戦闘層）。
 * T10 で生態層（Patrol/Eat/Drink/Sleep/Flee）を重ねる。
 *
 * 判断の流れ（1 ステップ）:
 *   攻撃中/リアクション中 -> 何もしない
 *   攻撃間隔が空いている & 使える攻撃がある -> 重み付き抽選して開始
 *   それ以外 -> ターゲットへ向き直り、遠ければ接近
 * 怒り/疲労は MonsterCondition の倍率（間隔・速度・使用不可攻撃）として反映される。
 */
export class MonsterAI {
  mode: MonsterAIMode = 'combat';
  /** デバッグ用: true で判断を止める（攻撃も接近もしない）。 */
  paused = false;
  lastChosenAttackId: string | null = null;

  private intervalRemaining: number;
  private readonly candidates: MonsterAttackDefinition[] = [];

  constructor(
    private readonly monster: Monster,
    private readonly rng: Random,
  ) {
    this.intervalRemaining = this.rollInterval();
  }

  update(dt: number, target: Vec3): void {
    const m = this.monster;
    if (this.paused || !m.isAlive || m.combat.isBusy) return;

    const distance = m.position.horizontalDistanceTo(target);
    const relativeAngle = m.combat.relativeAngleTo(target);
    this.intervalRemaining -= dt;

    if (this.intervalRemaining <= 0) {
      const chosen = this.chooseAttack(distance, relativeAngle);
      if (chosen) {
        this.lastChosenAttackId = chosen.id;
        m.combat.startAttack(chosen, target);
        this.intervalRemaining = this.rollInterval();
        return;
      }
    }

    // 攻撃できないときは位置取り: 正面へ向き、遠ければ詰める
    const speedMul = m.condition.speedMultiplier;
    m.turnTowards(target, m.def.stats.turnSpeedRadPerSecond * speedMul * dt);
    if (distance > m.def.combat.approachStopDistance) {
      const band = m.combat.rangeBandFor(distance);
      const speed = (band === 'far' ? m.def.stats.runSpeed : m.def.stats.walkSpeed) * speedMul;
      // 正面を向いていないときは前進しない（その場で旋回する）
      if (relativeAngle < 0.6) m.moveTowards(target, speed, dt);
    }
  }

  private chooseAttack(distance: number, relativeAngle: number): MonsterAttackDefinition | null {
    const m = this.monster;
    this.candidates.length = 0;
    let totalWeight = 0;
    for (const attack of m.def.attacks) {
      if (m.condition.isAttackDisabled(attack.id)) continue;
      if (!m.combat.canUse(attack, distance, relativeAngle)) continue;
      this.candidates.push(attack);
      totalWeight += attack.weight;
    }
    if (this.candidates.length === 0) return null;
    let roll = this.rng.next() * totalWeight;
    for (const attack of this.candidates) {
      roll -= attack.weight;
      if (roll <= 0) return attack;
    }
    return this.candidates[this.candidates.length - 1] ?? null;
  }

  private rollInterval(): number {
    const c = this.monster.def.combat;
    return this.rng.range(c.attackIntervalMinSeconds, c.attackIntervalMaxSeconds) * this.monster.condition.attackIntervalMultiplier;
  }
}
