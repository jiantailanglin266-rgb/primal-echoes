import { GameLoop } from './GameLoop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadDevTerrain, loadTitanBlade } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import { ProceduralTerrain } from '@core/world/Terrain';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { KeyboardMouseInput } from '@input/KeyboardMouseInput';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { CameraRig } from '@presentation/CameraRig';
import { PlayerView } from '@presentation/PlayerView';
import { HitboxDebugView } from '@presentation/HitboxDebugView';
import { createTerrainView } from '@presentation/TerrainView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { Vec3 } from '@shared/math/Vec3';

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * Phase 1: 入力 -> Player（移動 + 攻撃）-> View / Camera の配線。
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
  readonly player: Player;
  private readonly playerView: PlayerView;
  private readonly hitboxDebugView: HitboxDebugView | null;
  private readonly cameraRig: CameraRig;

  private readonly intent: PlayerIntent = createEmptyIntent();
  private readonly cameraForward = new Vec3();
  private readonly cameraRight = new Vec3();
  private readonly activeHitboxes: WorldHitbox[] = [];

  constructor(canvas: HTMLCanvasElement, debugRoot: HTMLElement) {
    this.balance = loadBalance();
    const weapon = loadTitanBlade();

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.terrain = new ProceduralTerrain(loadDevTerrain());
    this.renderer.scene.add(createTerrainView(this.terrain));

    this.player = new Player(this.balance.player, weapon, this.terrain);
    this.playerView = new PlayerView(this.player);
    this.renderer.scene.add(this.playerView.object);

    this.cameraRig = new CameraRig(this.renderer.camera, this.terrain, this.balance.camera);

    const debugEnabled = DebugOverlay.isEnabled();
    this.debug = debugEnabled ? new DebugOverlay(debugRoot) : null;
    this.hitboxDebugView = debugEnabled ? new HitboxDebugView() : null;
    if (this.hitboxDebugView) this.renderer.scene.add(this.hitboxDebugView.object);
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
    const { controller, stats, combat } = this.player;
    d.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}`);
    d.addLine(() => `move ${controller.state.padEnd(5)} pos ${controller.position.toString()} yaw ${controller.yaw.toFixed(2)}`);
    d.addLine(() => `HP ${stats.hp.toFixed(0)}/${stats.maxHp}  ST ${stats.stamina.toFixed(0)}/${stats.maxStamina}  invuln ${controller.isInvulnerable ? 'YES' : 'no'}`);
    d.addLine(() => {
      const attack = combat.current?.attack.id ?? '-';
      const phase = combat.phase ?? '-';
      const charge = combat.state === 'charging' ? ` charge L${combat.chargeLevel} ${combat.chargeHoldSeconds.toFixed(2)}s` : '';
      return `combat ${combat.state.padEnd(9)} ${attack.padEnd(15)} ${phase}${charge}`;
    });
    d.addLine(() => `pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}  keys: WASD move / Shift dash / Space dodge / J light / K heavy(hold=charge)`);
  }

  private update(dt: number): void {
    const input = this.input.poll();
    // カメラ回転はシミュレーションではなく入力処理なので、timeScale=0 の Hit Stop 中でも動かす
    this.cameraRig.applyLook(input.lookDeltaX, input.lookDeltaY);

    this.cameraRig.getForwardXZ(this.cameraForward);
    this.cameraRig.getRightXZ(this.cameraRight);
    buildPlayerIntent(input, this.cameraForward, this.cameraRight, this.intent);

    this.player.update(this.intent, dt);
    this.terrain.clampToBounds(this.player.controller.position);
  }

  private render(alpha: number, frameDt: number): void {
    this.playerView.sync(alpha);
    if (this.hitboxDebugView) {
      const { controller, combat } = this.player;
      combat.getActiveHitboxes(controller.position, controller.yaw, this.activeHitboxes);
      this.hitboxDebugView.sync(this.activeHitboxes);
    }
    this.cameraRig.update(this.playerView.renderPosition, frameDt);
    this.renderer.render();
    this.debug?.update(frameDt);
  }
}
