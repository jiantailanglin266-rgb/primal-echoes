import * as THREE from 'three';
import type { CameraBalance } from '@data/schemas/balance';
import type { HeightProvider } from '@core/world/Terrain';
import { clamp } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';

/**
 * 三人称カメラ。
 * - Free: マウスで yaw/pitch を回す
 * - 地形コリジョン: ターゲットからカメラへのレイを地形高さでサンプリングし、めり込む手前で止める
 * Lock On / Soft Lock は T06（モンスター実装後）で追加する。
 */
export class CameraRig {
  /** 0 でプレイヤーの初期向き（+Z）と同じ方向を向き、背後から見る構図になる。 */
  yaw = 0;
  pitch: number;

  private readonly target = new Vec3();
  private readonly desired = new Vec3();
  private readonly current = new Vec3();
  private initialized = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly terrain: HeightProvider,
    private readonly balance: CameraBalance,
  ) {
    this.pitch = balance.initialPitchRad;
  }

  /** マウス移動量（ピクセル）で向きを更新する。 */
  applyLook(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.balance.lookSensitivity;
    this.pitch = clamp(
      this.pitch + deltaY * this.balance.lookSensitivity,
      this.balance.pitchMinRad,
      this.balance.pitchMaxRad,
    );
  }

  /** カメラ基準の前方向（XZ）。プレイヤー移動のカメラ相対変換に使う。 */
  getForwardXZ(out = new Vec3()): Vec3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  getRightXZ(out = new Vec3()): Vec3 {
    // right = forward × up
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  /**
   * ターゲット位置（補間済み）に追従してカメラを更新する。
   * frameDt は描画フレームの実時間。カメラは演出なのでシミュレーション時間に縛らない。
   */
  update(targetPosition: Vec3, frameDt: number): void {
    this.target.copy(targetPosition);
    this.target.y += this.balance.targetHeight;

    const cosPitch = Math.cos(this.pitch);
    const dirX = -Math.sin(this.yaw) * cosPitch;
    const dirY = Math.sin(this.pitch);
    const dirZ = -Math.cos(this.yaw) * cosPitch;

    const distance = this.resolveCollisionDistance(dirX, dirY, dirZ);
    this.desired.set(
      this.target.x + dirX * distance,
      this.target.y + dirY * distance,
      this.target.z + dirZ * distance,
    );

    if (!this.initialized) {
      this.current.copy(this.desired);
      this.initialized = true;
    } else {
      // 指数減衰でフレームレート非依存に追従させる
      const t = 1 - Math.exp(-this.balance.followSharpness * frameDt);
      this.current.lerp(this.desired, t);
    }

    this.camera.position.set(this.current.x, this.current.y, this.current.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }

  /** ターゲットからカメラ方向へ進み、地形へめり込む直前の距離を返す。 */
  private resolveCollisionDistance(dirX: number, dirY: number, dirZ: number): number {
    const { distance, minDistance, groundMargin, collisionSamples } = this.balance;
    for (let i = 1; i <= collisionSamples; i++) {
      const d = (distance * i) / collisionSamples;
      const x = this.target.x + dirX * d;
      const y = this.target.y + dirY * d;
      const z = this.target.z + dirZ * d;
      const ground = this.terrain.getHeight(x, z) + groundMargin;
      if (y < ground) {
        const previous = (distance * (i - 1)) / collisionSamples;
        return Math.max(previous, minDistance);
      }
    }
    return distance;
  }
}
