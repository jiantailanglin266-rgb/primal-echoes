import * as THREE from 'three';
import type { Projectile } from '@core/combat/Projectile';
import { PLACEHOLDER_COLORS } from './placeholders';

/** 投射物（岩）のプレースホルダー描画。プールで使い回す。 */
export class ProjectileView {
  readonly object = new THREE.Group();
  private readonly pool: THREE.Mesh[] = [];
  private readonly geometry = new THREE.DodecahedronGeometry(1, 0);
  private readonly material = new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.projectile, roughness: 1 });

  sync(projectiles: readonly Projectile[], alpha: number): void {
    let used = 0;
    for (const p of projectiles) {
      if (!p.alive) continue;
      let mesh = this.pool[used];
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.material);
        mesh.castShadow = true;
        this.pool[used] = mesh;
        this.object.add(mesh);
      }
      mesh.visible = true;
      const x = p.previousPosition.x + (p.position.x - p.previousPosition.x) * alpha;
      const y = p.previousPosition.y + (p.position.y - p.previousPosition.y) * alpha;
      const z = p.previousPosition.z + (p.position.z - p.previousPosition.z) * alpha;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(p.radius);
      mesh.rotation.x += 0.15;
      used++;
    }
    for (let i = used; i < this.pool.length; i++) (this.pool[i] as THREE.Mesh).visible = false;
  }
}
