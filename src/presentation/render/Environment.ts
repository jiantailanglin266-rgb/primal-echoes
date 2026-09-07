import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { Lighting } from './Lighting';

export interface EnvironmentSettings {
  /** 大気の濁り。晴天 2〜4、曇天 8〜12。 */
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  /** 距離フォグ（FogExp2）の密度。 */
  fogDensity: number;
  /** 高さフォグ: 地表付近の濃さと減衰。 */
  heightFogDensity: number;
  heightFogFalloff: number;
  /** IBL の強さ。 */
  envIntensity: number;
  /** 基準露出。雨で自動的に下がる。 */
  exposure: number;
}

const DEFAULTS: EnvironmentSettings = {
  turbidity: 3.2,
  rayleigh: 1.6,
  mieCoefficient: 0.006,
  mieDirectionalG: 0.82,
  fogDensity: 0.0052,
  heightFogDensity: 0.35,
  heightFogFalloff: 0.09,
  envIntensity: 0.9,
  exposure: 1.0,
};

/** 高さフォグのシェーダ注入で使う共有ユニフォーム。全マテリアルで同じ値を参照する。 */
const heightFogUniforms = {
  uHeightFogDensity: { value: DEFAULTS.heightFogDensity },
  uHeightFogFalloff: { value: DEFAULTS.heightFogFalloff },
  uHeightFogColor: { value: new THREE.Color(0x9fb3c4) },
};

/**
 * 空・IBL・フォグ・高さフォグ。
 * - 空は大気散乱モデル（three/addons Sky）。太陽位置は Lighting と同期させ、影と空の光が一致する
 * - IBL は空を PMREM に焼いて scene.environment へ。太陽が動いたら焼き直す（節約のため間引く）
 * - `assets/hdri/environment.hdr` が置かれていれば HDRI を優先する
 * - 距離フォグは FogExp2、高さフォグはマテリアルへのシェーダ注入（patchMaterial）
 */
