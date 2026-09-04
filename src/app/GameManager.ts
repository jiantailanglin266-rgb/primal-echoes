import * as THREE from 'three';
import { GameLoop } from './GameLoop';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { createGroundPlaceholder, createPlayerPlaceholder } from '@presentation/placeholders';
import { DebugOverlay } from '@debug/DebugOverlay';

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * T01 時点では「固定ステップループ + 描画 + デバッグ表示」の配線確認のみ。
 * シーン遷移（Hub / Field / Result）は T14 以降で追加する。
 */
export class GameManager {
  private readonly loop: GameLoop;
  private readonly renderer: SceneRenderer;
  private readonly debug: DebugOverlay | null;

  // T03 で PlayerController に置き換える。ループ動作確認用の一時的な回転体。
  private readonly playerView: THREE.Group;
  private spinAngle = 0;

  constructor(canvas: HTMLCanvasElement, debugRoot: HTMLElement) {
    this.renderer = new SceneRenderer(canvas);
    this.renderer.scene.add(createGroundPlaceholder());

    this.playerView = createPlayerPlaceholder();
    this.renderer.scene.add(this.playerView);

    this.debug = DebugOverlay.isEnabled() ? new DebugOverlay(debugRoot) : null;

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, frameDt) => this.render(alpha, frameDt),
    });

    this.debug?.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  steps ${this.loop.stepCount}`);
    this.debug?.addLine(() => `timeScale ${this.loop.timeScale.toFixed(2)}`);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  private update(dt: number): void {
    const spinSpeed = 0.6;
    this.spinAngle += spinSpeed * dt;
  }

  private render(_alpha: number, frameDt: number): void {
    this.playerView.rotation.y = this.spinAngle;
    this.renderer.render();
    this.debug?.update(frameDt);
  }
}
