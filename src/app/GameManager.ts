import { GameLoop } from './GameLoop';
import { HitStop } from './HitStop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadTitanBlade, loadValgaron, loadVerdantTempest } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import { Field } from '@core/world/Field';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { MonsterAI, type MonsterAIContext } from '@core/monster/MonsterAI';
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
import { createFieldView } from '@presentation/FieldView';
import { DamageNumberView, type ScreenPoint } from '@ui/DamageNumberView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

/**
 * ゲーム全体の起動と各システムの接続を担当する。
 * 入力 -> Player -> MonsterAI（生態 + 戦闘）/ Combat -> CombatResolver -> View / Camera / UI。
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

  readonly field: Field;
  readonly player: Player;
  readonly monster: Monster;
  readonly monsterAI: MonsterAI;
  readonly projectiles: ProjectileManager;
  private readonly combatResolver: CombatResolver;
  private readonly aiContext: MonsterAIContext;

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

    this.field = new Field(loadVerdantTempest());
    this.renderer.scene.add(createFieldView(this.field));
    const terrain = this.field.terrain;

    this.player = new Player(this.balance.player, weapon, terrain);
    const spawn = this.field.def.playerSpawn;
    this.player.controller.teleport(spawn.x, spawn.z);
    this.player.controller.yaw = spawn.yaw;
    this.playerView = new PlayerView(this.player);
    this.renderer.scene.add(this.playerView.object);

    this.projectiles = new ProjectileManager(terrain);
    this.monster = new Monster('valgaron_01', valgaronDef, this.balance.combat, terrain, {
      spawnProjectile: (attack, origin, target) => {
        this.projectiles.spawnArc(
          this.monster.id,
          attack,
          origin,
          target,
          this.balance.player.hurtboxHeight,
          this.monster.totalAttackDamageMultiplier(attack.id),
        );
      },
      onAttackStarted: (attack) => {
        this.events.emit('monsterAttackStarted', { monsterId: this.monster.id, attackId: attack.id, telegraphSeconds: attack.telegraphSeconds });
      },
    });
    const monsterSpawn = this.field.def.monsterSpawns[0];
    if (monsterSpawn) {
      const poi = this.field.getPoi(monsterSpawn.poiId);
      this.monster.teleport(poi.position.x, poi.position.z, monsterSpawn.yaw);
    }
    this.monsterAI = new MonsterAI(this.monster, rng);
    this.aiContext = { field: this.field, subject: { position: this.player.controller.position, isNoisy: false } };
    this.monsterView = new MonsterView(this.monster);
    this.renderer.scene.add(this.monsterView.object);
    this.projectileView = new ProjectileView();
    this.renderer.scene.add(this.projectileView.object);

    this.combatResolver = new CombatResolver(this.events, this.balance.combat, rng);

    this.cameraRig = new CameraRig(this.renderer.camera, terrain, this.balance.camera);
    this.cameraRig.yaw = spawn.yaw;
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
      // 攻撃された = 発見される（寝込みを襲えば起きる）
      this.monsterAI.notifyAttacked(this.player.controller.position);
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
    this.events.on('monsterToppled', (e) => (this.lastHitSummary = `TOPPLED via ${e.partId}`));
    this.events.on('monsterEnraged', () => (this.lastHitSummary = 'ENRAGED!'));
    this.events.on('monsterCalmed', () => (this.lastHitSummary = 'calmed down'));
    this.events.on('monsterExhausted', () => (this.lastHitSummary = 'EXHAUSTED'));
    this.events.on('monsterRecovered', () => (this.lastHitSummary = 'recovered'));
    this.events.on('monsterStateChanged', (e) => (this.lastHitSummary = `AI ${e.from} -> ${e.to}`));
  }

  private setupDebugLines(): void {
    if (!this.debug) return;
    const d = this.debug;
    const { controller, stats, combat } = this.player;
    const m = this.monster;
    const ai = this.monsterAI;
    d.addLine(() => `sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}${this.hitStop.isActive ? ' HITSTOP' : ''}  area ${this.field.areaAt(controller.position)?.name ?? '-'}`);
    d.addLine(() => `move ${controller.state.padEnd(6)} pos ${controller.position.toString()} yaw ${controller.yaw.toFixed(2)}`);
    d.addLine(() => `HP ${stats.hp.toFixed(0)}/${stats.maxHp}  ST ${stats.stamina.toFixed(0)}/${stats.maxStamina}${stats.infiniteStamina ? ' (inf)' : ''}  invuln ${controller.isInvulnerable ? 'YES' : 'no'}`);
    d.addLine(() => {
      const attack = combat.current?.attack.id ?? '-';
      const phase = combat.phase ?? '-';
      const charge = combat.state === 'charging' ? ` charge L${combat.chargeLevel} ${combat.chargeHoldSeconds.toFixed(2)}s` : '';
      return `combat ${combat.state.padEnd(9)} ${attack.padEnd(15)} ${phase}${charge}`;
    });
    d.addLine(() => `--- ${m.def.name} (${m.id})  area ${this.field.areaAt(m.position)?.name ?? '-'} ---`);
    d.addLine(() => `HP ${m.stats.hp.toFixed(0)}/${m.stats.maxHp}  ST ${m.stats.stamina.toFixed(0)}  stun ${m.stats.stunAccumulated.toFixed(0)}  dist ${controller.position.horizontalDistanceTo(m.position).toFixed(1)}m  angle ${m.combat.relativeAngleTo(controller.position).toFixed(2)}  lock ${this.cameraRig.isLockedOn ? 'ON' : 'off'}`);
    d.addLine(() => {
      const goal = ai.state === 'travel' || ai.state === 'flee' || ai.state === 'investigate' ? ` -> ${ai.goalLabel} (${m.position.horizontalDistanceTo(ai.goal).toFixed(0)}m)` : '';
      return `ai ${ai.paused ? 'PAUSED' : ai.state.padEnd(11)} ${ai.stateElapsed.toFixed(1)}s${goal}  seen ${ai.perception.detected ? 'YES' : 'no'}  hunger ${ai.needs.hunger.toFixed(0)} thirst ${ai.needs.thirst.toFixed(0)} fatigue ${ai.needs.fatigue.toFixed(0)}`;
    });
    d.addLine(() => {
      const c = m.combat;
      const attack = c.current?.def.id ?? '-';
      const phase = c.phase ?? (c.isIncapacitated ? `${c.reactionSecondsLeft.toFixed(1)}s` : '-');
      return `m.combat ${c.state.padEnd(9)} ${attack.padEnd(15)} ${phase}`;
    });
    d.addLine(() => {
      const cnd = m.condition;
      const enrage = cnd.isEnraged ? `ENRAGED ${cnd.enrageRemaining.toFixed(0)}s` : `calm (dmg ${cnd.damageSinceCalm.toFixed(0)}/${m.def.enrage.damageToTrigger}${cnd.enrageCooldownRemaining > 0 ? `, cd ${cnd.enrageCooldownRemaining.toFixed(0)}s` : ''})`;
      const tired = cnd.isExhausted ? 'EXHAUSTED' : 'fresh';
      return `condition ${enrage}  ${tired}  speed x${cnd.speedMultiplier.toFixed(2)}`;
    });
    d.addLine(() =>
      m.parts
        .map((p) => `${p.id}:${p.def.breakable ? p.partHp.toFixed(0) : '-'}${p.state === 'broken' ? 'B' : p.state === 'severed' ? 'S' : ''}/f${p.flinchAccumulated.toFixed(0)}`)
        .join(' '),
    );
    d.addLine(() => `last: ${this.lastHitSummary}`);
    d.addLine(() => `pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}  WASD/Shift/Space  J light  K heavy(hold)  Tab lock  F1 heal F2 inf.stamina F3 kill F4 reset F5 AI pause F6 enrage F7 warp to monster`);
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
    this.field.terrain.clampToBounds(this.player.controller.position);

    const controller = this.player.controller;
    this.aiContext.subject.isNoisy = controller.state === 'dash' || this.player.combat.isBusy;
    const stateChange = this.monsterAI.update(dt, this.aiContext);
    if (stateChange) this.events.emit('monsterStateChanged', { monsterId: this.monster.id, from: stateChange.from, to: stateChange.to });

    const condition = this.monster.update(dt, controller.position);
    if (condition.enrageEnded) this.events.emit('monsterCalmed', { monsterId: this.monster.id });
    if (condition.exhaustionStarted) this.events.emit('monsterExhausted', { monsterId: this.monster.id });
    if (condition.exhaustionEnded) this.events.emit('monsterRecovered', { monsterId: this.monster.id });
    this.field.terrain.clampToBounds(this.monster.position, this.monster.def.stats.bodyRadius);
    this.projectiles.update(dt);

    this.combatResolver.resolvePlayerAttacks(this.player, [this.monster]);
    this.combatResolver.resolveMonsterAttacks([this.monster], this.projectiles.projectiles, this.player);

    if (this.cameraRig.isLockedOn) {
      const dist = controller.position.horizontalDistanceTo(this.monster.position);
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
      this.monsterAI.reset();
      this.projectiles.clear();
      this.lastHitSummary = 'monster reset';
    }
    if (input.debugToggleAiPausePressed) this.monsterAI.paused = !this.monsterAI.paused;
    if (input.debugForceEnragePressed) {
      this.monster.forceEnrage();
      this.events.emit('monsterEnraged', { monsterId: this.monster.id });
    }
    if (input.debugWarpToMonsterPressed) {
      const m = this.monster.position;
      const back = this.monster.getForward().scale(-12);
      this.player.controller.teleport(m.x + back.x, m.z + back.z);
    }
  }

  private projectToScreen(world: Vec3, out: ScreenPoint): void {
    const canvas = this.renderer.renderer.domElement;
    this.cameraRig.project(world, out, canvas.clientWidth, canvas.clientHeight);
  }

  private render(alpha: number, frameDt: number): void {
    this.hitStop.update(frameDt);
    this.playerView.sync(alpha);
    const aiState = this.monsterAI.state;
    this.monsterView.ecologyPose = aiState === 'sleep' || aiState === 'eat' || aiState === 'drink' ? aiState : 'none';
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
