import * as THREE from 'three';
import type { Monster } from '@core/monster/Monster';
import type { MonsterPart } from '@core/monster/MonsterPart';
import type { ShapeData } from '@core/combat/shapes';
import { Vec3 } from '@shared/math/Vec3';
import { decorateValgaronPart, type PartDecoration } from './ValgaronDecor';

const PART_COLORS: Record<string, number> = {
  head: 0x7d6a52,
  body: 0x6b6258,
  tail: 0x74675a,
};
const DEFAULT_PART_COLOR = 0x6f655a;
const BROKEN_COLOR = 0x3f3833;
const FLASH_COLOR = new THREE.Color(0xffe6b0);
const TELEGRAPH_COLOR = new THREE.Color(0xff3b2f);
const STUN_COLOR = new THREE.Color(0xffd84d);
/** 怒り時のエーテル活性: 甲殻の隙間が青紫に発光する。 */
const ENRAGE_COLOR = new THREE.Color(0x7a5cff);
const EXHAUSTED_TINT = 0x5a5550;
const FLASH_DURATION_SECONDS = 0.12;

interface PartVisual {
  part: MonsterPart;
  /** 可動の回転中心（脚は股関節、尾は付け根、頭は首）。 */
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  decoration: PartDecoration | null;
  flashRemaining: number;
}

/**
 * モンスターの部位形状（= 当たり判定）を土台に、装飾（角・牙・甲殻・爪・棘）を重ねて描く。
 * 当たり判定は data の shape が正で、装飾はそれに追従するだけ。
 * 四肢・尾・顎は状態と移動速度から手続き的に動かす。
 */
