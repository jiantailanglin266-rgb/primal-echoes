import * as THREE from 'three';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { PLACEHOLDER_COLORS } from './placeholders';

/**
 * アクティブなヒットボックスをワイヤー球で可視化する（デバッグ専用）。
 * 攻撃判定のタイミングと位置をデータ調整しながら目視できるようにするためのもの。
 */
export class HitboxDebugView {
  readonly object = new THREE.Group();
  private readonly pool: THREE.Mesh[] = [];
  private readonly material = new THREE.MeshBasicMaterial({
    color: PLACEHOLDER_COLORS.hitboxDebug,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });
  private readonly geometry = new THREE.SphereGeometry(1, 12, 8);

  constructor() {
    this.object.name = 'hitbox-debug';
  }

  sync(hitboxes: readonly WorldHitbox[]): void {
    for (let i = 0; i < hitboxes.length; i++) {
      const hitbox = hitboxes[i] as WorldHitbox;
      let mesh = this.pool[i];
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.material);
        this.pool[i] = mesh;
        this.object.add(mesh);
      }
      mesh.visible = true;
      mesh.position.set(hitbox.center.x, hitbox.center.y, hitbox.center.z);
      mesh.scale.setScalar(hitbox.radius);
    }
    for (let i = hitboxes.length; i < this.pool.length; i++) {
      (this.pool[i] as THREE.Mesh).visible = false;
    }
  }
}
