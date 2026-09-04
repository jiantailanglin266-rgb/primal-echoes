import * as THREE from 'three';
import type { PlayerController } from '@core/player/PlayerController';
import { Vec3 } from '@shared/math/Vec3';
import { createPlayerPlaceholder } from './placeholders';

/**
 * PlayerController の状態を Three.js オブジェクトへ反映する。
 * 位置は前ステップと現ステップの間を alpha で補間し、60Hz シミュレーションでも
 * 高リフレッシュレートで滑らかに見せる。
 */
export class PlayerView {
  readonly object: THREE.Group;
  private readonly interpolated = new Vec3();

  /** 描画に使った補間済み位置。カメラ追従などで再利用する。 */
  get renderPosition(): Vec3 {
    return this.interpolated;
  }

  constructor(private readonly player: PlayerController) {
    this.object = createPlayerPlaceholder();
  }

  sync(alpha: number): void {
    this.interpolated.copy(this.player.previousPosition).lerp(this.player.position, alpha);
    this.object.position.set(this.interpolated.x, this.interpolated.y, this.interpolated.z);
    this.object.rotation.y = this.player.yaw;

    // 回避中は身を屈める仮アニメーション（本番アニメが来るまでの視認用）
    const crouch = this.player.state === 'dodge' ? 0.75 : 1;
    this.object.scale.y += (crouch - this.object.scale.y) * 0.35;
  }
}
