import * as THREE from 'three';
import type { GameLoop } from '@app/GameLoop';
import type { HitStop } from '@app/HitStop';
import type { PostFX } from '@presentation/render/PostFX';
import type { FeedbackBalance } from '@data/schemas/balance';
import type { Vec3 } from '@shared/math/Vec3';

interface HitLight {
  light: THREE.PointLight;
  remaining: number;
  duration: number;
  peak: number;
}

/**
 * 「手応え」の演出をまとめる。ロジックには触れず、イベントから呼ばれるだけ。
 * - スローモーション（討伐・重い一撃）: GameLoop.timeScale を一時的に下げ、DoF を強める
 * - 命中の点光源: 数フレームだけ光って減衰する（ライト数は固定でプールし、シェーダ再コンパイルを避ける）
 * - 咆哮: 色収差の一瞬の強調（カメラシェイクは CameraRig 側）
 */
export class Juice {
  private readonly lights: HitLight[] = [];
  private slowRemaining = 0;
  private slowScale = 1;
  private baseAperture: number;

  constructor(
    private readonly loop: GameLoop,
    private readonly hitStop: HitStop,
    private readonly postfx: PostFX,
    scene: THREE.Scene,
    private readonly feedback: FeedbackBalance,
  ) {
    this.baseAperture = postfx.settings.dofAperture;
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 9, 2);
      light.castShadow = false;
      scene.add(light);
      this.lights.push({ light, remaining: 0, duration: 1, peak: 0 });
    }
  }

  get isSlowMotion(): boolean {
    return this.slowRemaining > 0;
  }

  /** 討伐や重い一撃の直後に呼ぶ。既にスロー中なら長い方・遅い方を採用する。 */
  slowMotion(scale: number, seconds: number): void {
    this.slowScale = this.isSlowMotion ? Math.min(this.slowScale, scale) : scale;
    this.slowRemaining = Math.max(this.slowRemaining, seconds);
    this.applyTimeScale(this.slowScale);
    this.postfx.settings.dofAperture = this.baseAperture * this.feedback.slowMoDofMultiplier;
    this.postfx.applySettings();
  }

  hitLight(position: Vec3, colorHex: number, intensity: number, seconds = 0.25): void {
    // 一番古いものを再利用
    let slot = this.lights[0] as HitLight;
    for (const l of this.lights) if (l.remaining < slot.remaining) slot = l;
    slot.light.position.set(position.x, position.y + 0.3, position.z);
    slot.light.color.setHex(colorHex);
    slot.remaining = seconds;
    slot.duration = seconds;
    slot.peak = intensity;
    slot.light.intensity = intensity;
  }

  roar(): void {
    this.postfx.pulseChromatic(this.feedback.roarChromaticPulse);
  }

  /** 実時間で更新（スローの残り時間はゲーム時間に縛られない）。 */
  update(frameDt: number): void {
    if (this.slowRemaining > 0) {
      this.slowRemaining -= frameDt;
      if (this.slowRemaining <= 0) {
        this.slowRemaining = 0;
        this.applyTimeScale(1);
        this.postfx.settings.dofAperture = this.baseAperture;
        this.postfx.applySettings();
      }
    }
    for (const l of this.lights) {
      if (l.remaining <= 0) continue;
      l.remaining -= frameDt;
      const k = Math.max(0, l.remaining / l.duration);
      l.light.intensity = l.peak * k * k;
    }
  }

  /** Hit Stop 中はその解除後の値として渡し、そうでなければ即座に反映する。 */
  private applyTimeScale(scale: number): void {
    this.hitStop.setRestoreTimeScale(scale);
    if (!this.hitStop.isActive) this.loop.timeScale = scale;
  }

  /** 品質プリセット変更などで基準絞りが変わったら呼ぶ。 */
  refreshBaseAperture(): void {
    if (!this.isSlowMotion) this.baseAperture = this.postfx.settings.dofAperture;
  }
}
