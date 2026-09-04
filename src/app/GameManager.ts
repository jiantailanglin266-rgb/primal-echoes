import { GameLoop } from './GameLoop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadDevTerrain } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import { ProceduralTerrain } from '@core/world/Terrain';
import { PlayerStats } from '@core/player/PlayerStats';
import { PlayerController } from '@core/player/PlayerController';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import { KeyboardMouseInput } from '@input/KeyboardMouseInput';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { CameraRig } from '@presentation/CameraRig';
import { PlayerView } from '@presentation/PlayerView';
import { createTerrainView } from '@presentation/TerrainView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { Vec3 } from '@shared/math/Vec3';

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * Phase 1: 入力 -> PlayerController -> View / Camera の配線。
 * シーン遷移（Hub / Field / Result）は T14 以降で追加する。
 */
export class GameManager {
  private readonly balance: BalanceData;
  /** 公開しているのはデバッグ用（コンソールから advance() を手動で回して検証するため）。 */
  readonly loop: GameLoop;
  private readonly renderer: SceneRenderer;
  private readonly input: KeyboardMouseInput;
  private readonly debug: DebugOverlay | null;

  private readonly terrain: ProceduralTerrain;
  private readonly player: PlayerController;
  private readonly playerView: PlayerView;
  private readonly cameraRig: CameraRig;

  private readonly intent: PlayerIntent = createEmptyIntent();
  private readonly cameraForward = new Vec3();
  private readonly cameraRight = new Vec3();

  constructor(canvas: HTMLCanvasElement, debugRoot: HTMLElement) {
    this.balance = loadBalance();

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.terrain = new ProceduralTerrain(loadDevTerrain());
    this.renderer.scene.add(createTerrainView(this.terrain));

    this.player = new PlayerController(new PlayerStats(this.balance.player), this.terrain, this.balance.player);
    this.playerView = new PlayerView(this.player);
    this.renderer.scene.add(this.playerView.object);

    this.cameraRig = new CameraRig(this.renderer.camera, this.terrain, this.balance.camera);

    this.debug = DebugOverlay.isEnabled() ? new DebugOverlay(debugRoot) : null;
    this.setupDebugLines();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, frameDt) => this.render(alpha, frameDt),
    });
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.detach();
  }

  private setupDebugLines(): void {
    if (!this.debug) return;
    const d = this.debug;
    const p = this.player;
    d.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}`);
    d.addLine(() => `player ${p.state.padEnd(5)} pos ${p.position.toString()} yaw ${p.yaw.toFixed(2)}`);
    d.addLine(() => `HP ${p.stats.hp.toFixed(0)}/${p.stats.maxHp}  ST ${p.stats.stamina.toFixed(0)}/${p.stats.maxStamina}`);
    d.addLine(() => `invuln ${p.isInvulnerable ? 'YES' : 'no '}  pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}`);
  }

  private update(dt: number): void {
    const input = this.input.poll();
    // カメラ回転はシミュレーションではなく入力処理なので、timeScale=0 の Hit Stop 中でも動かす
    this.cameraRig.applyLook(input.lookDeltaX, input.lookDeltaY);

    this.cameraRig.getForwardXZ(this.cameraForward);
    this.cameraRig.getRightXZ(this.cameraRight);
    buildPlayerIntent(input, this.cameraForward, this.cameraRight, this.intent);

    this.player.update(this.intent, dt);
    this.terrain.clampToBounds(this.player.position);
    this.player.stats.update(dt);
  }

  private render(alpha: number, frameDt: number): void {
    this.playerView.sync(alpha);
    this.cameraRig.update(this.playerView.renderPosition, frameDt);
    this.renderer.render();
    this.debug?.update(frameDt);
  }
}
