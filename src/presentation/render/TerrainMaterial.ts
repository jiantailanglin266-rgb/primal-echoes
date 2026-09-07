import * as THREE from 'three';
import { createTerrainLayer, type TerrainLayerTextures } from './ProceduralTextures';

export interface TerrainMaterialOptions {
  /** テクスチャ 1 枚がワールドで何 m を覆うか。 */
  tileMeters: number;
  /** この高さ以上で土、さらに上で岩に寄る。 */
  dirtHeight: number;
  rockHeight: number;
  /** 法線の y がこれ以下（急斜面）で岩。 */
  slopeRockStart: number;
}

const DEFAULT_OPTIONS: TerrainMaterialOptions = { tileMeters: 6, dirtHeight: 1.2, rockHeight: 2.6, slopeRockStart: 0.82 };

/**
 * 地形マテリアル: 草 / 土 / 岩 の 3 層を高さと傾斜でブレンドする。
 * タイル感を消すため、セルごとに UV を回転・オフセットして 2 サンプルを混ぜる（簡易 stochastic）。
 * テクスチャは `assets/textures/terrain/{grass,dirt,rock}_{albedo,normal}.jpg` があれば差し替え可能で、
 * 無ければ手続き生成に落ちる。
 */
export function createTerrainMaterial(options: Partial<TerrainMaterialOptions> = {}): THREE.MeshStandardMaterial {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const grass = createTerrainLayer('grass', 512, 11);
  const dirt = createTerrainLayer('dirt', 512, 23);
  const rock = createTerrainLayer('rock', 512, 37);

  const material = new THREE.MeshStandardMaterial({
    map: grass.map,
    normalMap: grass.normalMap,
    roughness: 0.95,
    metalness: 0,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });

  const uniforms = {
    uDirtMap: { value: dirt.map },
    uDirtNormal: { value: dirt.normalMap },
    uRockMap: { value: rock.map },
    uRockNormal: { value: rock.normalMap },
    uTileScale: { value: 1 / opt.tileMeters },
    uDirtHeight: { value: opt.dirtHeight },
    uRockHeight: { value: opt.rockHeight },
    uSlopeRockStart: { value: opt.slopeRockStart },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;\nvarying vec3 vTerrainNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorld;
        varying vec3 vTerrainNormal;
        uniform sampler2D uDirtMap; uniform sampler2D uDirtNormal;
        uniform sampler2D uRockMap; uniform sampler2D uRockNormal;
        uniform float uTileScale; uniform float uDirtHeight; uniform float uRockHeight; uniform float uSlopeRockStart;
        float peHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // セルごとに回転・平行移動した UV を 2 つ混ぜ、繰り返し模様を崩す
        vec4 peSampleStochastic(sampler2D tex, vec2 uv) {
          vec2 cell = floor(uv * 0.5);
          vec2 f = fract(uv * 0.5);
          float a0 = peHash(cell) * 6.2831; float a1 = peHash(cell + 1.0) * 6.2831;
          mat2 r0 = mat2(cos(a0), -sin(a0), sin(a0), cos(a0));
          mat2 r1 = mat2(cos(a1), -sin(a1), sin(a1), cos(a1));
          vec4 s0 = texture2D(tex, r0 * uv + peHash(cell + 7.0));
          vec4 s1 = texture2D(tex, r1 * uv + peHash(cell + 13.0));
          float w = smoothstep(0.2, 0.8, peHash(cell + 3.0) * 0.4 + f.x * 0.6);
          return mix(s0, s1, w);
        }
        vec3 peLayerWeights() {
          float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
          float rockBySlope = smoothstep(1.0 - uSlopeRockStart, 1.0 - uSlopeRockStart + 0.12, slope);
          float h = vTerrainWorld.y;
          float dirtW = smoothstep(uDirtHeight - 0.6, uDirtHeight + 0.6, h);
          float rockW = max(smoothstep(uRockHeight - 0.8, uRockHeight + 0.8, h), rockBySlope);
          float grassW = 1.0 - max(dirtW, rockW);
          dirtW = dirtW * (1.0 - rockW);
          vec3 w = vec3(grassW, dirtW, rockW);
          return w / max(w.x + w.y + w.z, 1e-4);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec2 peUv = vTerrainWorld.xz * uTileScale;
        vec3 peW = peLayerWeights();
        vec4 peGrass = peSampleStochastic(map, peUv);
        vec4 peDirt = peSampleStochastic(uDirtMap, peUv * 1.3);
        vec4 peRock = peSampleStochastic(uRockMap, peUv * 0.7);
        vec4 sampledDiffuseColor = peGrass * peW.x + peDirt * peW.y + peRock * peW.z;
        diffuseColor *= sampledDiffuseColor;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 peNg = peSampleStochastic(normalMap, peUv).xyz * 2.0 - 1.0;
        vec3 peNd = peSampleStochastic(uDirtNormal, peUv * 1.3).xyz * 2.0 - 1.0;
        vec3 peNr = peSampleStochastic(uRockNormal, peUv * 0.7).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(peNg * peW.x + peNd * peW.y + peNr * peW.z);
        mapN.xy *= normalScale;
        // 地形は上向き基準なので、接空間を世界の XZ に固定した簡易版
        vec3 peT = normalize(vec3(1.0, 0.0, 0.0) - normal * normal.x);
        vec3 peB = normalize(cross(normal, peT));
        normal = normalize(peT * mapN.x + peB * mapN.y + normal * mapN.z);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.7, peW.z);');
  };
  material.customProgramCacheKey = () => 'pe-terrain';
  material.userData['terrainLayers'] = { grass, dirt, rock } satisfies Record<string, TerrainLayerTextures>;
  return material;
}
