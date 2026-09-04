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

/** プレイヤーの仮モデル: カプセル + 背中の板（武器）。高さ約 1.8m。 */
export function createPlayerPlaceholder(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'player-placeholder';

  const bodyHeight = 1.8;
  const radius = 0.35;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, bodyHeight - radius * 2, 4, 12),
    new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.player, roughness: 0.8 }),
  );
  body.position.y = bodyHeight / 2;
  body.castShadow = true;
  group.add(body);

  // 正面が分かるように鼻先の小さな突起を付ける（+Z を正面とする）
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2f1c }),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, bodyHeight * 0.8, radius + 0.1);
  group.add(nose);

  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 2.0, 0.05),
    new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLORS.playerWeapon, metalness: 0.6, roughness: 0.4 }),
  );
  weapon.position.set(0.1, bodyHeight * 0.55, -radius - 0.05);
  weapon.rotation.z = 0.25;
  weapon.castShadow = true;
  group.add(weapon);

  return group;
}
