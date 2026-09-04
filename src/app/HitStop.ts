import type { GameLoop } from './GameLoop';

/**
 * Hit Stop: 命中の瞬間だけシミュレーション時間を止める。
 * 実時間（描画フレーム）で計測し、timeScale を 0 にするだけなので
 * 入力・カメラ・UI は動き続け、攻撃タイムラインとモンスターだけが止まる。
 */
export class HitStop {
  private remainingSeconds = 0;
  private previousTimeScale = 1;

  constructor(private readonly loop: GameLoop) {}

  get isActive(): boolean {
    return this.remainingSeconds > 0;
  }

  trigger(seconds: number): void {
    if (seconds <= 0) return;
    if (!this.isActive) {
      this.previousTimeScale = this.loop.timeScale;
      this.loop.timeScale = 0;
    }
    // 連続ヒットでは長い方を採用（積算すると多段ヒットで止まりすぎる）
    this.remainingSeconds = Math.max(this.remainingSeconds, seconds);
  }

  update(frameDt: number): void {
    if (!this.isActive) return;
    this.remainingSeconds -= frameDt;
    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.loop.timeScale = this.previousTimeScale;
    }
  }
}
