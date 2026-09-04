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
const TELEGRAPH_COLOR = new THREE.Color(0xff3b2f);
const STUN_COLOR = new THREE.Color(0xffd84d);
/** 怒り時のエーテル活性: 甲殻の隙間が青紫に発光する想定の仮表現。 */
const ENRAGE_COLOR = new THREE.Color(0x7a5cff);
const EXHAUSTED_TINT = 0x5a5550;
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
 * 攻撃のテレグラフは「全身が赤く脈打つ」仮表現。本番はモーションで見せる。
 */
export class MonsterView {
  readonly object = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly visuals: PartVisual[] = [];
  private readonly interpolated = new Vec3();
  private elapsed = 0;
  /** 生態 AI から渡される「眠っている / 食べている」等の仮ポーズ指示。 */
  ecologyPose: 'none' | 'sleep' | 'eat' | 'drink' = 'none';

  constructor(private readonly monster: Monster) {
    this.object.name = `monster-${monster.id}`;
    this.object.add(this.bodyGroup);
    for (const part of monster.parts) {
      const material = new THREE.MeshStandardMaterial({
        color: PART_COLORS[part.id] ?? DEFAULT_PART_COLOR,
        roughness: 0.95,
        metalness: 0.05,
      });
      const mesh = createShapeMesh(part.def.shape, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.bodyGroup.add(mesh);
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
    this.elapsed += frameDt;
    this.interpolated.copy(m.previousPosition).lerp(m.position, alpha);
    this.object.position.set(this.interpolated.x, this.interpolated.y, this.interpolated.z);
    this.object.rotation.y = m.yaw;

    const combat = m.combat;
    const phase = combat.phase;
    const telegraphPulse = phase === 'telegraph' ? 0.5 + 0.5 * Math.sin(this.elapsed * 28) : 0;
    const stunGlow = combat.state === 'stunned' ? 0.5 + 0.5 * Math.sin(this.elapsed * 6) : 0;
    const enraged = m.condition.isEnraged;
    const exhausted = m.condition.isExhausted;
    const enrageGlow = enraged ? 0.25 + 0.15 * Math.sin(this.elapsed * 4) : 0;

    for (const visual of this.visuals) {
      const { part, mesh, material } = visual;
      mesh.visible = !part.isSevered;
      let base = part.isBroken ? BROKEN_COLOR : (PART_COLORS[part.id] ?? DEFAULT_PART_COLOR);
      if (exhausted && !part.isBroken) base = EXHAUSTED_TINT;
      material.color.setHex(base);
      material.emissive.setScalar(0);
      if (visual.flashRemaining > 0) {
        visual.flashRemaining -= frameDt;
        const k = Math.max(0, visual.flashRemaining / FLASH_DURATION_SECONDS);
        material.emissive.copy(FLASH_COLOR).multiplyScalar(k * 0.8);
      } else if (telegraphPulse > 0) {
        material.emissive.copy(TELEGRAPH_COLOR).multiplyScalar(0.15 + 0.35 * telegraphPulse);
      } else if (stunGlow > 0) {
        material.emissive.copy(STUN_COLOR).multiplyScalar(0.1 + 0.2 * stunGlow);
      } else if (enrageGlow > 0) {
        // 弱点化した部位はより強く光らせ、「ここを狙え」を見た目で伝える
        const weak = m.def.enrage.weakPartIds.includes(part.id) ? 2.2 : 1;
        material.emissive.copy(ENRAGE_COLOR).multiplyScalar(enrageGlow * weak);
      }
    }

    this.applyBodyPose(frameDt);
  }

  /** 攻撃フェーズに応じた全身の仮ポーズ（しゃがみ・跳躍・怯み・死亡）。 */
  private applyBodyPose(frameDt: number): void {
    const m = this.monster;
    const combat = m.combat;
    const body = this.bodyGroup;
    let targetY = 0;
    let targetScaleY = 1;
    let targetTilt = 0;

    if (!m.isAlive) {
      targetTilt = Math.PI / 2;
    } else if (combat.state === 'flinch') {
      targetY = 0.15;
      targetTilt = -0.12;
    } else if (combat.state === 'roar') {
      // 咆哮: 上体を起こす
      targetScaleY = 1.15;
      targetY = 0.3;
    } else if (combat.state === 'stunned') {
      targetScaleY = 0.75;
    } else if (combat.state === 'toppled') {
      // 転倒: 横倒しに近い傾き
      targetTilt = 0.55;
      targetScaleY = 0.85;
    } else if (!combat.current && this.ecologyPose === 'sleep') {
      // 睡眠: 伏せる + ゆっくり呼吸
      targetScaleY = 0.7 + 0.03 * Math.sin(this.elapsed * 1.5);
    } else if (!combat.current && (this.ecologyPose === 'eat' || this.ecologyPose === 'drink')) {
      // 食事/飲水: 頭を下げる代わりに前傾
      targetTilt = 0;
      targetScaleY = 0.88 + 0.04 * Math.sin(this.elapsed * 5);
    } else if (m.condition.isExhausted && !combat.current) {
      targetScaleY = 0.92;
    } else if (combat.current) {
      const kind = combat.current.def.motion.kind;
      const phase = combat.phase;
      if (phase === 'startup') {
        targetScaleY = kind === 'lunge' ? 0.7 : 0.9;
      } else if (phase === 'active' && kind === 'lunge') {
        targetY = 3.5 * Math.sin(Math.min(1, combat.phaseProgress) * Math.PI);
      } else if (phase === 'telegraph') {
        targetScaleY = 1.05;
      }
    }

    const k = Math.min(1, frameDt * 14);
    body.position.y += (targetY - body.position.y) * k;
    body.scale.y += (targetScaleY - body.scale.y) * k;
    body.rotation.z += (targetTilt - body.rotation.z) * Math.min(1, frameDt * 3);
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
