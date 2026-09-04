import { SIMULATION_CONFIG } from '@shared/config/simulation';

export interface GameLoopCallbacks {
  /** 固定ステップで呼ばれる。dt は常に fixedDeltaSeconds * timeScale。 */
  update: (dt: number) => void;
  /**
   * 描画フレームごとに呼ばれる。alpha は次ステップまでの補間率 [0,1)。
   * frameDt は実時間の経過（UI アニメ等、シミュレーションと無関係な用途向け）。
   */
  render: (alpha: number, frameDt: number) => void;
}

export interface GameLoopOptions {
  fixedDeltaSeconds?: number;
  maxSubStepsPerFrame?: number;
  maxFrameDeltaSeconds?: number;
}

/**
 * 固定タイムステップのゲームループ。
 * `advance()` は実時間を受け取って必要な回数だけ update を呼ぶ純粋なロジックで、
 * requestAnimationFrame から切り離してテストできる。
 */
export class GameLoop {
  readonly fixedDeltaSeconds: number;
  private readonly maxSubSteps: number;
  private readonly maxFrameDelta: number;

  private accumulator = 0;
  private running = false;
  private lastTimestampMs: number | null = null;
  private rafHandle: number | null = null;

  /**
   * シミュレーション時間のスケール。Hit Stop やスローモーションで使う。
   * 0 にすると update は呼ばれるが dt=0 になる（状態は止まるが描画は続く）。
   */
  timeScale = 1;

  /** 累計シミュレーション時間（秒）。timeScale の影響を受ける。 */
  simulationTime = 0;

  /** 累計ステップ数。デバッグとテストで利用。 */
  stepCount = 0;

  constructor(
    private readonly callbacks: GameLoopCallbacks,
    options: GameLoopOptions = {},
  ) {
    this.fixedDeltaSeconds = options.fixedDeltaSeconds ?? SIMULATION_CONFIG.fixedDeltaSeconds;
    this.maxSubSteps = options.maxSubStepsPerFrame ?? SIMULATION_CONFIG.maxSubStepsPerFrame;
    this.maxFrameDelta = options.maxFrameDeltaSeconds ?? SIMULATION_CONFIG.maxFrameDeltaSeconds;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * 実時間 frameDt 秒ぶんループを進める。
   * 戻り値は実行した update の回数。
   */
  advance(frameDt: number): number {
    const clampedDt = Math.min(Math.max(frameDt, 0), this.maxFrameDelta);
    this.accumulator += clampedDt;

    let steps = 0;
    while (this.accumulator >= this.fixedDeltaSeconds && steps < this.maxSubSteps) {
      const dt = this.fixedDeltaSeconds * this.timeScale;
      this.callbacks.update(dt);
      this.simulationTime += dt;
      this.stepCount += 1;
      this.accumulator -= this.fixedDeltaSeconds;
      steps += 1;
    }

    // 上限に達した場合、残りの遅延は捨てる。追いつこうとして永遠に update だけを
    // 回し続けるより、少し飛ばして描画を維持するほうがプレイ体験として安全なため。
    if (steps >= this.maxSubSteps && this.accumulator >= this.fixedDeltaSeconds) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.fixedDeltaSeconds;
    this.callbacks.render(alpha, clampedDt);
    return steps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestampMs = null;
    this.rafHandle = requestAnimationFrame(this.onAnimationFrame);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private readonly onAnimationFrame = (timestampMs: number): void => {
    if (!this.running) return;
    const frameDt = this.lastTimestampMs === null ? 0 : (timestampMs - this.lastTimestampMs) / 1000;
    this.lastTimestampMs = timestampMs;
    this.advance(frameDt);
    this.rafHandle = requestAnimationFrame(this.onAnimationFrame);
  };
}
