import * as THREE from 'three';

/**
 * プレースホルダーのプリミティブ生成。
 * 本番モデルが揃うまでの仮表示で、ここに集約しておくことで
 * 差し替え時に presentation 層の他コードを触らずに済む。
 */

export const PLACEHOLDER_COLORS = {
  ground: 0x2f3a2a,
  gridMajor: 0x556b4a,
  gridMinor: 0x3d4c36,
  player: 0xd8b26a,
  playerWeapon: 0xb0b8c0,
  hitboxDebug: 0xff5a3c,
} as const;

export const PLAYER_PLACEHOLDER = {
  height: 1.8,
  radius: 0.35,
  /** 武器ピボット（右肩相当）の位置。 */
  weaponPivot: { x: 0.32, y: 1.35, z: 0 },
  /** 柄からの刃の長さ。ピボットを中心に回転させる。 */
  weaponLength: 2.0,
} as const;

export function createGroundPlaceholder(size = 200): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ground-placeholder';

  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.ground, roughness: 1 });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  group.add(plane);

  const grid = new THREE.GridHelper(size, size / 5, PLACEHOLDER_COLORS.gridMajor, PLACEHOLDER_COLORS.gridMinor);
  grid.position.y = 0.01;
  group.add(grid);

  return group;
}

export interface PlayerPlaceholder {
  group: THREE.Group;
  /** 武器の回転中心。ここを回すと武器が振られる。 */
  weaponPivot: THREE.Group;
}

/** プレイヤーの仮モデル: カプセル + 肩ピボットに付いた板（武器）。高さ約 1.8m。 */
export function createPlayerPlaceholder(): PlayerPlaceholder {
  const { height, radius, weaponPivot: pivotPos, weaponLength } = PLAYER_PLACEHOLDER;
  const group = new THREE.Group();
  group.name = 'player-placeholder';

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - radius * 2, 4, 12),
    new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.player, roughness: 0.8 }),
  );
  body.position.y = height / 2;
  body.castShadow = true;
  group.add(body);

  // 正面が分かるように鼻先の小さな突起を付ける（+Z を正面とする）
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2f1c }),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, height * 0.8, radius + 0.1);
  group.add(nose);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(pivotPos.x, pivotPos.y, pivotPos.z);
  group.add(weaponPivot);

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, weaponLength, 0.06),
    new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.playerWeapon, metalness: 0.6, roughness: 0.4 }),
  );
  blade.position.y = weaponLength / 2;
  blade.castShadow = true;
  weaponPivot.add(blade);

  return { group, weaponPivot };
}
