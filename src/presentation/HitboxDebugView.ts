import * as THREE from 'three';
import type { Vec3 } from '@shared/math/Vec3';
import { PLACEHOLDER_COLORS } from './placeholders';

export interface DebugSphere {
  center: Vec3;
  radius: number;
}

/**
 * アクティブなヒットボックスをワイヤー球で可視化する（デバッグ専用）。
 * 攻撃判定のタイミングと位置をデータ調整しながら目視できるようにするためのもの。
 */
export class HitboxDebugView {
  readonly object = new THREE.Group();
  private readonly pool: THREE.Mesh[] = [];
  private readonly geometry = new THREE.SphereGeometry(1, 12, 8);
  private readonly materials: Record<'player' | 'monster' | 'projectile', THREE.MeshBasicMaterial> = {
    player: new THREE.MeshBasicMaterial({ color: PLACEHOLDER_COLORS.hitboxDebug, wireframe: true, transparent: true, opacity: 0.6 }),
    monster: new THREE.MeshBasicMaterial({ color: PLACEHOLDER_COLORS.monsterHitboxDebug, wireframe: true, transparent: true, opacity: 0.6 }),
    projectile: new THREE.MeshBasicMaterial({ color: PLACEHOLDER_COLORS.monsterHitboxDebug, wireframe: true, transparent: true, opacity: 0.35 }),
  };
  private used = 0;

  constructor() {
    this.object.name = 'hitbox-debug';
  }

  begin(): void {
    this.used = 0;
  }

  add(spheres: readonly DebugSphere[], kind: 'player' | 'monster' | 'projectile'): void {
    for (const sphere of spheres) {
      let mesh = this.pool[this.used];
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.materials[kind]);
        this.pool[this.used] = mesh;
        this.object.add(mesh);
      }
      mesh.material = this.materials[kind];
      mesh.visible = true;
      mesh.position.set(sphere.center.x, sphere.center.y, sphere.center.z);
      mesh.scale.setScalar(sphere.radius);
      this.used++;
    }
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) {
      (this.pool[i] as THREE.Mesh).visible = false;
    }
  }
}
