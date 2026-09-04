import type { PlayerBalance } from '@data/schemas/balance';
import { rotateTowards } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';
import type { HeightProvider } from '@core/world/Terrain';
import type { PlayerStats } from './PlayerStats';
import type { PlayerIntent } from './PlayerIntent';

export type PlayerLocomotionState = 'idle' | 'walk' | 'dash' | 'dodge';

/**
 * プレイヤーの移動・回避を担当する。
 * 攻撃中の挙動は PlayerCombat が「移動を禁止する」形で上（Player 集約）から制御し、
 * このクラス自体は攻撃を知らない。
 */
export class PlayerController {
  readonly position = new Vec3();
  /** 前ステップの位置。描画側の補間用。 */
  readonly previousPosition = new Vec3();
  /** 向き（Y 軸回転、ラジアン）。0 で +Z を向く。 */
  yaw = 0;
  state: PlayerLocomotionState = 'idle';
  /** 直近の回避終了からの経過秒。回避攻撃の受付窓に使う。 */
  timeSinceDodgeEnd = Infinity;

  private verticalVelocity = 0;
  private dodgeElapsed = 0;
  private dodgeProgress = 0;
  private readonly dodgeDirection = new Vec3();

  private readonly scratchMove = new Vec3();
  private readonly scratchForward = new Vec3();

  constructor(
    readonly stats: PlayerStats,
    private readonly terrain: HeightProvider,
    private readonly balance: PlayerBalance,
  ) {
    this.snapToGround();
  }

  /** 回避の無敵ウィンドウ内か。ヒット判定側がこれを参照してダメージを無効化する。 */
  get isInvulnerable(): boolean {
    if (this.state !== 'dodge') return false;
    const { invulnStartSeconds, invulnEndSeconds } = this.balance.dodge;
    return this.dodgeElapsed >= invulnStartSeconds && this.dodgeElapsed < invulnEndSeconds;
  }

  /** 現在向いている方向（XZ 単位ベクトル）。 */
  getForward(out = new Vec3()): Vec3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  teleport(x: number, z: number): void {
    this.position.set(x, 0, z);
    this.snapToGround();
    this.previousPosition.copy(this.position);
    this.verticalVelocity = 0;
  }

  /** 指定方向へ最大 maxDelta ラジアンだけ向き直る（攻撃 startup 中の微調整用）。 */
  turnTowards(direction: Vec3, maxDelta: number): void {
    if (direction.lengthSq() <= 1e-6) return;
    const targetYaw = Math.atan2(direction.x, direction.z);
    this.yaw = rotateTowards(this.yaw, targetYaw, maxDelta);
  }

  /** 向いている方向へ distance だけ移動する（攻撃の踏み込み用）。地面に沿わせる。 */
  moveAlongForward(distance: number): void {
    if (distance === 0) return;
    this.getForward(this.scratchForward);
    this.position.addScaled(this.scratchForward, distance);
    this.position.y = Math.max(this.position.y, this.terrain.getHeight(this.position.x, this.position.z));
  }

  update(intent: PlayerIntent, dt: number): void {
    this.previousPosition.copy(this.position);

    if (this.state === 'dodge') {
      this.updateDodge(dt);
    } else if (intent.dodge && this.tryStartDodge(intent)) {
      this.updateDodge(dt);
    } else {
      this.timeSinceDodgeEnd += dt;
      this.updateLocomotion(intent, dt);
    }

    this.applyGravity(dt);
  }

  private updateLocomotion(intent: PlayerIntent, dt: number): void {
    const move = this.scratchMove.copy(intent.move);
    const magnitude = Math.min(move.length(), 1);

    if (magnitude <= 1e-4) {
      this.state = 'idle';
      return;
    }

    move.normalize();
    const wantsDash = intent.dash && this.stats.stamina >= this.balance.dashMinStamina;
    let speed = this.balance.walkSpeed;
    this.state = 'walk';

    if (wantsDash && this.stats.drainStamina(this.balance.dashStaminaPerSecond, dt)) {
      speed = this.balance.dashSpeed;
      this.state = 'dash';
    }

    this.turnTowards(move, this.balance.turnSpeedRadPerSecond * dt);
    this.position.addScaled(move, speed * magnitude * dt);
  }

  private tryStartDodge(intent: PlayerIntent): boolean {
    if (!this.stats.tryConsumeStamina(this.balance.dodge.staminaCost)) return false;

    // 入力方向があればその方向へ、なければ向いている方向へ回避する
    if (intent.move.lengthSq() > 1e-6) {
      this.dodgeDirection.copy(intent.move).normalize();
      this.yaw = Math.atan2(this.dodgeDirection.x, this.dodgeDirection.z);
    } else {
      this.getForward(this.dodgeDirection);
    }

    this.state = 'dodge';
    this.dodgeElapsed = 0;
    this.dodgeProgress = 0;
    return true;
  }

  private updateDodge(dt: number): void {
    const { durationSeconds, distance } = this.balance.dodge;
    this.dodgeElapsed += dt;
    const t = Math.min(this.dodgeElapsed / durationSeconds, 1);
    // ease-out: 出だしが速く終わりが緩む。移動量は進捗の差分から出すので dt に依存しない。
    const eased = 1 - (1 - t) * (1 - t);
    const delta = (eased - this.dodgeProgress) * distance;
    this.dodgeProgress = eased;
    this.position.addScaled(this.dodgeDirection, delta);

    if (t >= 1) {
      this.state = 'idle';
      this.timeSinceDodgeEnd = 0;
    }
  }

  private applyGravity(dt: number): void {
    const ground = this.terrain.getHeight(this.position.x, this.position.z);
    this.verticalVelocity -= this.balance.gravity * dt;
    this.position.y += this.verticalVelocity * dt;
    if (this.position.y <= ground) {
      this.position.y = ground;
      this.verticalVelocity = 0;
    }
  }

  private snapToGround(): void {
    this.position.y = this.terrain.getHeight(this.position.x, this.position.z);
  }
}
