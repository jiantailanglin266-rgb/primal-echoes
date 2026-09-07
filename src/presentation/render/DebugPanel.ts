import GUI from 'lil-gui';
import type * as THREE from 'three';
import type { Lighting } from './Lighting';

/**
 * 描画調整パネル（lil-gui、`?debug=1` のときだけ）。
 * 露出・太陽・影・環境光を実行中に触って、値が決まったら balance/JSON へ書き戻す運用。
 */
export class DebugPanel {
  readonly gui: GUI;

  constructor(renderer: THREE.WebGLRenderer, lighting: Lighting) {
    this.gui = new GUI({ title: 'Render', width: 260 });
    this.gui.domElement.classList.add('pe-render-gui');

    const tone = this.gui.addFolder('Tone');
    tone.add(renderer, 'toneMappingExposure', 0.2, 2.5, 0.01).name('露出');

    const sun = this.gui.addFolder('Sun');
    const sunState = { azimuth: lighting.sun.azimuthDeg, elevation: lighting.sun.elevationDeg, intensity: lighting.sun.intensity, shadow: lighting.getShadowIntensity() };
    sun.add(sunState, 'azimuth', 0, 360, 1).name('方位').onChange((v: number) => lighting.setSun(v, sunState.elevation));
    sun.add(sunState, 'elevation', 5, 89, 1).name('高度').onChange((v: number) => lighting.setSun(sunState.azimuth, v));
    sun.add(sunState, 'intensity', 0, 8, 0.05).name('強さ').onChange((v: number) => lighting.setSunIntensity(v));
    sun.add(sunState, 'shadow', 0, 1, 0.01).name('影の濃さ').onChange((v: number) => lighting.setShadowIntensity(v));

    const ambient = this.gui.addFolder('Ambient');
    ambient.add(lighting.hemisphere, 'intensity', 0, 2, 0.01).name('環境光');
  }

  addFolder(name: string): GUI {
    return this.gui.addFolder(name);
  }

  dispose(): void {
    this.gui.destroy();
  }
}
