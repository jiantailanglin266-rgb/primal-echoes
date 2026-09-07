import * as THREE from 'three';
import type { Field } from '@core/world/Field';
import { Random } from '@shared/rng/Random';

/** 風の共有ユニフォーム。草と木の葉が同じ風を受ける。 */
const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 0.35 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
};

export function setWindStrength(value: number): void {
  windUniforms.uWindStrength.value = value;
}

export function getWindStrength(): number {
  return windUniforms.uWindStrength.value;
}

/** 頂点シェーダに風の揺れを注入する（インスタンス位置で位相をずらす）。 */
function patchWind(material: THREE.Material, amount: number): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    previous?.(shader, r);
    shader.uniforms['uTime'] = windUniforms.uTime;
    shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
    shader.uniforms['uWindDir'] = windUniforms.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uWindStrength; uniform vec2 uWindDir;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 peInst = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 peInst = vec3(0.0);
          #endif
          float peH = clamp(position.y, 0.0, 10.0);
          float pePhase = dot(peInst.xz, vec2(0.13, 0.17)) + uTime * 1.7;
          float peGust = sin(pePhase) * 0.6 + sin(pePhase * 2.3 + 1.0) * 0.4;
          vec2 peSway = uWindDir * peGust * uWindStrength * peH * peH * ${amount.toFixed(3)};
          transformed.xz += peSway;
        }`,
      );
  };
  material.customProgramCacheKey = () => `pe-wind-${amount}`;
}

export interface VegetationOptions {
  grassCount: number;
  treeCount: number;
  rockCount: number;
}

const DEFAULT_OPTIONS: VegetationOptions = { grassCount: 14000, treeCount: 140, rockCount: 90 };

/** 草はこの大きさの正方形チャンクに分け、視錐台外・遠方のチャンクを描かない。 */
const GRASS_CHUNK_METERS = 36;

interface GrassChunk {
  mesh: THREE.InstancedMesh;
  center: THREE.Vector3;
  radius: number;
  /** 密度 1.0 のときのインスタンス数。 */
  full: number;
}

/**
 * 草・木・岩の散布。すべてプリミティブの InstancedMesh で、
 * 後で glTF に差し替える場合は `scatterInstances` に渡すジオメトリ/マテリアルを変えるだけでよい。
 * 配置ルール: 傾斜が緩く、キャンプ・水場の近くを避け、森エリアに木を密に置く。
 */
export class Vegetation {
  readonly object = new THREE.Group();
  private readonly rng = new Random(0x5eed);
  private readonly grassChunks: GrassChunk[] = [];
  private grassViewDistance = Infinity;

  constructor(
    private readonly field: Field,
    options: Partial<VegetationOptions> = {},
  ) {
    const opt = { ...DEFAULT_OPTIONS, ...options };
    this.object.name = 'vegetation';
    for (const mesh of this.createGrass(opt.grassCount)) this.object.add(mesh);
    for (const mesh of this.createTrees(opt.treeCount)) this.object.add(mesh);
    this.object.add(this.createRocks(opt.rockCount));
  }

  /** 風の時間を進め、カメラから遠い草チャンクを非表示にする（視錐台外は three が自動で省く）。 */
  update(frameDt: number, cameraPosition?: THREE.Vector3): void {
    windUniforms.uTime.value += frameDt;
    if (!cameraPosition || !Number.isFinite(this.grassViewDistance)) {
      if (cameraPosition) for (const c of this.grassChunks) c.mesh.visible = true;
      return;
    }
    for (const c of this.grassChunks) {
      c.mesh.visible = c.center.distanceTo(cameraPosition) - c.radius < this.grassViewDistance;
    }
  }

  /** 品質段階から呼ぶ。density は描くインスタンスの割合、viewDistance はチャンクを描く最大距離（m）。 */
  setGrass(density: number, viewDistance: number): void {
    const ratio = Math.max(0, Math.min(1, density));
    for (const c of this.grassChunks) c.mesh.count = Math.round(c.full * ratio);
    this.grassViewDistance = viewDistance;
  }

  get grassInstanceCount(): number {
    let n = 0;
    for (const c of this.grassChunks) n += c.mesh.count;
    return n;
  }

  // ---- placement rules ----

  private pickGround(minSlopeY: number, avoidCamp: boolean, preferForest: number): THREE.Vector3 | null {
    const terrain = this.field.terrain;
    const half = terrain.halfSize - 4;
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = this.rng.range(-half, half);
      const z = this.rng.range(-half, half);
      const area = this.field.areaAt(new (this.field.pois[0]!.position.constructor as typeof import('@shared/math/Vec3').Vec3)(x, 0, z));
      if (avoidCamp && area?.id === 'base_camp') continue;
      if (preferForest > 0 && area?.id !== 'forest' && this.rng.next() < preferForest) continue;
      const water = this.field.nearestPoi('water', new (this.field.pois[0]!.position.constructor as typeof import('@shared/math/Vec3').Vec3)(x, 0, z));
      if (water && water.position.horizontalDistanceTo(new (water.position.constructor as typeof import('@shared/math/Vec3').Vec3)(x, 0, z)) < 6) continue;
      const n = terrain.getNormal(x, z);
      if (n.y < minSlopeY) continue;
      return new THREE.Vector3(x, terrain.getHeight(x, z), z);
    }
    return null;
  }

  private createGrass(count: number): THREE.InstancedMesh[] {
    // 先細りの 1 枚板を 2 枚交差させた草。
    const blade = new THREE.PlaneGeometry(0.16, 0.5, 1, 3);
    blade.translate(0, 0.25, 0);
    const pos = blade.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * (1 - y / 0.55));
    }
    const cross = blade.clone().rotateY(Math.PI / 2);
    const geometry = mergeGeometries([blade, cross]);
    // 薄い板の法線をそのまま使うと裏面や横向きの刃が真っ黒になるため、地面と同じ上向き法線で受光させる
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 0.9, side: THREE.DoubleSide });
    patchWind(material, 0.35);

    // 配置を先に決め、チャンク（格子）ごとに InstancedMesh を作る。1 メッシュだと境界球が地形全体になり視錐台カリングが効かない
    const half = this.field.terrain.halfSize;
    const cells = Math.max(1, Math.ceil((half * 2) / GRASS_CHUNK_METERS));
    const buckets = new Map<number, { matrices: THREE.Matrix4[]; colors: THREE.Color[] }>();
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const p = this.pickGround(0.86, true, 0);
      if (!p) continue;
      dummy.position.copy(p);
      dummy.rotation.set(0, this.rng.range(0, Math.PI * 2), 0);
      const sc = this.rng.range(0.7, 1.5);
      dummy.scale.set(sc, sc * this.rng.range(0.8, 1.4), sc);
      dummy.updateMatrix();
      const ix = Math.min(cells - 1, Math.floor((p.x + half) / GRASS_CHUNK_METERS));
      const iz = Math.min(cells - 1, Math.floor((p.z + half) / GRASS_CHUNK_METERS));
      const key = ix + iz * cells;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { matrices: [], colors: [] }));
      bucket.matrices.push(dummy.matrix.clone());
      bucket.colors.push(new THREE.Color().setHSL(0.23 + this.rng.range(-0.03, 0.03), 0.5, 0.42 + this.rng.range(-0.08, 0.1)));
    }

    const meshes: THREE.InstancedMesh[] = [];
    for (const bucket of buckets.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, bucket.matrices.length);
      mesh.name = 'grass';
      mesh.receiveShadow = true;
      mesh.userData['noShadow'] = true; // 草は影を落とさない（コスト対効果）
      bucket.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      bucket.colors.forEach((c, i) => mesh.setColorAt(i, c));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      const sphere = mesh.boundingSphere as THREE.Sphere;
      this.grassChunks.push({ mesh, center: sphere.center.clone(), radius: sphere.radius, full: bucket.matrices.length });
      meshes.push(mesh);
    }
    return meshes;
  }

  private createTrees(count: number): THREE.InstancedMesh[] {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 5, 7);
    trunkGeo.translate(0, 2.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    const canopyGeo = new THREE.IcosahedronGeometry(2.4, 1);
    canopyGeo.translate(0, 6.2, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f5a2e, roughness: 0.95, flatShading: true });
    patchWind(canopyMat, 0.03);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    trunks.name = 'tree-trunks';
    canopies.name = 'tree-canopies';
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const p = this.pickGround(0.8, true, 0.75);
      if (!p) continue;
      dummy.position.copy(p);
      dummy.rotation.set(0, this.rng.range(0, Math.PI * 2), 0);
      const s = this.rng.range(0.8, 1.6);
      dummy.scale.set(s, s * this.rng.range(0.9, 1.3), s);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      canopies.setMatrixAt(placed, dummy.matrix);
      color.setHSL(0.3 + this.rng.range(-0.05, 0.04), 0.4, 0.25 + this.rng.range(-0.05, 0.08));
      canopies.setColorAt(placed, color);
      placed++;
    }
    trunks.count = placed;
    canopies.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    return [trunks, canopies];
  }

  private createRocks(count: number): THREE.InstancedMesh {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b655c, roughness: 1, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.name = 'rocks';
    const dummy = new THREE.Object3D();
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const p = this.pickGround(0.5, true, 0);
      if (!p) continue;
      dummy.position.copy(p);
      dummy.position.y -= 0.3;
      dummy.rotation.set(this.rng.range(0, Math.PI), this.rng.range(0, Math.PI), this.rng.range(0, Math.PI));
      const s = this.rng.range(0.5, 2.2);
      dummy.scale.set(s * this.rng.range(0.8, 1.4), s * this.rng.range(0.6, 1), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}

/** 複数ジオメトリを 1 つに結合する最小実装（非インデックス、position/normal/uv）。 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const g of geometries) {
    const src = g.index ? g.toNonIndexed() : g;
    positions.push(...Array.from((src.attributes.position as THREE.BufferAttribute).array));
    normals.push(...Array.from((src.attributes.normal as THREE.BufferAttribute).array));
    uvs.push(...Array.from((src.attributes.uv as THREE.BufferAttribute).array));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return merged;
}
