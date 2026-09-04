import { GameLoop } from './GameLoop';
import { HitStop } from './HitStop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadDevTerrain, loadTitanBlade, loadValgaron } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import { ProceduralTerrain } from '@core/world/Terrain';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { CombatResolver } from '@core/combat/CombatResolver';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { KeyboardMouseInput } from '@input/KeyboardMouseInput';
import type { InputState } from '@input/InputState';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { CameraRig } from '@presentation/CameraRig';
import { PlayerView } from '@presentation/PlayerView';
import { MonsterView } from '@presentation/MonsterView';
import { HitboxDebugView } from '@presentation/HitboxDebugView';
import { createTerrainView } from '@presentation/TerrainView';
import { DamageNumberView, type ScreenPoint } from '@ui/DamageNumberView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

/** ダミー配置。フィールド定義（T12）ができるまでの固定値。 */
const DEV_MONSTER_SPAWN = { x: 0, z: 14, yaw: Math.PI };

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * Phase 2: 入力 -> Player -> CombatResolver -> Monster -> View / Camera / UI。
 * シーン遷移（Hub / Field / Result）は T14 以降で追加する。
 */
export class GameManager {
  private readonly balance: BalanceData;
  /** 公開しているのはデバッグ用（コンソールから advance() を手動で回して検証するため）。 */
  readonly loop: GameLoop;
  readonly events = new EventBus<GameEvents>();
  private readonly renderer: SceneRenderer;
  private readonly input: KeyboardMouseInput;
  private readonly debug: DebugOverlay | null;
  private readonly hitStop: HitStop;

  private readonly terrain: ProceduralTerrain;
  readonly player: Player;
  readonly monster: Monster;
  private readonly combatResolver: CombatResolver;

  private readonly playerView: PlayerView;
  private readonly monsterView: MonsterView;
  private readonly hitboxDebugView: HitboxDebugView | null;
  private readonly cameraRig: CameraRig;
  private readonly damageNumbers: DamageNumberView;

