import * as THREE from 'three';
import type { CameraBalance } from '@data/schemas/balance';
import type { HeightProvider } from '@core/world/Terrain';
import { clamp, wrapAngle } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';

/**
 * 三人称カメラ。
 * - Free: マウスで yaw/pitch を回す
 * - Lock On: ターゲット方向へ yaw を指数追従させ、pitch を固定
 * - 地形コリジョン: ターゲットからカメラへのレイを地形高さでサンプリングし、めり込む手前で止める
 * Soft Lock は Should Have（後回し）。
 */
export class CameraRig {
  /** 0 でプレイヤーの初期向き（+Z）と同じ方向を向き、背後から見る構図になる。 */
  yaw = 0;
  pitch: number;

  /** ロックオン対象のワールド位置を返す関数。null で Free カメラ。 */
  private lockOnTarget: (() => Vec3) | null = null;

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

  get isLockedOn(): boolean {
    return this.lockOnTarget !== null;
  }

  setLockOnTarget(target: (() => Vec3) | null): void {
    this.lockOnTarget = target;
  }

  /** マウス移動量（ピクセル）で向きを更新する。ロックオン中は無視する。 */
  applyLook(deltaX: number, deltaY: number): void {
    if (this.lockOnTarget) return;
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
  update(followPosition: Vec3, frameDt: number): void {
    this.target.copy(followPosition);
    this.target.y += this.balance.targetHeight;

    if (this.lockOnTarget) {
      const lock = this.lockOnTarget();
      const desiredYaw = Math.atan2(lock.x - followPosition.x, lock.z - followPosition.z);
      const t = 1 - Math.exp(-this.balance.lockOnSharpness * frameDt);
      this.yaw += wrapAngle(desiredYaw - this.yaw) * t;
      this.pitch += (this.balance.lockOnPitchRad - this.pitch) * t;
    }

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

  /** ワールド座標をスクリーン座標（px）へ投影する。UI のダメージ数字などで使う。 */
  project(world: Vec3, out: { x: number; y: number; visible: boolean }, width: number, height: number): void {
    projectScratch.set(world.x, world.y, world.z).project(this.camera);
    out.visible = projectScratch.z >= -1 && projectScratch.z <= 1;
    out.x = (projectScratch.x * 0.5 + 0.5) * width;
    out.y = (-projectScratch.y * 0.5 + 0.5) * height;
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

const projectScratch = new THREE.Vector3();