export class Environment {
  readonly settings: EnvironmentSettings = { ...DEFAULTS };
  readonly sky: Sky;
  readonly fog: THREE.FogExp2;
  private readonly pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private hdriTexture: THREE.Texture | null = null;
  private envDirty = true;
  private rebakeTimer = 0;
  private rainIntensity = 0;
  private readonly skyScene = new THREE.Scene();
  private readonly sunPosition = new THREE.Vector3();
  private readonly horizonColor = new THREE.Color();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly lighting: Lighting,
  ) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    this.scene.add(this.sky);
    this.fog = new THREE.FogExp2(0x9fb3c4, this.settings.fogDensity);
    this.scene.fog = this.fog;
    this.scene.background = null;
    this.applySkySettings();
    void this.tryLoadHdri();
  }

  /** 雨の強さ 0〜1。空を曇らせ、フォグを濃くし、太陽を弱める。 */
  setRain(intensity: number): void {
    if (Math.abs(intensity - this.rainIntensity) < 1e-3) return;
    this.rainIntensity = intensity;
    this.applySkySettings();
    this.envDirty = true;
  }

  /** 設定変更後に呼ぶ（デバッグパネルから）。 */
  applySettings(): void {
    this.applySkySettings();
    this.envDirty = true;
  }

  /** 太陽が動いたときに呼ぶ。 */
  onSunChanged(): void {
    this.applySkySettings();
    this.envDirty = true;
  }

  /**
   * 高さフォグをマテリアルへ注入する。CSM の onBeforeCompile より後に連結する。
   * 標準の fog_fragment を「距離フォグと高さフォグの大きい方」に置き換える。
   */
  patchMaterial(material: THREE.Material): void {
    if (material.userData['heightFog']) return;
    material.userData['heightFog'] = true;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, rendererRef) => {
      previous?.(shader, rendererRef);
      shader.uniforms['uHeightFogDensity'] = heightFogUniforms.uHeightFogDensity;
      shader.uniforms['uHeightFogFalloff'] = heightFogUniforms.uHeightFogFalloff;
      shader.uniforms['uHeightFogColor'] = heightFogUniforms.uHeightFogColor;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHeightFogY;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvHeightFogY = (modelMatrix * vec4(transformed, 1.0)).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHeightFogY;\nuniform float uHeightFogDensity;\nuniform float uHeightFogFalloff;\nuniform vec3 uHeightFogColor;')
        .replace(
          '#include <fog_fragment>',
          `#ifdef USE_FOG
            float peFogDist = vFogDepth;
            #ifdef FOG_EXP2
              float peFogFactor = 1.0 - exp( - fogDensity * fogDensity * peFogDist * peFogDist );
            #else
              float peFogFactor = smoothstep( fogNear, fogFar, peFogDist );
            #endif
            // 高さフォグ: 低いほど濃く、距離とともに積算される
            float peHeight = exp( - max( vHeightFogY, 0.0 ) * uHeightFogFalloff );
            float peHeightFog = 1.0 - exp( - uHeightFogDensity * peHeight * peFogDist * 0.02 );
            float peFog = clamp( max( peFogFactor, peHeightFog ), 0.0, 1.0 );
            vec3 peFogColor = mix( fogColor, uHeightFogColor, peHeightFog * 0.5 );
            gl_FragColor.rgb = mix( gl_FragColor.rgb, peFogColor, peFog );
          #endif`,
        );
    };
    material.needsUpdate = true;
  }

  update(frameDt: number): void {
    this.rebakeTimer += frameDt;
    // 焼き直しは重いので 0.5 秒に 1 回まで
    if (this.envDirty && this.rebakeTimer >= 0.5) {
      this.rebakeTimer = 0;
      this.envDirty = false;
      this.bakeEnvironment();
    }
  }

  dispose(): void {
    this.envTarget?.dispose();
    this.pmrem.dispose();
    this.scene.remove(this.sky);
  }

  private applySkySettings(): void {
    const s = this.settings;
    const rain = this.rainIntensity;
    const u = this.sky.material.uniforms;
    (u['turbidity'] as THREE.IUniform<number>).value = THREE.MathUtils.lerp(s.turbidity, 14, rain);
    (u['rayleigh'] as THREE.IUniform<number>).value = THREE.MathUtils.lerp(s.rayleigh, 0.6, rain);
    (u['mieCoefficient'] as THREE.IUniform<number>).value = THREE.MathUtils.lerp(s.mieCoefficient, 0.02, rain);
    (u['mieDirectionalG'] as THREE.IUniform<number>).value = s.mieDirectionalG;
    // 太陽位置は Lighting の「差す方向」の逆
    this.sunPosition.copy(this.lighting.sunDirection).multiplyScalar(-1);
    (u['sunPosition'] as THREE.IUniform<THREE.Vector3>).value.copy(this.sunPosition);

    // フォグ色は地平線付近の空の色から近似（高度が低いほど暖色、雨は灰色）
    const elevation = Math.max(0, this.sunPosition.y);
    this.horizonColor.setHSL(THREE.MathUtils.lerp(0.075, 0.58, Math.min(1, elevation * 1.8)), THREE.MathUtils.lerp(0.35, 0.08, rain), THREE.MathUtils.lerp(0.62, 0.3, rain));
    this.fog.color.copy(this.horizonColor);
    this.fog.density = THREE.MathUtils.lerp(s.fogDensity, s.fogDensity * 2.0, rain);
    heightFogUniforms.uHeightFogDensity.value = THREE.MathUtils.lerp(s.heightFogDensity, s.heightFogDensity * 2.2, rain);
    heightFogUniforms.uHeightFogFalloff.value = s.heightFogFalloff;
    heightFogUniforms.uHeightFogColor.value.copy(this.horizonColor).multiplyScalar(0.9);

    // 雨は太陽を弱め、環境光を灰色に寄せる
    this.lighting.setSunIntensity(THREE.MathUtils.lerp(this.lighting.sun.intensity, this.lighting.sun.intensity, 0));
    this.lighting.csm.lights.forEach((l) => l.color.setHex(this.lighting.sun.color).lerp(new THREE.Color(0x9aa4b0), rain * 0.7));
    this.lighting.hemisphere.color.setHex(0xbcd0e6).lerp(new THREE.Color(0x7f8890), rain);
    this.scene.environmentIntensity = s.envIntensity * THREE.MathUtils.lerp(1, 0.6, rain);
    // 雨は露出も落とし、白く飛ばずに「暗い天気」として見せる
    this.renderer.toneMappingExposure = s.exposure * THREE.MathUtils.lerp(1, 0.72, rain);
  }

  private bakeEnvironment(): void {
    if (this.hdriTexture) {
      this.scene.environment = this.hdriTexture;
      return;
    }
    // Sky を単独シーンで PMREM に焼く
    this.skyScene.add(this.sky);
    const target = this.pmrem.fromScene(this.skyScene, 0.04);
    this.scene.add(this.sky); // fromScene で親が変わるので戻す
    this.envTarget?.dispose();
    this.envTarget = target;
    this.scene.environment = target.texture;
  }

  /** `assets/hdri/environment.hdr` があれば HDRI を IBL と背景に使う（無ければ何もしない）。 */
  private async tryLoadHdri(): Promise<void> {
    const url = `${import.meta.env.BASE_URL}assets/hdri/environment.hdr`;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok || !(head.headers.get('content-type') ?? '').includes('octet')) return;
      const texture = await new RGBELoader().loadAsync(url);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const target = this.pmrem.fromEquirectangular(texture);
      texture.dispose();
      this.hdriTexture = target.texture;
      this.scene.environment = this.hdriTexture;
      this.scene.background = this.hdriTexture;
      this.scene.backgroundBlurriness = 0.12;
      this.sky.visible = false;
    } catch {
      // 未配置なら手続き空のまま
    }
  }
}
