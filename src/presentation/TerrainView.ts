import * as THREE from 'three';
import type { ProceduralTerrain } from '@core/world/Terrain';
import { PLACEHOLDER_COLORS } from './placeholders';

/**
 * HeightProvider をサンプリングして地形メッシュを作る。
 * core 側の高さ関数と描画が必ず一致するよう、独自に高さを計算せず必ず terrain から取る。
 */
export function createTerrainView(terrain: ProceduralTerrain): THREE.Group {
  const { size, segments } = terrain.data;
  const group = new THREE.Group();
  group.name = 'terrain';

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, terrain.getHeight(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: PLACEHOLDER_COLORS.ground,
    roughness: 1,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  group.add(mesh);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color: PLACEHOLDER_COLORS.gridMinor, transparent: true, opacity: 0.25 }),
  );
  group.add(wire);

  return group;
}
