import * as THREE from 'three';
import type { MonsterPartDefinition } from '@data/schemas/monster';

/**
 * Valgaron の装飾: 岩の甲殻、二本の角、発達した顎と牙、前脚の爪、尾の棘、エーテルで光る目。
 * 当たり判定（部位形状）には一切影響しない。部位ごとに作り、pivot の子として追従させる。
 * 完全オリジナルの意匠。既存作品の生物デザインは参照しない。
 */
export interface DecorationState {
  broken: boolean;
  /** 怒り時に甲殻の亀裂へ流す光の強さ。 */
  enrageGlow: number;
  eyeState: 'normal' | 'enraged' | 'asleep' | 'dead';
  /** 被弾フラッシュやテレグラフを装飾にも乗せる。 */
  armorGlow: THREE.Color | null;
}

export interface PartDecoration {
  setState(state: DecorationState): void;
  /** 顎の開き 0〜1（頭部のみ）。 */
  setJaw(open: number, k: number): void;
}

const ROCK = 0x5a5148;
const ROCK_LIGHT = 0x7a6f63;
const HORN = 0xd9cdb4;
const CLAW = 0x2f2a26;
const CRACK = 0x7a5cff;

const rockMat = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0.02, flatShading: true });

function rock(size: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), material);
  m.castShadow = true;
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  return m;
}

function spike(radius: number, length: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 6), material);
  m.castShadow = true;
  return m;
}

