import { Vec3 } from '@shared/math/Vec3';

/**
 * 死骸。スカベンジャーの餌になり、プレイヤーの剥ぎ取り対象にもなる（T15）。
 * 餌としての価値（meatSeconds）が尽きると消える。
 */
export class Carcass {
  readonly position = new Vec3();
  meatSeconds: number;
  /** 剥ぎ取り可能回数（T15 で消費）。 */
  carvesRemaining: number;
  /** 大型モンスターの死骸は消えない（剥ぎ取り猶予のため）。 */
  readonly persistent: boolean;
  age = 0;

  constructor(
    readonly id: number,
    readonly sourceId: string,
    position: Vec3,
    meatSeconds: number,
    carvesRemaining: number,
    persistent = false,
  ) {
    this.position.copy(position);
    this.meatSeconds = meatSeconds;
    this.carvesRemaining = carvesRemaining;
    this.persistent = persistent;
  }

  get isConsumed(): boolean {
    return !this.persistent && this.meatSeconds <= 0;
  }

  /** 食べられる。戻り値: 実際に減った秒数。 */
  feed(dt: number): number {
    const taken = Math.min(this.meatSeconds, dt);
    this.meatSeconds -= taken;
    return taken;
  }
}
