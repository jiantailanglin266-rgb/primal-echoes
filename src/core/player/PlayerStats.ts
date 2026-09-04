import type { PlayerBalance } from '@data/schemas/balance';
import { clamp } from '@shared/math/scalar';

/**
 * プレイヤーの HP / スタミナ。
 * 攻撃力・防御力などの集計は装備システム（T15 以降）で追加する。
 */
export class PlayerStats {
  readonly maxHp: number;
  readonly maxStamina: number;
  hp: number;
  stamina: number;

  /** 直近のスタミナ消費からの経過秒。回復開始の遅延判定に使う。 */
  private sinceStaminaUse = Infinity;

  /** デバッグ用: true の間はスタミナが減らない。 */
  infiniteStamina = false;

  constructor(private readonly balance: PlayerBalance) {
    this.maxHp = balance.maxHp;
    this.maxStamina = balance.maxStamina;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  get staminaRatio(): number {
    return this.stamina / this.maxStamina;
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  /** 一括消費（回避など）。足りなければ消費せず false。 */
  tryConsumeStamina(amount: number): boolean {
    if (this.infiniteStamina) return true;
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.sinceStaminaUse = 0;
    return true;
  }

  /** 継続消費（ダッシュなど）。残量があれば減らして true、尽きたら false。 */
  drainStamina(perSecond: number, dt: number): boolean {
    if (this.infiniteStamina) return true;
    if (this.stamina <= 0) return false;
    this.stamina = Math.max(0, this.stamina - perSecond * dt);
    this.sinceStaminaUse = 0;
    return this.stamina > 0;
  }

  takeDamage(amount: number): void {
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
  }

  heal(amount: number): void {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  fullRestore(): void {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
  }

  update(dt: number): void {
    this.sinceStaminaUse += dt;
    // 消費直後に即回復すると「ダッシュを小刻みに押す」だけで実質無限になるため遅延を挟む
    if (this.sinceStaminaUse >= this.balance.staminaRegenDelaySeconds) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.balance.staminaRegenPerSecond * dt);
    }
  }
}
