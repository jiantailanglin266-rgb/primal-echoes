import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { RenderQuality } from './Renderer';

export interface PostFXSettings {
  enabled: boolean;
  ao: boolean;
  aoRadius: number;
  aoIntensity: number;
  /** GTAO のサンプル数。コストにほぼ比例する。 */
  aoSamples: number;
  bloom: boolean;
  bloomThreshold: number;
  bloomIntensity: number;
  bloomRadius: number;
  dof: boolean;
  /** 焦点距離は自動（プレイヤー距離）。ボケの強さだけ調整する。 */
  dofAperture: number;
  dofMaxBlur: number;
  vignette: number;
  chromatic: number;
  grain: number;
  saturation: number;
  /** 影を青緑、ハイライトを暖色へ寄せる強さ。 */
  gradeAmount: number;
  smaa: boolean;
}

const HIGH: PostFXSettings = {
  enabled: true,
  ao: true,
  aoRadius: 0.5,
  aoIntensity: 1.5,
  aoSamples: 10,
  bloom: true,
  bloomThreshold: 8.0,
  bloomIntensity: 0.25,
  bloomRadius: 0.3,
  dof: true,
  dofAperture: 0.00012,
  dofMaxBlur: 0.012,
  vignette: 0.4,
  chromatic: 0.0006,
  grain: 0.05,
  saturation: 1.0,
  gradeAmount: 0.3,
  smaa: true,
};

/** 品質プリセット。Phase 6 で端末判定から選ぶ。 */
export const POSTFX_PRESETS: Record<RenderQuality, PostFXSettings> = {
  high: HIGH,
  mid: { ...HIGH, dof: false, aoRadius: 0.4, aoSamples: 6, grain: 0.04 },
  low: { ...HIGH, ao: false, dof: false, smaa: false, bloomRadius: 0.3, chromatic: 0, grain: 0.03 },
};

/**
 * 画面全体の色調・ビネット・色収差・粒子ノイズを 1 パスで行う。
 * LUT ファイルは使わず、輝度に応じたティント（影: 青緑、ハイライト: 暖色）と彩度で近似する。
 * `assets/luts/*.cube` を使う場合は three/addons の LUTPass をこの前に挟む。
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.4 },
    uChromatic: { value: 0.0015 },
    uGrain: { value: 0.05 },
    uSaturation: { value: 0.9 },
    uGrade: { value: 0.35 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uGrade;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 centered = vUv - 0.5;
      centered.x *= uAspect;
      float r2 = dot(centered, centered);
      // 色収差: 画面端ほど RGB をずらす
      vec2 dir = (vUv - 0.5) * r2 * uChromatic * 40.0;
      float rC = texture2D(tDiffuse, vUv + dir).r;
      float gC = texture2D(tDiffuse, vUv).g;
      float bC = texture2D(tDiffuse, vUv - dir).b;
      vec3 color = vec3(rC, gC, bC);
      // カラーグレード: 輝度で影/ハイライトを分け、それぞれ色を寄せる
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.86, 0.96, 1.0);
      vec3 highlightTint = vec3(1.0, 0.96, 0.88);
      vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.2, 0.8, luma));
      color = mix(color, color * tint, uGrade);
      color = mix(vec3(luma), color, uSaturation);
      // ビネット
      float vig = 1.0 - smoothstep(0.35, 1.25, sqrt(r2)) * uVignette;
      color *= vig;
      // フィルムグレイン
      float noise = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
      color += noise * uGrain * (0.6 + 0.4 * (1.0 - luma));
      gl_FragColor = vec4(color, 1.0);
    }`,
};

/**
 * ポストプロセス。順序: Render → GTAO → Bloom → DoF → Grade → SMAA → Output。
 * OutputPass がトーンマッピングと sRGB 変換を担うので、レンダラ側の設定はそのまま使われる。
 * Bloom はトーンマッピング前の HDR 値に掛かるため、閾値は 1.0 超（太陽・エーテル発光だけが光る）にする。
 */
