import type { MonsterPartDefinition } from '@data/schemas/monster';
import type { CombatBalance } from '@data/schemas/balance';
import type { DamageResult } from '@core/combat/DamageSystem';

export type PartState = 'intact' | 'broken' | 'severed';

export interface PartHitOutcome {
  broke: boolean;
  severed: boolean;
  flinched: boolean;
}

/**
 * 部位 1 つの耐久・怯み蓄積・破壊/切断状態。
 * 「どの攻撃が当たったか」は知らず、DamageResult だけを受け取る。
 */
export class MonsterPart {
  readonly id: string;
  partHp: number;
  state: PartState = 'intact';
  flinchAccumulated = 0;
  flinchThreshold: number;
  /**
   * 閾値への外部倍率（前脚破壊で転倒しやすくなる等）。Monster が部位破壊効果から設定する。
   * 閾値そのものを書き換えないのは、怯みごとの閾値成長と独立に管理するため。
   */
  thresholdMultiplier = 1;
  /** 累計被ダメージ（デバッグ・報酬判定用）。 */
  totalDamageTaken = 0;

  constructor(
    readonly def: MonsterPartDefinition,
    private readonly balance: CombatBalance,
  ) {
    this.id = def.id;
    this.partHp = def.partHp;
    this.flinchThreshold = def.flinchThreshold;
  }

  get isSevered(): boolean {
    return this.state === 'severed';
  }

  get isBroken(): boolean {
    return this.state !== 'intact';
  }

  get effectiveFlinchThreshold(): number {
    return this.flinchThreshold * this.thresholdMultiplier;
  }

  applyDamage(result: DamageResult, outcome: PartHitOutcome): PartHitOutcome {
    outcome.broke = false;
    outcome.severed = false;
    outcome.flinched = false;
    this.totalDamageTaken += result.total;

    // 部位耐久: 破壊可能かつ未破壊のときだけ削る
    if (this.def.breakable && this.state === 'intact' && this.partHp > 0) {
      this.partHp = Math.max(0, this.partHp - result.partDamage);
      if (this.partHp === 0) {
        // 切断は指定の物理種別でトドメを刺したときだけ。それ以外は通常破壊で終わる。
        if (this.def.severable && result.damageType === this.def.severDamageType) {
          this.state = 'severed';
          outcome.severed = true;
        } else {
          this.state = 'broken';
          outcome.broke = true;
        }
      }
    }

    this.flinchAccumulated += result.flinchDamage;
    if (this.flinchAccumulated >= this.effectiveFlinchThreshold) {
      this.flinchAccumulated = 0;
      // 同じ部位で怯ませ続けるハメを防ぐため閾値を上げていく
      this.flinchThreshold *= this.balance.flinchThresholdGrowth;
      outcome.flinched = true;
    }
    return outcome;
  }

  update(dt: number): void {
    if (this.flinchAccumulated > 0) {
      this.flinchAccumulated = Math.max(0, this.flinchAccumulated - this.balance.flinchDecayPerSecond * dt);
    }
  }

  reset(): void {
    this.partHp = this.def.partHp;
    this.state = 'intact';
    this.flinchAccumulated = 0;
    this.flinchThreshold = this.def.flinchThreshold;
    this.thresholdMultiplier = 1;
    this.totalDamageTaken = 0;
  }
}
