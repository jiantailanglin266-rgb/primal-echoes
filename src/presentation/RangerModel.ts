import * as THREE from 'three';
import type { WeaponWeightClass } from './placeholders';

/**
 * レンジャー（プレイヤー）のプリミティブ製モデル。
 * 「調査隊の装備」という独自の見た目: フード付き外套、革の胸当てと肩当て、道具ベルト、脛当て。
 * 既存作品の防具デザインは参照せず、色と形の組み合わせだけで狩猟者らしさを出す。
 * 本番モデル（GLTF）が来たら、この class の外形（部品名と animate の入力）を保ったまま中身を差し替える。
 */
export const RANGER_PALETTE = {
  skin: 0xd9b08c,
  cloth: 0x3f4a3a,
  leather: 0x6b4a2e,
  leatherDark: 0x4a3220,
  iron: 0x8d9299,
  ironDark: 0x5b6067,
  accent: 0x5fc9c1,
  cape: 0x2f3a45,
  visor: 0x1b1f22,
} as const;

export interface RangerModel {
  group: THREE.Group;
  weaponPivot: THREE.Group;
  /** アニメーション用の可動部。 */
  parts: {
    torso: THREE.Group;
    head: THREE.Group;
    armL: THREE.Group;
    armR: THREE.Group;
    legL: THREE.Group;
    legR: THREE.Group;
    cape: THREE.Mesh;
  };
}

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  return m;
}

function cylinder(rTop: number, rBottom: number, h: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 10), material);
  m.castShadow = true;
  return m;
}

/** 身長 1.8m。原点は足元、+Z が正面。 */
export function createRangerModel(weight: WeaponWeightClass): RangerModel {
  const group = new THREE.Group();
  group.name = 'ranger';

  const cloth = mat(RANGER_PALETTE.cloth);
  const leather = mat(RANGER_PALETTE.leather);
  const leatherDark = mat(RANGER_PALETTE.leatherDark);
  const iron = mat(RANGER_PALETTE.iron, { metalness: 0.5, roughness: 0.45 });
  const ironDark = mat(RANGER_PALETTE.ironDark, { metalness: 0.5, roughness: 0.5 });
  const skin = mat(RANGER_PALETTE.skin);
  const accent = mat(RANGER_PALETTE.accent, { emissive: RANGER_PALETTE.accent, emissiveIntensity: 0.35 });

  // ---- 脚（股関節 0.95m を回転中心に） ----
  const makeLeg = (x: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.95, 0);
    const thigh = cylinder(0.11, 0.1, 0.45, cloth);
    thigh.position.y = -0.22;
    leg.add(thigh);
    const shin = cylinder(0.09, 0.085, 0.42, cloth);
    shin.position.y = -0.66;
    leg.add(shin);
    // 脛当て（前面の鉄板）
    const greave = box(0.16, 0.36, 0.06, ironDark);
    greave.position.set(0, -0.66, 0.08);
    leg.add(greave);
    const boot = box(0.18, 0.12, 0.3, leatherDark);
    boot.position.set(0, -0.89, 0.05);
    leg.add(boot);
    return leg;
  };
  const legL = makeLeg(0.14);
  const legR = makeLeg(-0.14);
  group.add(legL, legR);

  // ---- 胴（腰 0.95m から上） ----
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  group.add(torso);

  const waist = cylinder(0.2, 0.22, 0.2, leatherDark);
  waist.position.y = 0.08;
  torso.add(waist);
  const belt = cylinder(0.23, 0.23, 0.07, leather);
  belt.position.y = 0.16;
  torso.add(belt);
  // 道具ポーチ（左右腰）
  for (const sx of [-1, 1]) {
    const pouch = box(0.12, 0.13, 0.1, leatherDark);
    pouch.position.set(sx * 0.2, 0.05, 0.12);
    torso.add(pouch);
  }
  const chest = cylinder(0.21, 0.19, 0.42, cloth);
  chest.position.y = 0.42;
  torso.add(chest);
  // 胸当て（革に鉄の縁）
  const plate = box(0.36, 0.34, 0.1, leather);
  plate.position.set(0, 0.44, 0.17);
  torso.add(plate);
  const plateEdge = box(0.38, 0.05, 0.11, iron);
  plateEdge.position.set(0, 0.6, 0.17);
  torso.add(plateEdge);
  // 調査隊の紋章代わりのエーテル灯（胸の小さな発光）
  const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), accent);
  emblem.position.set(0.1, 0.5, 0.23);
  torso.add(emblem);
  // 肩当て
  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron);
    pauldron.position.set(sx * 0.27, 0.62, 0);
    pauldron.castShadow = true;
    torso.add(pauldron);
  }
  // マント（背中の薄い板。歩行で揺らす）
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7, 1, 4), mat(RANGER_PALETTE.cape, { side: THREE.DoubleSide }));
  cape.position.set(0, 0.35, -0.2);
  cape.castShadow = true;
  torso.add(cape);

  // ---- 頭（首 1.6m） ----
  const head = new THREE.Group();
  head.position.set(0, 0.66, 0);
  torso.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
  face.position.y = 0.14;
  face.castShadow = true;
  head.add(face);
  // フード（頭を覆う半球 + 後ろに垂れる部分）
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth);
  hood.position.y = 0.16;
  hood.castShadow = true;
  head.add(hood);
  const hoodBack = cylinder(0.17, 0.2, 0.16, cloth);
  hoodBack.position.set(0, 0.06, -0.06);
  head.add(hoodBack);
  // バイザー（目の位置の暗い帯）
  const visor = box(0.24, 0.05, 0.08, mat(RANGER_PALETTE.visor, { roughness: 0.3, metalness: 0.4 }));
  visor.position.set(0, 0.16, 0.13);
  head.add(visor);

  // ---- 腕（肩 1.55m を回転中心に） ----
  const makeArm = (x: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(x, 0.6, 0);
    const upper = cylinder(0.07, 0.065, 0.3, cloth);
    upper.position.y = -0.15;
    arm.add(upper);
    const fore = cylinder(0.065, 0.06, 0.28, cloth);
    fore.position.y = -0.43;
    arm.add(fore);
    const gauntlet = box(0.15, 0.2, 0.15, leather);
    gauntlet.position.y = -0.46;
    arm.add(gauntlet);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
    hand.position.y = -0.6;
    arm.add(hand);
    return arm;
  };
  const armL = makeArm(0.3);
  const armR = makeArm(-0.3);
  torso.add(armL, armR);

  // ---- 武器ピボット（右肩） ----
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(-0.3, 0.6, 0);
  torso.add(weaponPivot);
  weaponPivot.add(createWeaponModel(weight));

  return { group, weaponPivot, parts: { torso, head, armL, armR, legL, legR, cape } };
}