export class PostFX {
  readonly settings: PostFXSettings;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly aoPass: GTAOPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly bokehPass: BokehPass;
  private readonly gradePass: ShaderPass;
  private readonly smaaPass: SMAAPass;
  private readonly outputPass: OutputPass;
  private width = 1;
  private height = 1;
  private time = 0;
  private chromaticPulse = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    quality: RenderQuality,
  ) {
    this.settings = { ...POSTFX_PRESETS[quality] };
    const size = renderer.getSize(new THREE.Vector2());
    this.width = Math.max(1, size.x);
    this.height = Math.max(1, size.y);

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.aoPass = new GTAOPass(scene, camera, this.width, this.height);
    this.aoPass.output = GTAOPass.OUTPUT.Default;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), this.settings.bloomIntensity, this.settings.bloomRadius, this.settings.bloomThreshold);
    this.bokehPass = new BokehPass(scene, camera, { focus: 8, aperture: this.settings.dofAperture, maxblur: this.settings.dofMaxBlur });
    this.gradePass = new ShaderPass(GradeShader);
    this.smaaPass = new SMAAPass();
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.aoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.bokehPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.smaaPass);
    this.composer.addPass(this.outputPass);
    this.applySettings();
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  /** 設定オブジェクトを書き換えたあとに呼ぶ。 */
  applySettings(): void {
    const s = this.settings;
    this.aoPass.enabled = s.ao;
    // updateGtaoMaterial は defines（SAMPLES）も更新するので needsUpdate まで面倒を見てくれる
    this.aoPass.updateGtaoMaterial({ radius: s.aoRadius, scale: s.aoIntensity, samples: s.aoSamples, distanceExponent: 1, thickness: 1, distanceFallOff: 1, screenSpaceRadius: false });
    this.bloomPass.enabled = s.bloom;
    this.bloomPass.threshold = s.bloomThreshold;
    this.bloomPass.strength = s.bloomIntensity;
    this.bloomPass.radius = s.bloomRadius;
    this.bokehPass.enabled = s.dof;
    const bokeh = this.bokehPass.uniforms as Record<string, { value: number }>;
    if (bokeh['aperture']) bokeh['aperture'].value = s.dofAperture;
    if (bokeh['maxblur']) bokeh['maxblur'].value = s.dofMaxBlur;
    const g = this.gradePass.uniforms;
    (g['uVignette'] as THREE.IUniform<number>).value = s.vignette;
    (g['uGrain'] as THREE.IUniform<number>).value = s.grain;
    (g['uSaturation'] as THREE.IUniform<number>).value = s.saturation;
    (g['uGrade'] as THREE.IUniform<number>).value = s.gradeAmount;
    this.smaaPass.enabled = s.smaa;
  }

  applyPreset(quality: RenderQuality): void {
    Object.assign(this.settings, POSTFX_PRESETS[quality]);
    this.applySettings();
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.composer.setSize(this.width, this.height);
    this.aoPass.setSize(this.width, this.height);
    this.bloomPass.setSize(this.width, this.height);
    this.smaaPass.setSize(this.width, this.height);
    (this.gradePass.uniforms['uAspect'] as THREE.IUniform<number>).value = this.width / this.height;
  }

  setPixelRatio(ratio: number): void {
    this.composer.setPixelRatio(ratio);
    this.setSize(this.width, this.height);
  }

  /** 焦点距離を毎フレーム与える（プレイヤーまでの距離）。 */
  setFocusDistance(distance: number): void {
    const bokeh = this.bokehPass.uniforms as Record<string, { value: number }>;
    if (bokeh['focus']) bokeh['focus'].value = distance;
  }

  /** 咆哮などで一瞬だけ色収差を強める（Phase 5）。 */
  pulseChromatic(amount: number): void {
    this.chromaticPulse = Math.max(this.chromaticPulse, amount);
  }

  render(frameDt: number): void {
    this.time += frameDt;
    this.chromaticPulse = Math.max(0, this.chromaticPulse - frameDt * 0.02);
    const g = this.gradePass.uniforms;
    (g['uTime'] as THREE.IUniform<number>).value = this.time;
    (g['uChromatic'] as THREE.IUniform<number>).value = this.settings.chromatic + this.chromaticPulse;
    this.composer.render(frameDt);
  }

  dispose(): void {
    this.composer.dispose();
    this.aoPass.dispose();
    this.bloomPass.dispose();
    this.bokehPass.dispose();
    this.gradePass.dispose();
    this.smaaPass.dispose();
    this.outputPass.dispose();
  }
}