  private readonly intent: PlayerIntent = createEmptyIntent();
  private readonly cameraForward = new Vec3();
  private readonly cameraRight = new Vec3();
  private readonly activeHitboxes: WorldHitbox[] = [];
  private readonly lockOnPoint = new Vec3();
  private lastHitSummary = '-';

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, debugRoot: HTMLElement) {
    this.balance = loadBalance();
    const weapon = loadTitanBlade();
    const valgaronDef = loadValgaron();

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.terrain = new ProceduralTerrain(loadDevTerrain());
    this.renderer.scene.add(createTerrainView(this.terrain));

    this.player = new Player(this.balance.player, weapon, this.terrain);
    this.playerView = new PlayerView(this.player);
    this.renderer.scene.add(this.playerView.object);

    this.monster = new Monster('valgaron_01', valgaronDef, this.balance.combat);
    this.monster.teleport(
      DEV_MONSTER_SPAWN.x,
      this.terrain.getHeight(DEV_MONSTER_SPAWN.x, DEV_MONSTER_SPAWN.z),
      DEV_MONSTER_SPAWN.z,
      DEV_MONSTER_SPAWN.yaw,
    );
    this.monsterView = new MonsterView(this.monster);
    this.renderer.scene.add(this.monsterView.object);

    this.combatResolver = new CombatResolver(this.events, this.balance.combat, new Random(0xc0ffee));

    this.cameraRig = new CameraRig(this.renderer.camera, this.terrain, this.balance.camera);
    this.damageNumbers = new DamageNumberView(uiRoot, (world, out) => this.projectToScreen(world, out));

    const debugEnabled = DebugOverlay.isEnabled();
    this.debug = debugEnabled ? new DebugOverlay(debugRoot) : null;
    this.hitboxDebugView = debugEnabled ? new HitboxDebugView() : null;
    if (this.hitboxDebugView) this.renderer.scene.add(this.hitboxDebugView.object);
    this.setupDebugLines();

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, frameDt) => this.render(alpha, frameDt),
    });
    this.hitStop = new HitStop(this.loop);
    this.subscribeEvents();
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.detach();
  }

  private subscribeEvents(): void {
    this.events.on('hit', (e) => {
      this.hitStop.trigger(e.hitStopSeconds);
      this.monsterView.flashPart(e.partId);
      this.damageNumbers.spawn(e.position, e.result.total, { critical: e.result.isCritical });
      this.lastHitSummary = `${e.partId} ${e.result.total}${e.result.isCritical ? ' CRIT' : ''} (part ${e.result.partDamage.toFixed(0)})`;
    });
    this.events.on('partBroken', (e) => {
      const part = this.monster.getPart(e.partId);
      this.damageNumbers.spawn(this.monster.position, 0, { partBroken: true });
      this.lastHitSummary = `PART BROKEN: ${part.def.name}`;
    });
    this.events.on('partSevered', (e) => {
      this.lastHitSummary = `PART SEVERED: ${this.monster.getPart(e.partId).def.name}`;
    });
    this.events.on('monsterDied', () => {
      this.cameraRig.setLockOnTarget(null);
      this.lastHitSummary = 'MONSTER DOWN';
    });
  }

  private setupDebugLines(): void {
    if (!this.debug) return;
    const d = this.debug;
    const { controller, stats, combat } = this.player;
    const m = this.monster;
    d.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}${this.hitStop.isActive ? ' HITSTOP' : ''}`);
    d.addLine(() => `move ${controller.state.padEnd(5)} pos ${controller.position.toString()} yaw ${controller.yaw.toFixed(2)}`);
    d.addLine(() => `HP ${stats.hp.toFixed(0)}/${stats.maxHp}  ST ${stats.stamina.toFixed(0)}/${stats.maxStamina}${stats.infiniteStamina ? ' (inf)' : ''}  invuln ${controller.isInvulnerable ? 'YES' : 'no'}`);
    d.addLine(() => {
      const attack = combat.current?.attack.id ?? '-';
      const phase = combat.phase ?? '-';
      const charge = combat.state === 'charging' ? ` charge L${combat.chargeLevel} ${combat.chargeHoldSeconds.toFixed(2)}s` : '';
      return `combat ${combat.state.padEnd(9)} ${attack.padEnd(15)} ${phase}${charge}`;
    });
    d.addLine(() => `--- ${m.def.name} (${m.id}) ---`);
    d.addLine(() => `HP ${m.stats.hp.toFixed(0)}/${m.stats.maxHp}  stun ${m.stats.stunAccumulated.toFixed(0)}  dist ${controller.position.horizontalDistanceTo(m.position).toFixed(1)}m  lock ${this.cameraRig.isLockedOn ? 'ON' : 'off'}`);
    d.addLine(() =>
      m.parts
        .map((p) => `${p.id}:${p.def.breakable ? p.partHp.toFixed(0) : '-'}${p.state === 'broken' ? 'B' : p.state === 'severed' ? 'S' : ''}/f${p.flinchAccumulated.toFixed(0)}`)
        .join(' '),
    );
    d.addLine(() => `last hit: ${this.lastHitSummary}`);
    d.addLine(() => `pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}  WASD/Shift/Space  J light  K heavy(hold)  Tab lock  F1 heal F2 inf.stamina F3 kill F4 reset`);
  }

  private update(dt: number): void {
    const input = this.input.poll();
    // カメラ回転はシミュレーションではなく入力処理なので、timeScale=0 の Hit Stop 中でも動かす
    this.cameraRig.applyLook(input.lookDeltaX, input.lookDeltaY);
    if (input.lockOnPressed) this.toggleLockOn();
    if (this.debug) this.handleDebugInput(input);

    this.cameraRig.getForwardXZ(this.cameraForward);
    this.cameraRig.getRightXZ(this.cameraRight);
    buildPlayerIntent(input, this.cameraForward, this.cameraRight, this.intent);

    this.player.update(this.intent, dt);
    this.terrain.clampToBounds(this.player.controller.position);

    this.monster.update(dt);
    this.combatResolver.resolvePlayerAttacks(this.player, [this.monster]);

    if (this.cameraRig.isLockedOn) {
      const dist = this.player.controller.position.horizontalDistanceTo(this.monster.position);
      if (dist > this.balance.camera.lockOnMaxDistance || !this.monster.isAlive) this.cameraRig.setLockOnTarget(null);
    }
  }

  private toggleLockOn(): void {
    if (this.cameraRig.isLockedOn) {
      this.cameraRig.setLockOnTarget(null);
      return;
    }
    if (!this.monster.isAlive) return;
    const dist = this.player.controller.position.horizontalDistanceTo(this.monster.position);
    if (dist > this.balance.camera.lockOnMaxDistance) return;
    this.cameraRig.setLockOnTarget(() => {
      const m = this.monster;
      const head = m.def.parts.find((p) => p.id === 'head');
      const height = head && head.shape.type === 'sphere' ? head.shape.offset.y : m.def.stats.bodyRadius;
      return this.lockOnPoint.set(m.position.x, m.position.y + height, m.position.z);
    });
  }

  private handleDebugInput(input: InputState): void {
    if (input.debugHealPlayerPressed) this.player.stats.fullRestore();
    if (input.debugToggleInfiniteStaminaPressed) this.player.stats.infiniteStamina = !this.player.stats.infiniteStamina;
    if (input.debugKillMonsterPressed && this.monster.isAlive) {
      this.monster.stats.takeDamage(this.monster.stats.hp);
      this.events.emit('monsterDied', { monsterId: this.monster.id });
    }
    if (input.debugResetMonsterPressed) {
      this.monster.reset();
      this.lastHitSummary = 'monster reset';
    }
  }

  private projectToScreen(world: Vec3, out: ScreenPoint): void {
    const canvas = this.renderer.renderer.domElement;
    this.cameraRig.project(world, out, canvas.clientWidth, canvas.clientHeight);
  }

  private render(alpha: number, frameDt: number): void {
    this.hitStop.update(frameDt);
    this.playerView.sync(alpha);
    this.monsterView.sync(alpha, frameDt);
    if (this.hitboxDebugView) {
      const { controller, combat } = this.player;
      combat.getActiveHitboxes(controller.position, controller.yaw, this.activeHitboxes);
      this.hitboxDebugView.sync(this.activeHitboxes);
    }
    this.cameraRig.update(this.playerView.renderPosition, frameDt);
    this.renderer.render();
    this.damageNumbers.update(frameDt);
    this.debug?.update(frameDt);
  }
}
