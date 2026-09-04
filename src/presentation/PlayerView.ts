import * as THREE from 'three';
import type { Player } from '@core/player/Player';
import type { PhaseInfo } from '@core/combat/AttackData';
import { Vec3 } from '@shared/math/Vec3';
import { lerp } from '@shared/math/scalar';
import { createPlayerPlaceholder } from './placeholders';

/**
 * 武器ピボットの姿勢（オイラー角）。本番アニメが来るまでの手続きアニメ用キーポーズ。
 * 攻撃の「予備動作が見える」ことが戦闘設計の要なので、startup で大きく振りかぶる。
 */
// rotation.x が負なら刃は「後ろ上」（振りかぶり）、正なら「前下」（振り下ろし）になる。
const WEAPON_POSES = {
  rest: { x: 0.1, y: 0, z: 0.35 },
  windup: { x: -1.15, y: 0.2, z: 0.4 },
  strike: { x: 1.9, y: -0.1, z: 0.1 },
  chargeHold: { x: -1.35, y: 0.3, z: 0.5 },
} as const;

type Pose = { x: number; y: number; z: number };

/**
 * Player の状態を Three.js オブジェクトへ反映する。
 * 位置は前ステップと現ステップの間を alpha で補間し、60Hz シミュレーションでも
 * 高リフレッシュレートで滑らかに見せる。
 */
export class PlayerView {
  readonly object: THREE.Group;
  private readonly weaponPivot: THREE.Group;
  private readonly interpolated = new Vec3();
  private readonly phaseInfo: PhaseInfo = { phase: 'done', progress: 0 };
  private readonly pose: Pose = { ...WEAPON_POSES.rest };

  /** 描画に使った補間済み位置。カメラ追従などで再利用する。 */
  get renderPosition(): Vec3 {
    return this.interpolated;
  }

  constructor(private readonly player: Player) {
    const placeholder = createPlayerPlaceholder();
    this.object = placeholder.group;
    this.weaponPivot = placeholder.weaponPivot;
    this.applyPose(WEAPON_POSES.rest);
  }

  sync(alpha: number): void {
    const controller = this.player.controller;
    this.interpolated.copy(controller.previousPosition).lerp(controller.position, alpha);
    this.object.position.set(this.interpolated.x, this.interpolated.y, this.interpolated.z);
    this.object.rotation.y = controller.yaw;

    // 回避中は身を屈める仮アニメーション（本番アニメが来るまでの視認用）
    const crouch = controller.state === 'dodge' ? 0.75 : 1;
    this.object.scale.y += (crouch - this.object.scale.y) * 0.35;

    this.updateWeaponPose();
  }

  private updateWeaponPose(): void {
    const combat = this.player.combat;

    if (combat.state === 'charging') {
      // チャージ中は振りかぶったまま、レベルが上がるほど小刻みに震える
      const shake = Math.sin(performance.now() * 0.05) * 0.03 * (combat.chargeLevel + 1);
      this.pose.x = WEAPON_POSES.chargeHold.x + shake;
      this.pose.y = WEAPON_POSES.chargeHold.y;
      this.pose.z = WEAPON_POSES.chargeHold.z;
      this.applyPose(this.pose);
      return;
    }

    const info = combat.getPhase(this.phaseInfo);
    switch (info.phase) {
      case 'startup':
        blendPose(WEAPON_POSES.rest, WEAPON_POSES.windup, easeOut(info.progress), this.pose);
        break;
      case 'active':
        blendPose(WEAPON_POSES.windup, WEAPON_POSES.strike, info.progress, this.pose);
        break;
      case 'recovery':
        blendPose(WEAPON_POSES.strike, WEAPON_POSES.rest, easeInOut(info.progress), this.pose);
        break;
      default:
        blendPose(this.pose, WEAPON_POSES.rest, 0.25, this.pose);
        break;
    }
    this.applyPose(this.pose);
  }

  private applyPose(pose: Pose): void {
    this.weaponPivot.rotation.set(pose.x, pose.y, pose.z);
  }
}

function blendPose(a: Pose, b: Pose, t: number, out: Pose): void {
  out.x = lerp(a.x, b.x, t);
  out.y = lerp(a.y, b.y, t);
  out.z = lerp(a.z, b.z, t);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
