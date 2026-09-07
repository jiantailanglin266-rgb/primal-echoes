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
  /** ソフトロック対象（null を返せば無効）。 */
  private softLockTarget: (() => Vec3 | null) | null = null;
  private lookSuppressRemaining = 0;

  private readonly target = new Vec3();
  private readonly desired = new Vec3();
  private readonly current = new Vec3();
  /** バネ追従の速度（位置 / 注視点）。 */
  private readonly velocity = new Vec3();
  private readonly lookCurrent = new Vec3();
  private readonly lookVelocity = new Vec3();
  private initialized = false;
  /** 0〜1。ダッシュ中に 1 へ寄せ、FOV を広げる。 */
  private speedRatio = 0;
  private fovCurrent: number;
  private shakeAmplitude = 0;
  private shakeSeconds = 0;
  private shakeTotalSeconds = 0;
  private shakeSeed = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly terrain: HeightProvider,
    private readonly balance: CameraBalance,
  ) {
    this.pitch = balance.initialPitchRad;
    this.fovCurrent = balance.fovDeg;
  }

  /** 移動速度の割合（ダッシュ = 1）。FOV の広がりに使う。 */
  setSpeedRatio(ratio: number): void {
    this.speedRatio = clamp(ratio, 0, 1);
  }

  get isLockedOn(): boolean {
    return this.lockOnTarget !== null;
  }

  setLockOnTarget(target: (() => Vec3) | null): void {
    this.lockOnTarget = target;
  }

  /**
   * カメラを揺らす。amplitude はメートル。大きい方の揺れで上書きし、積算はしない
   * （多段ヒットで画面が見えなくなるのを防ぐ）。
   */
  shake(amplitude: number, seconds: number): void {
    if (amplitude <= this.shakeAmplitude * (this.shakeSeconds / Math.max(this.shakeTotalSeconds, 1e-6))) return;
    this.shakeAmplitude = amplitude;
    this.shakeSeconds = seconds;
    this.shakeTotalSeconds = seconds;
    this.shakeSeed = Math.random() * 1000;
  }

  setSoftLockTarget(target: (() => Vec3 | null) | null): void {
    this.softLockTarget = target;
  }

  /** マウス移動量（ピクセル）で向きを更新する。ロックオン中は無視する。 */
  applyLook(deltaX: number, deltaY: number): void {
    if (this.lockOnTarget) return;
    // プレイヤーが自分で振っている間はソフトロックが逆らわないようにする
    if (deltaX !== 0 || deltaY !== 0) this.lookSuppressRemaining = this.balance.softLockSuppressSeconds;
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
    // 肩越し: カメラの右方向へ注視点をずらす（ロックオン中はターゲットが見やすいよう半分）
    const shoulder = this.balance.shoulderOffset * (this.lockOnTarget ? 0.5 : 1);
    this.target.x += -Math.cos(this.yaw) * shoulder;
    this.target.z += Math.sin(this.yaw) * shoulder;

    if (this.lockOnTarget) {
      const lock = this.lockOnTarget();
      const desiredYaw = Math.atan2(lock.x - followPosition.x, lock.z - followPosition.z);
      const t = 1 - Math.exp(-this.balance.lockOnSharpness * frameDt);
      this.yaw += wrapAngle(desiredYaw - this.yaw) * t;
      this.pitch += (this.balance.lockOnPitchRad - this.pitch) * t;
    } else {
      this.applySoftLock(followPosition, frameDt);
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
      this.lookCurrent.copy(this.target);
      this.initialized = true;
    } else {
      // 位置と注視点を別々のバネで追従させる（注視点は硬め、位置は柔らかめ）
      const dt = Math.min(frameDt, 1 / 20);
      springStep(this.current, this.velocity, this.desired, this.balance.springStiffness, this.balance.springDamping, dt);
      springStep(this.lookCurrent, this.lookVelocity, this.target, this.balance.lookSpringStiffness, this.balance.lookSpringDamping, dt);
    }

    // ダッシュで FOV を広げる（速度感）
    const fovTarget = this.balance.fovDeg + this.balance.dashFovBoostDeg * this.speedRatio;
    this.fovCurrent += (fovTarget - this.fovCurrent) * Math.min(1, frameDt * 6);
    if (Math.abs(this.camera.fov - this.fovCurrent) > 0.01) {
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.set(this.current.x, this.current.y, this.current.z);
    this.camera.lookAt(this.lookCurrent.x, this.lookCurrent.y, this.lookCurrent.z);
    this.applyShake(frameDt);
  }

  /**
   * ソフトロック: 視界内の近い対象へ、マウスを触っていない間だけ緩く yaw を寄せる。
   * ロックオンのように固定はせず、「なんとなく敵の方を向いている」程度に留める。
   */
  private applySoftLock(followPosition: Vec3, frameDt: number): void {
    this.lookSuppressRemaining = Math.max(0, this.lookSuppressRemaining - frameDt);
    if (this.lookSuppressRemaining > 0 || !this.softLockTarget) return;
    const target = this.softLockTarget();
    if (!target) return;
    const dx = target.x - followPosition.x;
    const dz = target.z - followPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > this.balance.softLockRange || distance < 1e-3) return;
    const desiredYaw = Math.atan2(dx, dz);
    const delta = wrapAngle(desiredYaw - this.yaw);
    if (Math.abs(delta) > this.balance.softLockAngleRad) return;
    const t = 1 - Math.exp(-this.balance.softLockSharpness * frameDt);
    this.yaw += delta * t;
  }

  /** 減衰する擬似ランダム振動を lookAt 後の位置へ加える（向きは変えない）。 */
  private applyShake(frameDt: number): void {
    if (this.shakeSeconds <= 0) return;
    this.shakeSeconds = Math.max(0, this.shakeSeconds - frameDt);
    const k = this.shakeSeconds / Math.max(this.shakeTotalSeconds, 1e-6);
    const amp = this.shakeAmplitude * k * k;
    const t = (this.shakeTotalSeconds - this.shakeSeconds) * 60 + this.shakeSeed;
    const ox = Math.sin(t * 1.7) * Math.cos(t * 0.9) * amp;
    const oy = Math.sin(t * 2.3 + 1.3) * amp;
    this.camera.position.x += ox;
    this.camera.position.y += oy;
    if (this.shakeSeconds === 0) this.shakeAmplitude = 0;
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

/** 減衰バネの 1 ステップ（半陰的オイラー）。 */
function springStep(position: Vec3, velocity: Vec3, target: Vec3, stiffness: number, damping: number, dt: number): void {
  velocity.x += ((target.x - position.x) * stiffness - velocity.x * damping) * dt;
  velocity.y += ((target.y - position.y) * stiffness - velocity.y * damping) * dt;
  velocity.z += ((target.z - position.z) * stiffness - velocity.z * damping) * dt;
  position.x += velocity.x * dt;
  position.y += velocity.y * dt;
  position.z += velocity.z * dt;
}
