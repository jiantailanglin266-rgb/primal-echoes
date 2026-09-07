import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/**
 * glTF アセットの読み込み口。Draco（ジオメトリ圧縮）と KTX2/Basis（テクスチャ圧縮）に対応。
 * デコーダは `public/libs/` に置かれる（scripts/copy-decoders.mjs が three からコピー）。
 * 無いアセットは null を返し、呼び出し側がプリミティブへフォールバックする。
 */
export class AssetLoader {
  private readonly gltf: GLTFLoader;
  private readonly draco: DRACOLoader;
  private readonly ktx2: KTX2Loader;
  private readonly cache = new Map<string, Promise<GLTF | null>>();

  constructor(renderer: THREE.WebGLRenderer) {
    const base = import.meta.env.BASE_URL;
    this.draco = new DRACOLoader().setDecoderPath(`${base}libs/draco/`);
    this.ktx2 = new KTX2Loader().setTranscoderPath(`${base}libs/basis/`).detectSupport(renderer);
    this.gltf = new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx2);
  }

  /** `public/assets/models/<name>.glb` を読む。存在しなければ null。 */
  loadModel(name: string): Promise<GLTF | null> {
    const url = `${import.meta.env.BASE_URL}assets/models/${name}.glb`;
    let pending = this.cache.get(url);
    if (!pending) {
      pending = this.fetchIfExists(url);
      this.cache.set(url, pending);
    }
    return pending;
  }

  /** メモリ上の GLB を読む（検証やドラッグ&ドロップ用）。 */
  parseModel(buffer: ArrayBuffer): Promise<GLTF> {
    return this.gltf.parseAsync(buffer, '');
  }

  private async fetchIfExists(url: string): Promise<GLTF | null> {
    try {
      // 存在確認を先に行い、404 の HTML を GLTFLoader に食わせない
      const head = await fetch(url, { method: 'HEAD' });
      const type = head.headers.get('content-type') ?? '';
      if (!head.ok || type.includes('text/html')) return null;
      return await this.gltf.loadAsync(url);
    } catch (error) {
      console.warn(`[AssetLoader] failed to load ${url}`, error);
      return null;
    }
  }

  dispose(): void {
    this.draco.dispose();
    this.ktx2.dispose();
  }
}

export interface MaterialTuning {
  envMapIntensity?: number;
  roughness?: number;
  /** 皮膚・鱗向け: MeshPhysicalMaterial へ変換して sheen / clearcoat を付ける。 */
  organic?: { sheen: number; sheenColor: number; clearcoat: number };
}

/** 読み込んだモデルの標準マテリアルを一括調整する。 */
export function tuneMaterials(root: THREE.Object3D, tuning: MaterialTuning): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material, index) => {
      let std = material as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial) return;
      if (tuning.organic && !(std as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        const physical = new THREE.MeshPhysicalMaterial();
        physical.copy(std);
        physical.sheen = tuning.organic.sheen;
        physical.sheenColor.setHex(tuning.organic.sheenColor);
        physical.clearcoat = tuning.organic.clearcoat;
        if (Array.isArray(mesh.material)) mesh.material[index] = physical;
        else mesh.material = physical;
        std = physical;
      }
      if (tuning.envMapIntensity !== undefined) std.envMapIntensity = tuning.envMapIntensity;
      if (tuning.roughness !== undefined) std.roughness = tuning.roughness;
      std.needsUpdate = true;
    });
  });
}

/** モデルの高さを targetHeight に合わせ、足元を原点に置く。 */
export function fitToHeight(root: THREE.Object3D, targetHeight: number): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 1e-4 ? targetHeight / size.y : 1;
  root.scale.setScalar(scale);
  root.position.y -= box.min.y * scale;
  return scale;
}