export class MonsterView {
  readonly object = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly visuals: PartVisual[] = [];
  private readonly interpolated = new Vec3();
  private readonly lastRenderPosition = new Vec3();
  private elapsed = 0;
  private walkPhase = 0;
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
      const pivotPoint = pivotFor(part.def.shape);
      const pivot = new THREE.Group();
      pivot.position.copy(pivotPoint);
      const mesh = createShapeMesh(part.def.shape, material);
      mesh.position.sub(pivotPoint);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      const decoration = monster.def.id === 'valgaron' ? decorateValgaronPart(part.def, pivot, pivotPoint) : null;
      this.bodyGroup.add(pivot);
      this.visuals.push({ part, pivot, mesh, material, decoration, flashRemaining: 0 });
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
    const moved = this.interpolated.horizontalDistanceTo(this.lastRenderPosition);
    this.lastRenderPosition.copy(this.interpolated);
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
      const { part, pivot, material, decoration } = visual;
      pivot.visible = !part.isSevered;
      let base = part.isBroken ? BROKEN_COLOR : (PART_COLORS[part.id] ?? DEFAULT_PART_COLOR);
      if (exhausted && !part.isBroken) base = EXHAUSTED_TINT;
      material.color.setHex(base);
      material.emissive.setScalar(0);
      let glow: THREE.Color | null = null;
      let glowScale = 0;
      if (visual.flashRemaining > 0) {
        visual.flashRemaining -= frameDt;
        const k = Math.max(0, visual.flashRemaining / FLASH_DURATION_SECONDS);
        glow = FLASH_COLOR;
        glowScale = k * 0.8;
      } else if (telegraphPulse > 0) {
        glow = TELEGRAPH_COLOR;
        glowScale = 0.15 + 0.35 * telegraphPulse;
      } else if (stunGlow > 0) {
        glow = STUN_COLOR;
        glowScale = 0.1 + 0.2 * stunGlow;
      } else if (enrageGlow > 0) {
        // 弱点化した部位はより強く光らせ、「ここを狙え」を見た目で伝える
        const weak = m.def.enrage.weakPartIds.includes(part.id) ? 2.2 : 1;
        glow = ENRAGE_COLOR;
        glowScale = enrageGlow * weak;
      }
      if (glow) material.emissive.copy(glow).multiplyScalar(glowScale);
      decoration?.setState({
        broken: part.isBroken,
        enrageGlow: enraged ? enrageGlow * 2.5 : 0,
        eyeState: !m.isAlive ? 'dead' : this.ecologyPose === 'sleep' ? 'asleep' : enraged ? 'enraged' : 'normal',
        armorGlow: glow ? glow.clone().multiplyScalar(glowScale * 0.6) : null,
      });
    }

    const speed = frameDt > 0 ? moved / frameDt : 0;
    this.animateLimbs(speed, frameDt);
    this.applyBodyPose(frameDt);
  }

  /** 脚の歩行サイクル、尾の揺れ、頭の上下、顎の開閉。 */
  private animateLimbs(speed: number, frameDt: number): void {
    const m = this.monster;
    const moving = m.isAlive && speed > 0.2;
    const stride = Math.min(1, speed / m.def.stats.runSpeed);
    if (moving) this.walkPhase += frameDt * (3.5 + stride * 6);
    const k = Math.min(1, frameDt * 10);
    const combat = m.combat;
    const attackId = combat.current?.def.id ?? '';
    const phase = combat.phase;

    for (const v of this.visuals) {
      const id = v.part.id;
      const isLeg = id.includes('leg');
      if (isLeg) {
        // 対角の脚を同位相に（四足歩行の速歩）
        const offset = id === 'foreleg_l' || id === 'hindleg_r' ? 0 : Math.PI;
        const target = moving ? Math.sin(this.walkPhase + offset) * 0.45 * (0.4 + stride) : 0;
        v.pivot.rotation.x += (target - v.pivot.rotation.x) * k;
      } else if (id === 'tail') {
        let sway = Math.sin(this.elapsed * 1.8) * 0.18 + (moving ? Math.sin(this.walkPhase) * 0.12 : 0);
        if (attackId === 'vg_tail_sweep') {
          // 尾なぎ払い: startup で溜め、active で大きく振る
          if (phase === 'telegraph' || phase === 'startup') sway = -0.9;
          else if (phase === 'active') sway = 1.4;
        }
        v.pivot.rotation.y += (sway - v.pivot.rotation.y) * k;
      } else if (id === 'head') {
        let nod = moving ? Math.sin(this.walkPhase * 2) * 0.05 : Math.sin(this.elapsed * 1.2) * 0.03;
        if (this.ecologyPose === 'eat' || this.ecologyPose === 'drink') nod = 0.45 + Math.sin(this.elapsed * 4) * 0.08;
        if (this.ecologyPose === 'sleep') nod = 0.35;
        if (attackId === 'vg_bite' && (phase === 'telegraph' || phase === 'startup')) nod = -0.35;
        if (attackId === 'vg_bite' && phase === 'active') nod = 0.4;
        v.pivot.rotation.x += (nod - v.pivot.rotation.x) * k;
        const jawOpen = (attackId === 'vg_bite' && phase !== 'recovery') || combat.state === 'roar' ? 0.55 : this.ecologyPose === 'eat' ? 0.3 + Math.sin(this.elapsed * 6) * 0.2 : 0.05;
        v.decoration?.setJaw(jawOpen, k);
      }
    }
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
      targetScaleY = 1.12;
      targetY = 0.3;
    } else if (combat.state === 'stunned') {
      targetScaleY = 0.78;
    } else if (combat.state === 'toppled') {
      targetTilt = 0.55;
      targetScaleY = 0.85;
    } else if (!combat.current && this.ecologyPose === 'sleep') {
      targetScaleY = 0.72 + 0.03 * Math.sin(this.elapsed * 1.5);
    } else if (!combat.current && (this.ecologyPose === 'eat' || this.ecologyPose === 'drink')) {
      targetScaleY = 0.9 + 0.03 * Math.sin(this.elapsed * 5);
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
    } else {
      targetScaleY = 1 + Math.sin(this.elapsed * 1.3) * 0.012;
    }

    const k = Math.min(1, frameDt * 14);
    body.position.y += (targetY - body.position.y) * k;
    body.scale.y += (targetScaleY - body.scale.y) * k;
    body.rotation.z += (targetTilt - body.rotation.z) * Math.min(1, frameDt * 3);
  }
}

/** 回転中心: カプセルは上端（股関節/付け根）、球は胴体側へ半径ぶん寄せた点。 */
function pivotFor(shape: ShapeData): THREE.Vector3 {
  if (shape.type === 'sphere') {
    const o = shape.offset;
    return new THREE.Vector3(o.x, o.y, o.z - Math.sign(o.z || 1) * shape.radius);
  }
  const s = shape.start;
  const e = shape.end;
  const upper = e.y >= s.y ? e : s;
  return new THREE.Vector3(upper.x, upper.y, upper.z);
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
