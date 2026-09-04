import { GameLoop } from './GameLoop';
import { HitStop } from './HitStop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadDevTerrain, loadTitanBlade, loadValgaron } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import { ProceduralTerrain } from '@core/world/Terrain';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { MonsterAI } from '@core/monster/MonsterAI';
import type { MonsterHitbox } from '@core/monster/MonsterCombat';
import { CombatResolver } from '@core/combat/CombatResolver';
import { ProjectileManager } from '@core/combat/Projectile';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { KeyboardMouseInput } from '@input/KeyboardMouseInput';
import type { InputState } from '@input/InputState';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { CameraRig } from '@presentation/CameraRig';
import { PlayerView } from '@presentation/PlayerView';
import { MonsterView } from '@presentation/MonsterView';
import { ProjectileView } from '@presentation/ProjectileView';
import { HitboxDebugView, type DebugSphere } from '@presentation/HitboxDebugView';
import { createTerrainView } from '@presentation/TerrainView';
import { DamageNumberView, type ScreenPoint } from '@ui/DamageNumberView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

/** ダミー配置。フィールド定義（T12）ができるまでの固定値。 */
const DEV_MONSTER_SPAWN = { x: 0, z: 16, yaw: Math.PI };

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * Phase 2〜3: 入力 -> Player -> MonsterAI/Combat -> CombatResolver -> View / Camera / UI。
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
  readonly monsterAI: MonsterAI;
  readonly projectiles: ProjectileManager;
  private readonly combatResolver: CombatResolver;

  private readonly playerView: PlayerView;
  private readonly monsterView: MonsterView;
  private readonly projectileView: ProjectileView;
  private readonly hitboxDebugView: HitboxDebugView | null;
  private readonly cameraRig: CameraRig;
  private readonly damageNumbers: DamageNumberView;

  private readonly intent: PlayerIntent = createEmptyIntent();
  private readonly cameraForward = new Vec3();
  private readonly cameraRight = new Vec3();
  private readonly playerHitboxes: WorldHitbox[] = [];
  private readonly monsterHitboxes: MonsterHitbox[] = [];
  private readonly projectileSpheres: DebugSphere[] = [];
  private readonly lockOnPoint = new Vec3();
  private lastHitSummary = '-';

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement, debugRoot: HTMLElement) {
    this.balance = loadBalance();
    const weapon = loadTitanBlade();
    const valgaronDef = loadValgaron();
    const rng = new Random(0xc0ffee);

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.terrain = new ProceduralTerrain(loadDevTerrain());
    this.renderer.scene.add(createTerrainView(this.terrain));

    this.player = new Player(this.balance.player, weapon, this.terrain);
    this.playerView = new PlayerView(this.player);
    this.renderer.scene.add(this.playerView.object);

    this.projectiles = new ProjectileManager(this.terrain);
    this.monster = new Monster('valgaron_01', valgaronDef, this.balance.combat, this.terrain, {
      spawnProjectile: (attack, origin, target) => {
        this.projectiles.spawnArc(this.monster.id, attack, origin, target, this.balance.player.hurtboxHeight);
      },
      onAttackStarted: (attack) => {
        this.events.emit('monsterAttackStarted', { monsterId: this.monster.id, attackId: attack.id, telegraphSeconds: attack.telegraphSeconds });
      },
    });
    this.monster.teleport(DEV_MONSTER_SPAWN.x, DEV_MONSTER_SPAWN.z, DEV_MONSTER_SPAWN.yaw);
    this.monsterAI = new MonsterAI(this.monster, rng);
    this.monsterView = new MonsterView(this.monster);
    this.renderer.scene.add(this.monsterView.object);
    this.projectileView = new ProjectileView();
    this.renderer.scene.add(this.projectileView.object);

    this.combatResolver = new CombatResolver(this.events, this.balance.combat, rng);

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
      this.lastHitSummary = `PART BROKEN: ${this.monster.getPart(e.partId).def.name}`;
    });
    this.events.on('partSevered', (e) => {
      this.lastHitSummary = `PART SEVERED: ${this.monster.getPart(e.partId).def.name}`;
    });
    this.events.on('monsterDied', () => {
      this.cameraRig.setLockOnTarget(null);
      this.lastHitSummary = 'MONSTER DOWN';
    });
    this.events.on('playerHit', (e) => {
      this.damageNumbers.spawn(e.position, e.damage, { player: true });
      this.lastHitSummary = `PLAYER HIT by ${e.attackId}: -${e.damage}`;
    });
    this.events.on('playerDowned', () => {
      this.lastHitSummary = 'PLAYER DOWNED (F1 to revive)';
    });
  }

  private setupDebugLines(): void {
    if (!this.debug) return;
    const d = this.debug;
    const { controller, stats, combat } = this.player;
    const m = this.monster;
    d.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}${this.hitStop.isActive ? ' HITSTOP' : ''}`);
    d.addLine(() => `move ${controller.state.padEnd(6)} pos ${controller.position.toString()} yaw ${controller.yaw.toFixed(2)}`);
    d.addLine(() => `HP ${stats.hp.toFixed(0)}/${stats.maxHp}  ST ${stats.stamina.toFixed(0)}/${stats.maxStamina}${stats.infiniteStamina ? ' (inf)' : ''}  invuln ${controller.isInvulnerable ? 'YES' : 'no'}`);
    d.addLine(() => {
      const attack = combat.current?.attack.id ?? '-';
      const phase = combat.phase ?? '-';
      const charge = combat.state === 'charging' ? ` charge L${combat.chargeLevel} ${combat.chargeHoldSeconds.toFixed(2)}s` : '';
      return `combat ${combat.state.padEnd(9)} ${attack.padEnd(15)} ${phase}${charge}`;
    });
    d.addLine(() => `--- ${m.def.name} (${m.id}) ---`);
    d.addLine(() => `HP ${m.stats.hp.toFixed(0)}/${m.stats.maxHp}  ST ${m.stats.stamina.toFixed(0)}  stun ${m.stats.stunAccumulated.toFixed(0)}  dist ${controller.position.horizontalDistanceTo(m.position).toFixed(1)}m  angle ${m.combat.relativeAngleTo(controller.position).toFixed(2)}  lock ${this.cameraRig.isLockedOn ? 'ON' : 'off'}`);
    d.addLine(() => {
      const c = m.combat;
      const attack = c.current?.def.id ?? '-';
      const phase = c.phase ?? (c.isIncapacitated ? `${c.reactionSecondsLeft.toFixed(1)}s` : '-');
      return `m.combat ${c.state.padEnd(9)} ${attack.padEnd(15)} ${phase}  ai ${this.monsterAI.paused ? 'PAUSED' : this.monsterAI.mode}`;
    });
    d.addLine(() =>
      m.parts
        .map((p) => `${p.id}:${p.def.breakable ? p.partHp.toFixed(0) : '-'}${p.state === 'broken' ? 'B' : p.state === 'severed' ? 'S' : ''}/f${p.flinchAccumulated.toFixed(0)}`)
        .join(' '),
    );
    d.addLine(() => `last: ${this.lastHitSummary}`);
    d.addLine(() => `pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}  WASD/Shift/Space  J light  K heavy(hold)  Tab lock  F1 heal F2 inf.stamina F3 kill F4 reset F5 AI pause`);
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

    const playerPos = this.player.controller.position;
    this.monsterAI.update(dt, playerPos);
    this.monster.update(dt, playerPos);
    this.terrain.clampToBounds(this.monster.position, this.monster.def.stats.bodyRadius);
    this.projectiles.update(dt);

    this.combatResolver.resolvePlayerAttacks(this.player, [this.monster]);
    this.combatResolver.resolveMonsterAttacks([this.monster], this.projectiles.projectiles, this.player);

    if (this.cameraRig.isLockedOn) {
      const dist = playerPos.horizontalDistanceTo(this.monster.position);
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
    if (input.debugHealPlayerPressed) {
      this.player.stats.fullRestore();
      if (this.player.isDowned) this.player.controller.revive();
    }
    if (input.debugToggleInfiniteStaminaPressed) this.player.stats.infiniteStamina = !this.player.stats.infiniteStamina;
    if (input.debugKillMonsterPressed && this.monster.isAlive) {
      this.monster.stats.takeDamage(this.monster.stats.hp);
      this.monster.combat.reset();
      this.events.emit('monsterDied', { monsterId: this.monster.id });
    }
    if (input.debugResetMonsterPressed) {
      this.monster.reset();
      this.projectiles.clear();
      this.lastHitSummary = 'monster reset';
    }
    if (input.debugToggleAiPausePressed) this.monsterAI.paused = !this.monsterAI.paused;
  }

  private projectToScreen(world: Vec3, out: ScreenPoint): void {
    const canvas = this.renderer.renderer.domElement;
    this.cameraRig.project(world, out, canvas.clientWidth, canvas.clientHeight);
  }

  private render(alpha: number, frameDt: number): void {
    this.hitStop.update(frameDt);
    this.playerView.sync(alpha);
    this.monsterView.sync(alpha, frameDt);
    this.projectileView.sync(this.projectiles.projectiles, alpha);
    if (this.hitboxDebugView) {
      const { controller, combat } = this.player;
      combat.getActiveHitboxes(controller.position, controller.yaw, this.playerHitboxes);
      this.monster.combat.getActiveHitboxes(this.monsterHitboxes);
      this.projectileSpheres.length = 0;
      for (const p of this.projectiles.projectiles) {
        if (p.alive) this.projectileSpheres.push({ center: p.position, radius: p.radius });
      }
      this.hitboxDebugView.begin();
      this.hitboxDebugView.add(this.playerHitboxes, 'player');
      this.hitboxDebugView.add(this.monsterHitboxes, 'monster');
      this.hitboxDebugView.add(this.projectileSpheres, 'projectile');
      this.hitboxDebugView.end();
    }
    this.cameraRig.update(this.playerView.renderPosition, frameDt);
    this.renderer.render();
    this.damageNumbers.update(frameDt);
    this.debug?.update(frameDt);
  }
}