export function decorateValgaronPart(def: MonsterPartDefinition, pivot: THREE.Group, pivotPoint: THREE.Vector3): PartDecoration | null {
  const group = new THREE.Group();
  group.name = `decor-${def.id}`;
  pivot.add(group);
  const local = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x - pivotPoint.x, y - pivotPoint.y, z - pivotPoint.z);

  const plateMat = rockMat(ROCK);
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x241c3a, emissive: CRACK, emissiveIntensity: 0, roughness: 0.6 });
  const armorMats: THREE.MeshStandardMaterial[] = [plateMat];
  let jaw: THREE.Group | null = null;
  const eyes: THREE.MeshStandardMaterial[] = [];
  const breakableBits: THREE.Object3D[] = [];

  switch (def.id) {
    case 'head': {
      if (def.shape.type !== 'sphere') break;
      const o = def.shape.offset;
      const r = def.shape.radius;
      // 二本の角（前上方へ）。破壊で折れる
      const hornMat = rockMat(HORN);
      for (const sx of [-1, 1]) {
        const horn = spike(0.22, 1.3, hornMat);
        horn.position.copy(local(o.x + sx * 0.55, o.y + r * 0.7, o.z + 0.2));
        horn.rotation.set(-0.9, 0, sx * -0.35);
        group.add(horn);
        breakableBits.push(horn);
      }
      // 頭頂の岩甲殻
      const crown = rock(0.55, plateMat);
      crown.position.copy(local(o.x, o.y + r * 0.85, o.z - 0.2));
      crown.scale.set(1.6, 0.6, 1.2);
      group.add(crown);
      // 目（左右、エーテルの光）
      for (const sx of [-1, 1]) {
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffa640, emissiveIntensity: 1.2 });
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eyeMat);
        eye.position.copy(local(o.x + sx * 0.6, o.y + 0.25, o.z + r * 0.85));
        group.add(eye);
        eyes.push(eyeMat);
      }
      // 上顎の牙
      const fangMat = rockMat(HORN);
      for (const sx of [-0.6, -0.2, 0.2, 0.6]) {
        const fang = spike(0.07, 0.35, fangMat);
        fang.position.copy(local(o.x + sx, o.y - r * 0.55, o.z + r * 0.75));
        fang.rotation.x = Math.PI;
        group.add(fang);
      }
      // 下顎（開閉する）
      jaw = new THREE.Group();
      jaw.position.copy(local(o.x, o.y - r * 0.45, o.z - r * 0.2));
      const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, r * 1.8), rockMat(ROCK_LIGHT));
      jawMesh.position.set(0, -0.2, r * 0.7);
      jawMesh.castShadow = true;
      jaw.add(jawMesh);
      for (const sx of [-0.5, 0, 0.5]) {
        const tooth = spike(0.07, 0.3, fangMat);
        tooth.position.set(sx, 0.05, r * 1.4);
        jaw.add(tooth);
      }
      group.add(jaw);
      break;
    }
    case 'body': {
      if (def.shape.type !== 'capsule') break;
      const s = def.shape.start;
      const e = def.shape.end;
      const r = def.shape.radius;
      // 背中の岩甲殻を背骨に沿って並べ、隙間に亀裂（怒りで光る）を挟む
      const count = 6;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const z = s.z + (e.z - s.z) * t;
        const plate = rock(0.75, plateMat);
        plate.position.copy(local(0, s.y + r * 0.75, z));
        plate.scale.set(1.9, 0.55, 1.1);
        group.add(plate);
        if (i < count - 1) {
          const crack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.25), crackMat);
          crack.position.copy(local(0, s.y + r * 0.72, z + (e.z - s.z) / (count - 1) / 2));
          group.add(crack);
        }
      }
      // 側面の隆起
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const side = rock(0.5, rockMat(ROCK_LIGHT));
          side.position.copy(local(sx * r * 0.85, s.y + r * 0.25, s.z + 0.6 + i * 1.0));
          side.scale.set(0.8, 0.6, 1.0);
          group.add(side);
        }
      }
      // 胸元のエーテル核が透ける部分
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), crackMat);
      core.position.copy(local(0, s.y - r * 0.55, e.z - 0.2));
      group.add(core);
      break;
    }
    case 'foreleg_l':
    case 'foreleg_r': {
      if (def.shape.type !== 'capsule') break;
      const s = def.shape.start; // 下端（足）
      const r = def.shape.radius;
      const clawMat = rockMat(CLAW);
      for (const dx of [-0.25, 0, 0.25]) {
        const claw = spike(0.09, 0.45, clawMat);
        claw.position.copy(local(s.x + dx, s.y - 0.2, s.z + r * 0.9));
        claw.rotation.x = Math.PI / 2 + 0.3;
        group.add(claw);
        breakableBits.push(claw);
      }
      // 肩の甲殻
      const shoulder = rock(0.5, plateMat);
      shoulder.position.copy(local(def.shape.end.x * 1.1, def.shape.end.y + 0.25, def.shape.end.z));
      shoulder.scale.set(1.2, 0.7, 1.2);
      group.add(shoulder);
      break;
    }
    case 'hindleg_l':
    case 'hindleg_r': {
      if (def.shape.type !== 'capsule') break;
      const s = def.shape.start;
      const clawMat = rockMat(CLAW);
      for (const dx of [-0.2, 0.2]) {
        const claw = spike(0.08, 0.35, clawMat);
        claw.position.copy(local(s.x + dx, s.y - 0.2, s.z + def.shape.radius * 0.8));
        claw.rotation.x = Math.PI / 2 + 0.3;
        group.add(claw);
      }
      const hock = rock(0.4, plateMat);
      hock.position.copy(local(def.shape.end.x * 1.15, def.shape.end.y + 0.1, def.shape.end.z));
      hock.scale.set(1, 0.6, 1);
      group.add(hock);
      break;
    }
    case 'tail': {
      if (def.shape.type !== 'capsule') break;
      const s = def.shape.start;
      const e = def.shape.end;
      const spikeMat = rockMat(HORN);
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        const sp = spike(0.12, 0.55 - t * 0.2, spikeMat);
        sp.position.copy(local(s.x + (e.x - s.x) * t, s.y + (e.y - s.y) * t + def.shape.radius * 0.8, s.z + (e.z - s.z) * t));
        sp.rotation.x = -0.4;
        group.add(sp);
      }
      // 尾先の岩塊
      const club = rock(0.6, plateMat);
      club.position.copy(local(e.x, e.y, e.z - 0.3));
      group.add(club);
      break;
    }
    default:
      break;
  }

  return {
    setState(state) {
      crackMat.emissiveIntensity = state.enrageGlow;
      for (const m of armorMats) {
        if (state.armorGlow) m.emissive.copy(state.armorGlow);
        else m.emissive.setScalar(0);
      }
      for (const bit of breakableBits) bit.visible = !state.broken;
      for (const eye of eyes) {
        switch (state.eyeState) {
          case 'enraged':
            eye.emissive.setHex(0xff2a2a);
            eye.emissiveIntensity = 2.2;
            break;
          case 'asleep':
            eye.emissive.setHex(0x442200);
            eye.emissiveIntensity = 0.2;
            break;
          case 'dead':
            eye.emissive.setHex(0x000000);
            eye.emissiveIntensity = 0;
            break;
          default:
            eye.emissive.setHex(0xffa640);
            eye.emissiveIntensity = 1.2;
        }
      }
    },
    setJaw(open, k) {
      if (!jaw) return;
      jaw.rotation.x += (open * 0.7 - jaw.rotation.x) * k;
    },
  };
}
