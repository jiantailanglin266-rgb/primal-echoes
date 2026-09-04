import * as THREE from 'three';
import type { Monster } from '@core/monster/Monster';
import type { MonsterPart } from '@core/monster/MonsterPart';
import type { ShapeData } from '@core/combat/shapes';
import { Vec3 } from '@shared/math/Vec3';

const PART_COLORS: Record<string, number> = {
  head: 0x8a6d4b,
  body: 0x6b6258,
  tail: 0x7a6a55,
};
const DEFAULT_PART_COLOR = 0x74675a;
const BROKEN_COLOR = 0x3f3833;
const FLASH_COLOR = new THREE.Color(0xffe6b0);
const FLASH_DURATION_SECONDS = 0.12;

interface PartVisual {
  part: MonsterPart;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  flashRemaining: number;
}

/**
 * モンスターの部位形状をそのままプリミティブで描く。
 * あたり判定 = 見た目 にしておくことで、データ調整の結果を目で確認できる。
 * 本番モデルが来たら部位ごとのメッシュに差し替える。
 */
export class MonsterView {
  readonly object = new THREE.Group();
  private readonly visuals: PartVisual[] = [];
  private readonly interpolated = new Vec3();

  constructor(private readonly monster: Monster) {
    this.object.name = `monster-${monster.id}`;
    for (const part of monster.parts) {
      const material = new THREE.MeshStandardMaterial({
        color: PART_COLORS[part.id] ?? DEFAULT_PART_COLOR,
        roughness: 0.95,
        metalness: 0.05,
      });
      const mesh = createShapeMesh(part.def.shape, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.object.add(mesh);
      this.visuals.push({ part, mesh, material, flashRemaining: 0 });
    }
  }

  get renderPosition(): Vec3 {
    return this.interpolated;
  }

  flashPart(partId: string): void {
    const visual = this.visuals.find((v) => v.part.id === partId);
    if (visual) visual.flashRemaining = FLASH_DURATION_SECONDS;
  }

  sync(alpha: number, frameDt: number): void {
    const m = this.monster;
    this.interpolated.copy(m.previousPosition).lerp(m.position, alpha);
    this.object.position.set(this.interpolated.x, this.interpolated.y, this.interpolated.z);
    this.object.rotation.y = m.yaw;

    for (const visual of this.visuals) {
      const { part, mesh, material } = visual;
      mesh.visible = !part.isSevered;
      const base = part.isBroken ? BROKEN_COLOR : (PART_COLORS[part.id] ?? DEFAULT_PART_COLOR);
      material.color.setHex(base);
      if (visual.flashRemaining > 0) {
        visual.flashRemaining -= frameDt;
        const k = Math.max(0, visual.flashRemaining / FLASH_DURATION_SECONDS);
        material.emissive.copy(FLASH_COLOR).multiplyScalar(k * 0.8);
      } else {
        material.emissive.setScalar(0);
      }
    }

    if (!m.isAlive) {
      // 死亡の仮表現: 横倒し
      this.object.rotation.z += (Math.PI / 2 - this.object.rotation.z) * Math.min(1, frameDt * 3);
    } else {
      this.object.rotation.z = 0;
    }
  }
}

function createShapeMesh(shape: ShapeData, material: THREE.Material): THREE.Mesh {
  if (shape.type === 'sphere') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(shape.radius, 20, 14), material);
    mesh.position.set(shape.offset.x, shape.offset.y, shape.offset.z);
    return mesh;
  }
  const start = new THREE.Vector3(shape.start.x, shape.start.y, shape.start.z);
  const end = new THREE.Vector3(shape.end.x, shape.end.y, shape.end.z);
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(shape.radius, length, 6, 14), material);
  // CapsuleGeometry は Y 軸方向。start->end へ向ける。
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  const axis = new THREE.Vector3().subVectors(end, start).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  return mesh;
}
