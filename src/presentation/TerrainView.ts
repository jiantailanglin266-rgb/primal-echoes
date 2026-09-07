import * as THREE from 'three';
import type { ProceduralTerrain } from '@core/world/Terrain';
import { createTerrainMaterial } from './render/TerrainMaterial';

/**
 * HeightProvider をサンプリングして地形メッシュを作る。
 * core 側の高さ関数と描画が必ず一致するよう、独自に高さを計算せず必ず terrain から取る。
 * マテリアルは草/土/岩の高さ・傾斜ブレンド（render/TerrainMaterial）。
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

  const mesh = new THREE.Mesh(geometry, createTerrainMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData['noShadow'] = true;
  mesh.name = 'terrain-mesh';
  group.add(mesh);

  return group;
}
