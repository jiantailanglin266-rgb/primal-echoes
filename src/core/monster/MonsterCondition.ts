import type { MonsterDefinition } from '@data/schemas/monster';
import type { MonsterStats } from './MonsterStats';

export interface ConditionUpdateResult {
  enrageEnded: boolean;
  exhaustionStarted: boolean;
  exhaustionEnded: boolean;
}

/**
 * 怒り（Enrage）と疲労（Exhaustion）。
 * - 怒り: 被ダメージ蓄積で発動。攻撃力・速度が上がる代わりにスタミナ消費が増え、特定部位が弱点化する。
 * - 疲労: 内部スタミナ枯渇で発動。遅くなり、一部攻撃が使えなくなる。疲労は怒りを強制解除する。
 * 「強いモードには必ず代償がある」ことで、プレイヤーが怒りを待つ/凌ぐ判断を持てるようにする。
 */
export class MonsterCondition {
  isEnraged = false;
  isExhausted = false;
  enrageRemaining = 0;
  enrageCooldownRemaining = 0;
  /** 直近の怒り解除以降に受けたダメージ。 */
  damageSinceCalm = 0;

  private readonly result: ConditionUpdateResult = { enrageEnded: false, exhaustionStarted: false, exhaustionEnded: false };

  constructor(
    private readonly def: MonsterDefinition,
    private readonly stats: MonsterStats,
  ) {}

  get damageMultiplier(): number {
    return this.isEnraged ? this.def.enrage.damageMultiplier : 1;
  }

  /** 攻撃タイムラインと移動に掛ける速度倍率。 */
  get speedMultiplier(): number {
    let m = 1;
    if (this.isEnraged) m *= this.def.enrage.speedMultiplier;
    if (this.isExhausted) m *= this.def.exhaustion.speedMultiplier;
    return m;
  }

  get attackIntervalMultiplier(): number {
    let m = 1;
    if (this.isEnraged) m *= this.def.enrage.attackIntervalMultiplier;
    if (this.isExhausted) m *= this.def.exhaustion.attackIntervalMultiplier;
    return m;
  }

  get staminaCostMultiplier(): number {
    return this.isEnraged ? this.def.enrage.staminaCostMultiplier : 1;
  }

  hitZoneMultiplierFor(partId: string): number {
    if (this.isEnraged && this.def.enrage.weakPartIds.includes(partId)) {
      return this.def.enrage.weakPartHitZoneMultiplier;
    }
    return 1;
  }

  isAttackDisabled(attackId: string): boolean {
    return this.isExhausted && this.def.exhaustion.disabledAttackIds.includes(attackId);
  }

  /** 被ダメージを記録し、怒りに入ったら true。 */
  recordDamage(total: number): boolean {
    if (this.isEnraged) return false;
    this.damageSinceCalm += total;
    if (this.enrageCooldownRemaining > 0 || this.isExhausted) return false;
    if (this.damageSinceCalm < this.def.enrage.damageToTrigger) return false;
    this.enterEnrage();
    return true;
  }

  /** デバッグ・イベント用の強制発動。 */
  forceEnrage(): void {
    if (!this.isEnraged) this.enterEnrage();
  }

  update(dt: number, isBusy: boolean): ConditionUpdateResult {
    const r = this.result;
    r.enrageEnded = false;
    r.exhaustionStarted = false;
    r.exhaustionEnded = false;

    // スタミナ回復: 攻撃中は回復しない。疲労中は「休もうとする」ぶん速い。
    if (!isBusy) {
      const regen = this.isExhausted ? this.def.exhaustion.exhaustedRegenPerSecond : this.def.exhaustion.staminaRegenPerSecond;
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + regen * dt);
    }

    if (this.enrageCooldownRemaining > 0) this.enrageCooldownRemaining = Math.max(0, this.enrageCooldownRemaining - dt);

    if (this.isEnraged) {
      this.enrageRemaining -= dt;
      if (this.enrageRemaining <= 0) {
        this.exitEnrage();
        r.enrageEnded = true;
      }
    }

    if (!this.isExhausted && this.stats.stamina <= this.def.exhaustion.staminaThreshold) {
      this.isExhausted = true;
      r.exhaustionStarted = true;
      // 疲労は怒りを打ち切る（怒りの代償）
      if (this.isEnraged) {
        this.exitEnrage();
        r.enrageEnded = true;
      }
    } else if (this.isExhausted && this.stats.stamina >= this.def.exhaustion.recoverToStamina) {
      this.isExhausted = false;
      r.exhaustionEnded = true;
    }
    return r;
  }

  reset(): void {
    this.isEnraged = false;
    this.isExhausted = false;
    this.enrageRemaining = 0;
    this.enrageCooldownRemaining = 0;
    this.damageSinceCalm = 0;
  }

  private enterEnrage(): void {
    this.isEnraged = true;
    this.enrageRemaining = this.def.enrage.durationSeconds;
  }

  private exitEnrage(): void {
    this.isEnraged = false;
    this.enrageRemaining = 0;
    this.damageSinceCalm = 0;
    this.enrageCooldownRemaining = this.def.enrage.cooldownSeconds;
  }
}
