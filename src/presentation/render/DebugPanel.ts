import GUI from 'lil-gui';
import type * as THREE from 'three';
import type { Lighting } from './Lighting';
import type { Environment } from './Environment';
import { getWindStrength, setWindStrength } from './Vegetation';
import type { PostFX } from './PostFX';
import type { RenderQuality } from './Renderer';
import type { CameraBalance } from '@data/schemas/balance';

/**
 * 描画調整パネル（lil-gui、`?debug=1` のときだけ）。
 * 露出・太陽・影・環境光・空・フォグ・風を実行中に触って、値が決まったらコードへ書き戻す運用。
 */
export class DebugPanel {
  readonly gui: GUI;

  constructor(_renderer: THREE.WebGLRenderer, lighting: Lighting, environment: Environment, postfx: PostFX, camera: CameraBalance | null = null) {
    this.gui = new GUI({ title: 'Render', width: 260 });
    this.gui.domElement.classList.add('pe-render-gui');

    const tone = this.gui.addFolder('Tone');
    tone.add(environment.settings, 'exposure', 0.2, 2.5, 0.01).name('露出').onChange(() => environment.applySettings());

    const sun = this.gui.addFolder('Sun');
    const sunState = { azimuth: lighting.sun.azimuthDeg, elevation: lighting.sun.elevationDeg, intensity: lighting.sun.intensity, shadow: lighting.getShadowIntensity() };
    const onSun = (): void => {
      lighting.setSun(sunState.azimuth, sunState.elevation);
      environment.onSunChanged();
    };
    sun.add(sunState, 'azimuth', 0, 360, 1).name('方位').onChange(onSun);
    sun.add(sunState, 'elevation', 3, 89, 1).name('高度').onChange(onSun);
    sun.add(sunState, 'intensity', 0, 8, 0.05).name('強さ').onChange((v: number) => lighting.setSunIntensity(v));
    sun.add(sunState, 'shadow', 0, 1, 0.01).name('影の濃さ').onChange((v: number) => lighting.setShadowIntensity(v));

    const ambient = this.gui.addFolder('Ambient');
    ambient.add(lighting.hemisphere, 'intensity', 0, 2, 0.01).name('環境光');
    ambient.add(environment.settings, 'envIntensity', 0, 2, 0.01).name('IBL').onChange(() => environment.applySettings());

    const sky = this.gui.addFolder('Sky / Fog');
    const apply = (): void => environment.applySettings();
    sky.add(environment.settings, 'turbidity', 1, 20, 0.1).name('濁り').onChange(apply);
    sky.add(environment.settings, 'rayleigh', 0, 4, 0.05).name('レイリー').onChange(apply);
    sky.add(environment.settings, 'mieCoefficient', 0, 0.05, 0.001).name('ミー').onChange(apply);
    sky.add(environment.settings, 'fogDensity', 0, 0.02, 0.0002).name('フォグ濃度').onChange(apply);
    sky.add(environment.settings, 'heightFogDensity', 0, 2, 0.01).name('高さフォグ').onChange(apply);
    sky.add(environment.settings, 'heightFogFalloff', 0.01, 0.5, 0.005).name('高さ減衰').onChange(apply);

    const fx = this.gui.addFolder('PostFX');
    const fxApply = (): void => postfx.applySettings();
    const preset = { quality: 'high' as RenderQuality };
    fx.add(preset, 'quality', ['low', 'mid', 'high']).name('プリセット').onChange((q: RenderQuality) => {
      postfx.applyPreset(q);
      fx.controllers.forEach((c) => c.updateDisplay());
    });
    fx.add(postfx.settings, 'enabled').name('有効');
    fx.add(postfx.settings, 'ao').name('AO').onChange(fxApply);
    fx.add(postfx.settings, 'aoRadius', 0.1, 2, 0.05).name('AO 半径').onChange(fxApply);
    fx.add(postfx.settings, 'aoIntensity', 0.2, 4, 0.1).name('AO 強度').onChange(fxApply);
    fx.add(postfx.settings, 'aoSamples', 4, 32, 1).name('AO サンプル').onChange(fxApply);
    fx.add(postfx.settings, 'bloom').name('Bloom').onChange(fxApply);
    fx.add(postfx.settings, 'bloomThreshold', 0, 12, 0.1).name('Bloom 閾値').onChange(fxApply);
    fx.add(postfx.settings, 'bloomIntensity', 0, 2, 0.01).name('Bloom 強度').onChange(fxApply);
    fx.add(postfx.settings, 'dof').name('DoF').onChange(fxApply);
    fx.add(postfx.settings, 'dofAperture', 0, 0.0005, 0.00001).name('DoF 絞り').onChange(fxApply);
    fx.add(postfx.settings, 'dofMaxBlur', 0, 0.03, 0.001).name('DoF 最大ボケ').onChange(fxApply);
    fx.add(postfx.settings, 'vignette', 0, 1, 0.01).name('ビネット').onChange(fxApply);
    fx.add(postfx.settings, 'chromatic', 0, 0.01, 0.0001).name('色収差').onChange(fxApply);
    fx.add(postfx.settings, 'grain', 0, 0.2, 0.005).name('グレイン').onChange(fxApply);
    fx.add(postfx.settings, 'saturation', 0, 1.5, 0.01).name('彩度').onChange(fxApply);
    fx.add(postfx.settings, 'gradeAmount', 0, 1, 0.01).name('グレード').onChange(fxApply);
    fx.add(postfx.settings, 'smaa').name('SMAA').onChange(fxApply);

    if (camera) {
      const cam = this.gui.addFolder('Camera');
      cam.add(camera, 'distance', 2, 12, 0.1).name('距離');
      cam.add(camera, 'shoulderOffset', 0, 1.5, 0.05).name('肩越し');
      cam.add(camera, 'fovDeg', 40, 90, 1).name('FOV');
      cam.add(camera, 'dashFovBoostDeg', 0, 20, 1).name('ダッシュ FOV+');
      cam.add(camera, 'springStiffness', 10, 300, 1).name('位置バネ');
      cam.add(camera, 'springDamping', 2, 40, 0.5).name('位置減衰');
      cam.add(camera, 'lookSpringStiffness', 10, 400, 1).name('注視バネ');
      cam.add(camera, 'lookSpringDamping', 2, 50, 0.5).name('注視減衰');
    }

    const wind = this.gui.addFolder('Wind');
    const windState = { strength: getWindStrength() };
    wind.add(windState, 'strength', 0, 1.5, 0.01).name('風の強さ').onChange((v: number) => setWindStrength(v));
  }

  addFolder(name: string): GUI {
    return this.gui.addFolder(name);
  }

  dispose(): void {
    this.gui.destroy();
  }
}
