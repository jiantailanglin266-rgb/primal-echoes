import * as THREE from 'three';
import { createRenderer, type RenderQuality } from './render/Renderer';
import { Lighting } from './render/Lighting';
import { Environment } from './render/Environment';
import { PostFX } from './render/PostFX';

const SHADOW_REFRESH_INTERVAL_SECONDS = 1.5;

/**
 * Three.js のレンダラ・シーン・カメラ・ライティング・環境の facade。
 * core 層の状態を読んで描画するだけで、シミュレーションには一切書き込まない。
 * 実体は presentation/render/ の各モジュールに分かれている。
 */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly lighting: Lighting;
  readonly environment: Environment;
  readonly postfx: PostFX;
  readonly quality: RenderQuality;

  private readonly resizeObserver: ResizeObserver;
  private shadowRefreshTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    quality: RenderQuality = 'high',
  ) {
    this.quality = quality;
    this.renderer = createRenderer(canvas, quality);
    // three は render() の末尾で info を消すので、フレーム先頭で手動リセットしてデバッグ表示から読めるようにする
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
    this.camera.position.set(0, 4, -8);
    this.camera.lookAt(0, 1, 0);

    this.lighting = new Lighting(this.scene, this.camera, quality);
    this.environment = new Environment(this.renderer, this.scene, this.lighting);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera, quality);

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
    this.postfx.setSize(width, height);
  }

  /**
   * 影のフラグ・CSM・高さフォグを全メッシュへ適用する。
   * View が個別に設定し忘れても揃うように、追加直後と一定間隔で呼ぶ。
   */
  refreshShadows(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!mesh.userData['noShadow']) {
        const flat = (materials[0] as THREE.MeshBasicMaterial | undefined)?.isMeshBasicMaterial;
        // 地面の目印など発光ベーシック材質は影を落とさない
        mesh.castShadow = !flat;
        mesh.receiveShadow = true;
      }
    });
    // CSM（onBeforeCompile を置換するので最初）→ 高さフォグ（連結）の順
    this.lighting.refreshMaterials();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const std = material as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial && std.fog !== false) this.environment.patchMaterial(std);
      }
    });
  }

  render(frameDt = 0): void {
    this.renderer.info.reset();
    this.shadowRefreshTimer += frameDt;
    if (this.shadowRefreshTimer >= SHADOW_REFRESH_INTERVAL_SECONDS) {
      this.shadowRefreshTimer = 0;
      this.refreshShadows();
    }
    this.environment.update(frameDt);
    this.lighting.update();
    if (this.postfx.enabled) this.postfx.render(frameDt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.postfx.dispose();
    this.environment.dispose();
    this.lighting.dispose();
    this.renderer.dispose();
  }
}
