import type { WeatherConfig } from '@data/schemas/field';
import type { Random } from '@shared/rng/Random';

export type WeatherState = 'clear' | 'rain';

/**
 * 天候。晴れと雨を乱数区間で切り替える。
 * 生態（雨なら洞窟へ）と知覚（雨音で聞こえにくい）に影響し、演出側は状態を読むだけ。
 */
export class Weather {
  state: WeatherState;
  remaining: number;
  /** 雨の強さ 0〜1（切り替わりを滑らかに見せる演出用）。 */
  intensity = 0;

  constructor(
    private readonly cfg: WeatherConfig,
    private readonly rng: Random,
  ) {
    this.state = cfg.initial;
    this.remaining = this.rollDuration(this.state);
    this.intensity = this.state === 'rain' ? 1 : 0;
  }

  get isRaining(): boolean {
    return this.state === 'rain';
  }

  /** 知覚に掛ける倍率。 */
  get senseMultiplier(): number {
    return this.isRaining ? this.cfg.rainSenseMultiplier : 1;
  }

  /** 戻り値: このステップで天候が変わったか。 */
  update(dt: number): boolean {
    this.remaining -= dt;
    const target = this.isRaining ? 1 : 0;
    // 約 3 秒で降り始め/止み切る
    this.intensity += (target - this.intensity) * Math.min(1, dt / 3);
    if (this.remaining > 0) return false;
    this.state = this.isRaining ? 'clear' : 'rain';
    this.remaining = this.rollDuration(this.state);
    return true;
  }

  /** デバッグ/テスト用。 */
  force(state: WeatherState): void {
    this.state = state;
    this.remaining = this.rollDuration(state);
  }

  reset(): void {
    this.state = this.cfg.initial;
    this.remaining = this.rollDuration(this.state);
    this.intensity = this.state === 'rain' ? 1 : 0;
  }

  private rollDuration(state: WeatherState): number {
    const c = this.cfg;
    return state === 'rain' ? this.rng.range(c.rainMinSeconds, c.rainMaxSeconds) : this.rng.range(c.clearMinSeconds, c.clearMaxSeconds);
  }
}
