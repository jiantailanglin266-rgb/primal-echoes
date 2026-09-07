import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { QUALITY_PRESETS, type RenderQuality } from './Renderer';

export interface SunSettings {
  /** 方位（度）。0 で +Z 方向から、90 で +X 方向から差す。 */
  azimuthDeg: number;
  /** 高度（度）。90 で真上。 */
  elevationDeg: number;
  intensity: number;
  color: number;
}

const DEFAULT_SUN: SunSettings = { azimuthDeg: 35, elevationDeg: 42, intensity: 3.2, color: 0xfff1dc };

/**
 * 太陽光（カスケードシャドウマップ）と環境光。
 * CSM はカメラ視錐台を距離で分割し、近景ほど高解像度の影にする。
 * 影を受けるマテリアルには setupMaterial が必要で、後から増えたメッシュにも
 * refreshMaterials() で追従させる（View 側は CSM を知らなくてよい）。
 */
export class Lighting {
  readonly csm: CSM;
  readonly hemisphere: THREE.HemisphereLight;
  readonly sun: SunSettings = { ...DEFAULT_SUN };
  private shadowIntensity = 0.7;
  private readonly direction = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    quality: RenderQuality,
  ) {
    const preset = QUALITY_PRESETS[quality];
    this.csm = new CSM({
      camera,
      parent: scene,
      cascades: preset.cascades,
      maxFar: 140,
      mode: 'practical',
      shadowMapSize: preset.shadowMapSize,
      shadowBias: -0.00015,
      lightDirection: this.computeDirection(),
      lightIntensity: this.sun.intensity,
      lightMargin: 120,
    });
    this.csm.fade = true;
    for (const light of this.csm.lights) {
      light.color.setHex(this.sun.color);
      light.shadow.normalBias = 0.03;
      light.shadow.intensity = this.shadowIntensity;
    }

    this.hemisphere = new THREE.HemisphereLight(0xbcd0e6, 0x3a4a2c, 0.9);
    scene.add(this.hemisphere);
  }

  get sunDirection(): THREE.Vector3 {
    return this.direction;
  }

  setSun(azimuthDeg: number, elevationDeg: number): void {
    this.sun.azimuthDeg = azimuthDeg;
    this.sun.elevationDeg = elevationDeg;
    this.csm.lightDirection.copy(this.computeDirection());
  }

  setSunIntensity(intensity: number): void {
    this.sun.intensity = intensity;
    for (const light of this.csm.lights) light.intensity = intensity;
  }

  setShadowIntensity(value: number): void {
    this.shadowIntensity = value;
    for (const light of this.csm.lights) light.shadow.intensity = value;
  }

  getShadowIntensity(): number {
    return this.shadowIntensity;
  }

  /** 影を受ける標準マテリアルへ CSM のシェーダを組み込む。増えたメッシュにも定期的に呼ぶ。 */
  refreshMaterials(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const std = material as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial || std.userData['csm']) continue;
        this.csm.setupMaterial(std);
        std.userData['csm'] = true;
        std.needsUpdate = true;
      }
    });
  }

  /** 毎フレーム、カメラに合わせてカスケードを更新する。 */
  update(): void {
    this.csm.update();
  }

  onCameraChanged(): void {
    this.csm.updateFrustums();
  }

  dispose(): void {
    this.csm.dispose();
    this.scene.remove(this.hemisphere);
  }

  private computeDirection(): THREE.Vector3 {
    const az = THREE.MathUtils.degToRad(this.sun.azimuthDeg);
    const el = THREE.MathUtils.degToRad(this.sun.elevationDeg);
    // 太陽「から」差す方向なので、太陽位置の逆ベクトル
    return this.direction.set(-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }
}
