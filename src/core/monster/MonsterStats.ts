import type { MonsterDefinition } from '@data/schemas/monster';

/**
 * モンスターの HP / 内部スタミナ / 気絶蓄積。
 * 怒り・疲労のゲージは T09（MonsterAI 戦闘層）で追加する。
 */
export class MonsterStats {
  readonly maxHp: number;
  readonly maxStamina: number;
  hp: number;
  stamina: number;
  stunAccumulated = 0;

  constructor(private readonly def: MonsterDefinition['stats']) {
    this.maxHp = def.maxHp;
    this.maxStamina = def.maxStamina;
    this.hp = def.maxHp;
    this.stamina = def.maxStamina;
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  /** 戻り値: このダメージで死亡したか。 */
  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.hp = Math.max(0, this.hp - amount);
    return this.hp === 0;
  }

  /** 気絶蓄積。閾値到達で true を返し蓄積をリセットする。 */
  accumulateStun(amount: number): boolean {
    if (amount <= 0) return false;
    this.stunAccumulated += amount;
    if (this.stunAccumulated >= this.def.stunThreshold) {
      this.stunAccumulated = 0;
      return true;
    }
    return false;
  }

  reset(): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.stunAccumulated = 0;
  }
}
