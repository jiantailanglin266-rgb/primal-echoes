import * as THREE from 'three';
import { createRenderer, type RenderQuality } from './render/Renderer';
import { Lighting } from './render/Lighting';

const SHADOW_REFRESH_INTERVAL_SECONDS = 1.5;

/**
 * Three.js のレンダラ・シーン・カメラ・ライティングの facade。
 * core 層の状態を読んで描画するだけで、シミュレーションには一切書き込まない。
 * 実体は presentation/render/ の各モジュールに分かれている。
 */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly lighting: Lighting;
  readonly quality: RenderQuality;

  private readonly resizeObserver: ResizeObserver;
  private shadowRefreshTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: RenderQuality = 'high',
  ) {
    this.quality = quality;
    this.renderer = createRenderer(canvas, quality);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d10);
    this.scene.fog = new THREE.Fog(0x0b0d10, 60, 220);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    this.camera.position.set(0, 4, -8);
    this.camera.lookAt(0, 1, 0);

    this.lighting = new Lighting(this.scene, this.camera, quality);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? document.body);
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.lighting.onCameraChanged();
  }

  /**
   * 影のフラグと CSM マテリアル設定を全メッシュへ適用する。
   * View が個別に設定し忘れても揃うように、追加直後と一定間隔で呼ぶ。
   */
  refreshShadows(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData['noShadow']) return;
      const material = mesh.material as THREE.Material;
      const flat = (material as THREE.MeshBasicMaterial).isMeshBasicMaterial;
      // 地面の目印など発光ベーシック材質は影を落とさない
      mesh.castShadow = !flat;
      mesh.receiveShadow = true;
    });
    this.lighting.refreshMaterials();
  }

  render(frameDt = 0): void {
    this.shadowRefreshTimer += frameDt;
    if (this.shadowRefreshTimer >= SHADOW_REFRESH_INTERVAL_SECONDS) {
      this.shadowRefreshTimer = 0;
      this.refreshShadows();
    }
    this.lighting.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.lighting.dispose();
    this.renderer.dispose();
  }
}
