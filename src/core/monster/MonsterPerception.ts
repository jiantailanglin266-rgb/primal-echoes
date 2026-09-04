import type { PerceptionConfig } from '@data/schemas/monster';
import { Vec3 } from '@shared/math/Vec3';
import type { Monster } from './Monster';

/** 知覚対象（プレイヤー）。core はプレイヤー型を知らなくてよい。 */
export interface PerceptionSubject {
  position: Vec3;
  /** ダッシュ・攻撃中など、音を立てているか。 */
  isNoisy: boolean;
}

/**
 * 視覚（正面の扇形）と聴覚（全周、騒がしいと遠くまで届く）。
 * 一度見つけると、視界から外れても一定時間・一定距離までは「追跡」を続ける。
 */
export class MonsterPerception {
  detected = false;
  /** 最後に対象を捉えた位置。見失った後の捜索先。 */
  readonly lastKnownPosition = new Vec3();
  private lostSeconds = 0;

  constructor(private readonly cfg: PerceptionConfig) {}

  get secondsSinceLost(): number {
    return this.lostSeconds;
  }

  /** 戻り値: このステップで対象を捉えているか（追跡中を含む）。 */
  update(dt: number, monster: Monster, subject: PerceptionSubject, asleep: boolean, environmentMultiplier = 1): boolean {
    const senseMul = (asleep ? this.cfg.sleepingSenseMultiplier : 1) * environmentMultiplier;
    const distance = monster.position.horizontalDistanceTo(subject.position);
    const relativeAngle = monster.combat.relativeAngleTo(subject.position);

    const inSight = distance <= this.cfg.sightRange * senseMul && relativeAngle <= this.cfg.sightAngleRad;
    const hearingRange = this.cfg.hearingRange * senseMul;
    // 静かにしていれば聴覚範囲は半分。忍び寄りを成立させるため。
    const heard = distance <= (subject.isNoisy ? hearingRange : hearingRange * 0.5);

    if (inSight || heard) {
      this.detected = true;
      this.lostSeconds = 0;
      this.lastKnownPosition.copy(subject.position);
      return true;
    }

    if (!this.detected) return false;

    if (distance > this.cfg.loseTargetRange) {
      this.lostSeconds += dt;
      if (this.lostSeconds >= this.cfg.loseTargetSeconds) {
        this.detected = false;
        this.lostSeconds = 0;
        return false;
      }
    } else {
      // 範囲内なら（茂みに隠れていても）気配で追い続ける
      this.lostSeconds = 0;
      this.lastKnownPosition.copy(subject.position);
    }
    return true;
  }

  /** 攻撃を受けた等で強制的に発見状態にする。 */
  forceDetect(position: Vec3): void {
    this.detected = true;
    this.lostSeconds = 0;
    this.lastKnownPosition.copy(position);
  }

  forget(): void {
    this.detected = false;
    this.lostSeconds = 0;
  }
}
