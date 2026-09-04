import * as THREE from 'three';
import type { EcosystemManager } from '@core/ecosystem/EcosystemManager';
import type { Creature } from '@core/ecosystem/Creature';
import type { Carcass } from '@core/ecosystem/Carcass';

const CREATURE_COLORS: Record<string, number> = {
  grast: 0x9fb57a,
  skarv: 0x5f4d6b,
};
const DEFAULT_COLOR = 0x8a8a8a;
const FLEE_EMISSIVE = new THREE.Color(0xffd08a);
const CARCASS_COLOR = 0x4a3a33;

interface CreatureVisual {
  creature: Creature;
  group: THREE.Group;
  body: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
}

/**
 * 小型生物と死骸のプレースホルダー描画。
 * 草食: 横長カプセル + 頭。腐肉食: 低い箱。死骸: 潰れた暗色の塊。
 */
export class EcosystemView {
  readonly object = new THREE.Group();
  private readonly visuals = new Map<string, CreatureVisual>();
  private readonly carcassMeshes = new Map<number, THREE.Mesh>();
  private readonly carcassGeometry = new THREE.SphereGeometry(1, 10, 6);
  private readonly carcassMaterial = new THREE.MeshStandardMaterial({ color: CARCASS_COLOR, roughness: 1 });

  constructor(private readonly ecosystem: EcosystemManager) {
    this.object.name = 'ecosystem';
    for (const creature of ecosystem.creatures) this.visuals.set(creature.id, this.createVisual(creature));
  }

  private createVisual(creature: Creature): CreatureVisual {
    const def = creature.def;
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: CREATURE_COLORS[def.id] ?? DEFAULT_COLOR, roughness: 0.9 });
    let body: THREE.Mesh;
    if (def.kind === 'herbivore') {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(def.bodyRadius * 0.7, def.bodyRadius * 1.6, 4, 10), material);
      body.rotation.x = Math.PI / 2; // 進行方向に寝かせる
      body.position.y = def.height * 0.55;
      const head = new THREE.Mesh(new THREE.SphereGeometry(def.bodyRadius * 0.45, 10, 8), material);
      head.position.set(0, def.height * 0.8, def.bodyRadius * 1.3);
      group.add(head);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, def.height * 0.5, 6), material);
          leg.position.set(sx * def.bodyRadius * 0.5, def.height * 0.25, sz * def.bodyRadius * 0.7);
          group.add(leg);
        }
      }
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(def.bodyRadius * 1.4, def.height * 0.6, def.bodyRadius * 2.2), material);
      body.position.y = def.height * 0.4;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, def.bodyRadius * 1.6, 6), material);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, def.height * 0.4, -def.bodyRadius * 1.8);
      group.add(tail);
    }
    body.castShadow = true;
    group.add(body);
    this.object.add(group);
    return { creature, group, body, material };
  }

  sync(alpha: number, frameDt: number): void {
    for (const creature of this.ecosystem.creatures) {
      let visual = this.visuals.get(creature.id);
      if (!visual) {
        visual = this.createVisual(creature);
        this.visuals.set(creature.id, visual);
      }
      const { group, material } = visual;
      group.visible = creature.isAlive;
      if (!creature.isAlive) continue;
      const p = creature.previousPosition;
      const q = creature.position;
      group.position.set(p.x + (q.x - p.x) * alpha, p.y + (q.y - p.y) * alpha, p.z + (q.z - p.z) * alpha);
      group.rotation.y = creature.yaw;
      // 逃走中は少し明るく、食事中は上下に揺れる仮表現
      if (creature.state === 'flee') {
        material.emissive.copy(FLEE_EMISSIVE).multiplyScalar(0.25);
        group.position.y += Math.abs(Math.sin(creature.stateElapsed * 18)) * 0.25;
      } else {
        material.emissive.setScalar(0);
        if (creature.state === 'feed' || creature.state === 'graze') {
          group.rotation.x = 0.15 * Math.sin(creature.stateElapsed * 3);
        } else {
          group.rotation.x += (0 - group.rotation.x) * Math.min(1, frameDt * 8);
        }
      }
    }

    const seen = new Set<number>();
    for (const carcass of this.ecosystem.carcasses) {
      seen.add(carcass.id);
      let mesh = this.carcassMeshes.get(carcass.id);
      if (!mesh) {
        mesh = this.createCarcassMesh(carcass);
        this.carcassMeshes.set(carcass.id, mesh);
      }
      // 食べられるほど小さくなる
      const shrink = carcass.persistent ? 1 : 0.4 + 0.6 * Math.min(1, carcass.meatSeconds / Math.max(1, carcass.meatSeconds + carcass.age));
      mesh.scale.y = 0.45 * shrink;
    }
    for (const [id, mesh] of this.carcassMeshes) {
      if (!seen.has(id)) {
        this.object.remove(mesh);
        this.carcassMeshes.delete(id);
      }
    }
  }

  private createCarcassMesh(carcass: Carcass): THREE.Mesh {
    const mesh = new THREE.Mesh(this.carcassGeometry, this.carcassMaterial);
    const size = carcass.sourceId === 'valgaron' ? 3.2 : 0.9;
    mesh.scale.set(size, size * 0.45, size * 1.4);
    mesh.position.set(carcass.position.x, carcass.position.y + size * 0.2, carcass.position.z);
    mesh.receiveShadow = true;
    this.object.add(mesh);
    return mesh;
  }
}