/**
 * 武器のプリミティブモデル。重量クラスで形を変える。
 * light: 細い発光刃、medium: 片手剣、heavy: 幅広の両手剣（Titan Blade）または槌（id で判別できないため見た目は共通）。
 */
export function createWeaponModel(weight: WeaponWeightClass, kind: 'blade' | 'hammer' = 'blade'): THREE.Group {
  const g = new THREE.Group();
  g.name = 'weapon-blade';
  const iron = mat(RANGER_PALETTE.iron, { metalness: 0.7, roughness: 0.35 });
  const dark = mat(RANGER_PALETTE.ironDark, { metalness: 0.6, roughness: 0.4 });
  const grip = mat(RANGER_PALETTE.leatherDark);

  if (kind === 'hammer') {
    const shaft = cylinder(0.035, 0.04, 1.5, grip);
    shaft.position.y = 0.75;
    g.add(shaft);
    const headBlock = box(0.42, 0.34, 0.34, dark);
    headBlock.position.y = 1.55;
    g.add(headBlock);
    const band = box(0.44, 0.08, 0.36, iron);
    band.position.y = 1.55;
    g.add(band);
    return g;
  }

  const dims = weight === 'heavy' ? { w: 0.22, l: 1.9, t: 0.05, guard: 0.5 } : weight === 'medium' ? { w: 0.12, l: 1.4, t: 0.04, guard: 0.32 } : { w: 0.07, l: 1.15, t: 0.03, guard: 0.22 };
  const gripLen = weight === 'heavy' ? 0.45 : 0.28;
  const handle = cylinder(0.03, 0.035, gripLen, grip);
  handle.position.y = gripLen / 2;
  g.add(handle);
  const guard = box(dims.guard, 0.05, 0.08, iron);
  guard.position.y = gripLen;
  g.add(guard);
  const bladeMat = weight === 'light' ? mat(0x9fd8ff, { metalness: 0.6, roughness: 0.3, emissive: 0x2a5a76, emissiveIntensity: 0.6 }) : iron;
  const blade = box(dims.w, dims.l, dims.t, bladeMat);
  blade.position.y = gripLen + dims.l / 2;
  g.add(blade);
  // 刃先を細くする（先端の小さな箱を重ねてテーパー風に）
  const tip = new THREE.Mesh(new THREE.ConeGeometry(dims.w / 2, dims.w * 1.4, 4), bladeMat);
  tip.position.y = gripLen + dims.l + dims.w * 0.7;
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  return g;
}
