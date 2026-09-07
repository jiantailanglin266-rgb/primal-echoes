import * as THREE from 'three';

export type RenderQuality = 'low' | 'mid' | 'high';

/** 品質段階ごとの描画パラメータ。Phase 6 で端末判定から自動選択する。 */
export const QUALITY_PRESETS: Record<RenderQuality, { maxPixelRatio: number; shadowMapSize: number; cascades: number }> = {
  low: { maxPixelRatio: 1, shadowMapSize: 1024, cascades: 2 },
  mid: { maxPixelRatio: 1.5, shadowMapSize: 2048, cascades: 3 },
  high: { maxPixelRatio: 2, shadowMapSize: 2048, cascades: 3 },
};

/**
 * WebGLRenderer の生成。色空間・トーンマッピング・影の種類をここで一箇所に決める。
 *
 * WebGPURenderer は CSM アドオンや EffectComposer と互換が無く二重実装になるため、
 * GitHub Pages で確実に動く WebGL に限定する（docs/CG_UPGRADE.md 参照）。
 */
export function createRenderer(canvas: HTMLCanvasElement, quality: RenderQuality): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY_PRESETS[quality].maxPixelRatio));
  // 物理ベースの光量・フィルム調のトーンマッピング。露出はデバッグ UI から調整する。
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}
