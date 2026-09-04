import * as THREE from 'three';
import type { Field } from '@core/world/Field';
import type { PoiKind } from '@data/schemas/field';
import { createTerrainView } from './TerrainView';

const POI_COLORS: Record<PoiKind, number> = {
  nest: 0x8b5a2b,
  water: 0x3a8fd9,
  feeding: 0x6bbf59,
  patrol: 0xb8b8b8,
};

/**
 * フィールドの仮描画: 地形 + 注目点マーカー + エリア境界リング。
 * 本番の植生・川・洞窟モデルが来るまで、プレイヤーが「どこに何があるか」を把握するための最低限。
 */
export function createFieldView(field: Field): THREE.Group {
  const group = new THREE.Group();
  group.name = `field-${field.def.id}`;
  group.add(createTerrainView(field.terrain));

  for (const poi of field.pois) {
    const radius = poi.def.kind === 'water' ? 6 : poi.def.kind === 'nest' ? 5 : poi.def.kind === 'feeding' ? 4 : 1.5;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshStandardMaterial({ color: POI_COLORS[poi.def.kind], roughness: 1, transparent: true, opacity: 0.75 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(poi.position.x, poi.position.y + 0.05, poi.position.z);
    disc.receiveShadow = true;
    group.add(disc);

    // 遠くからでも見える目印の柱
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 3, 6),
      new THREE.MeshStandardMaterial({ color: POI_COLORS[poi.def.kind], emissive: POI_COLORS[poi.def.kind], emissiveIntensity: 0.4 }),
    );
    post.position.set(poi.position.x, poi.position.y + 1.5, poi.position.z);
    group.add(post);
  }

  for (const area of field.def.areas) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(area.radius - 0.3, area.radius, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(area.center.x, field.terrain.getHeight(area.center.x, area.center.z) + 0.1, area.center.z);
    group.add(ring);
  }

  return group;
}
