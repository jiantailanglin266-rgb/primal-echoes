import * as THREE from 'three';
import type { GimmickManager, GimmickState } from '@core/world/GimmickManager';

const ROCK_COLOR = 0x6b625a;
const FALL_HEIGHT = 14;

interface FallingRock {
  mesh: THREE.Mesh;
  gimmick: GimmickState;
  elapsed: number;
  offset: THREE.Vector3;
}

/**
 * 落石ギミックの仮表現: 岩棚（高い柱の上の岩塊）と、作動時に落ちる岩。
 * 落下は delaySeconds に合わせ、着地で core 側の判定が走る。
 */
export class GimmickView {
  readonly object = new THREE.Group();
  private readonly ledges = new Map<string, THREE.Group>();
  private readonly falling: FallingRock[] = [];
  private readonly rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  private readonly rockMaterial = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, roughness: 1 });

  constructor(private readonly gimmicks: GimmickManager) {
    for (const g of gimmicks.gimmicks) {
      const ledge = new THREE.Group();
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, FALL_HEIGHT, 8), new THREE.MeshStandardMaterial({ color: 0x4f4842, roughness: 1 }));
      pillar.position.y = FALL_HEIGHT / 2;
      pillar.castShadow = true;
      ledge.add(pillar);
      for (let i = 0; i < 4; i++) {
        const rock = new THREE.Mesh(this.rockGeometry, this.rockMaterial);
        rock.scale.setScalar(0.9 + Math.random() * 0.5);
        rock.position.set((Math.random() - 0.5) * 2.4, FALL_HEIGHT + 0.8, (Math.random() - 0.5) * 2.4);
        rock.name = 'ledge-rock';
        ledge.add(rock);
      }
      // 操作位置の目印（地面のリング）
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(g.def.triggerRadius - 0.25, g.def.triggerRadius, 32),
        new THREE.MeshBasicMaterial({ color: 0xd8b26a, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      ring.name = 'trigger-ring';
      ledge.add(ring);
      ledge.position.set(g.position.x, g.position.y, g.position.z);
      this.object.add(ledge);
      this.ledges.set(g.def.id, ledge);
    }
  }

  /** 作動通知。岩棚の岩を落下オブジェクトへ移す。 */
  trigger(gimmick: GimmickState): void {
    const ledge = this.ledges.get(gimmick.def.id);
    if (!ledge) return;
    const rocks = ledge.children.filter((c) => c.name === 'ledge-rock');
    for (const rock of rocks) {
      ledge.remove(rock);
      const mesh = rock as THREE.Mesh;
      const offset = new THREE.Vector3(mesh.position.x * 2, 0, mesh.position.z * 2);
      mesh.position.set(gimmick.position.x + offset.x, gimmick.position.y + FALL_HEIGHT + 0.8, gimmick.position.z + offset.z);
      this.object.add(mesh);
      this.falling.push({ mesh, gimmick, elapsed: 0, offset });
    }
    const ring = ledge.getObjectByName('trigger-ring');
    if (ring) ring.visible = gimmick.usesLeft > 0;
  }

  update(frameDt: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i] as FallingRock;
      f.elapsed += frameDt;
      const t = Math.min(1, f.elapsed / f.gimmick.def.delaySeconds);
      // 自由落下風（t^2）
      const y = f.gimmick.position.y + FALL_HEIGHT * (1 - t * t) + 0.6;
      f.mesh.position.y = y;
      f.mesh.rotation.x += frameDt * 4;
      if (t >= 1) {
        // 着地後は散らばって残る
        f.mesh.position.y = f.gimmick.position.y + 0.5;
        this.falling.splice(i, 1);
      }
    }
  }
}
