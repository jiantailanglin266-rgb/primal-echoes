import { GameLoop } from './GameLoop';
import { HitStop } from './HitStop';
import { buildPlayerIntent } from './intentBuilder';
import { loadBalance, loadCreatures, loadQuests, loadTitanBlade, loadValgaron, loadVerdantTempest } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import type { QuestDefinition } from '@data/schemas/quest';
import { Field } from '@core/world/Field';
import { Player } from '@core/player/Player';
import { createEmptyIntent, type PlayerIntent } from '@core/player/PlayerIntent';
import { Monster } from '@core/monster/Monster';
import { MonsterAI, type MonsterAIContext } from '@core/monster/MonsterAI';
import type { MonsterHitbox } from '@core/monster/MonsterCombat';
import { CombatResolver } from '@core/combat/CombatResolver';
import { ProjectileManager } from '@core/combat/Projectile';
import type { WorldHitbox } from '@core/combat/PlayerCombat';
import { EcosystemManager, type EcosystemUpdateContext } from '@core/ecosystem/EcosystemManager';
import { QuestManager } from '@core/quest/QuestManager';
import { KeyboardMouseInput } from '@input/KeyboardMouseInput';
import type { InputState } from '@input/InputState';
import { SceneRenderer } from '@presentation/SceneRenderer';
import { CameraRig } from '@presentation/CameraRig';
import { PlayerView } from '@presentation/PlayerView';
import { MonsterView } from '@presentation/MonsterView';
import { ProjectileView } from '@presentation/ProjectileView';
import { EcosystemView } from '@presentation/EcosystemView';
import { HitboxDebugView, type DebugSphere } from '@presentation/HitboxDebugView';
import { createFieldView } from '@presentation/FieldView';
import { DamageNumberView, type ScreenPoint } from '@ui/DamageNumberView';
import { HudView, createHudModel } from '@ui/HudView';
import { HubView } from '@ui/HubView';
import { ResultView } from '@ui/ResultView';
import { DebugOverlay } from '@debug/DebugOverlay';
import { EventBus } from '@shared/events/EventBus';
import type { GameEvents } from '@shared/events/GameEvents';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

export type GameScene = 'hub' | 'field' | 'result';

const SHARPNESS_LABELS = { dull: '斬れ味: 鈍', normal: '斬れ味: 並', sharp: '斬れ味: 鋭', keen: '斬れ味: 冴' } as const;
const FAIL_REASON_LABELS = { timeLimit: '制限時間切れ', downs: '規定回数の戦闘不能', none: '任務を中断した' } as const;

/**
 * ゲーム全体の起動・シーン遷移・各システムの接続を担当する。
 *
 *   hub（拠点: クエスト受注）-> field（探索・戦闘）-> result（成果）-> hub ...
 *
 * フィールドは常駐させ、hub / result は DOM パネルで覆う（VS0.1 ではロードを挟まない）。
 * シミュレーションは field シーンでだけ進む。
 */
export class GameManager {
  private readonly balance: BalanceData;
  /** 公開しているのはデバッグ用（コンソールから advance() を手動で回して検証するため）。 */
  readonly loop: GameLoop;
  readonly events = new EventBus<GameEvents>();
  scene: GameScene = 'hub';

  private readonly renderer: SceneRenderer;
  private readonly input: KeyboardMouseInput;
  private readonly debug: DebugOverlay | null;
  private readonly hitStop: HitStop;

  readonly field: Field;
  readonly player: Player;
  readonly monster: Monster;
  readonly monsterAI: MonsterAI;
  readonly projectiles: ProjectileManager;
  readonly ecosystem: EcosystemManager;
  readonly quests: QuestDefinition[];
  quest: QuestManager | null = null;
  private readonly combatResolver: CombatResolver;
  private readonly aiContext: MonsterAIContext;
  private readonly ecosystemContext: EcosystemUpdateContext;

  private readonly playerView: PlayerView;
  private readonly monsterView: MonsterView;
  private readonly projectileView: ProjectileView;
  private readonly ecosystemView: EcosystemView;
  private readonly hitboxDebugView: HitboxDebugView | null;
  private readonly cameraRig: CameraRig;
  private readonly damageNumbers: DamageNumberView;
  private readonly hud: HudView;
  private readonly hudModel = createHudModel();
  private readonly hubView: HubView;
  private readonly resultView: ResultView;

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
    this.quests = loadQuests();
    const rng = new Random(0xc0ffee);

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.field = new Field(loadVerdantTempest());
    this.renderer.scene.add(createFieldView(this.field));
    const terrain = this.field.terrain;

    this.player = new Player(this.balance.player, weapon, terrain);
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
    this.monsterView = new MonsterView(this.monster);
    this.renderer.scene.add(this.monsterView.object);
    this.projectileView = new ProjectileView();
    this.renderer.scene.add(this.projectileView.object);

    this.ecosystem = new EcosystemManager(this.field, loadCreatures(), rng, {
      creatureKilled: (creature, cause) => {
        this.events.emit('creatureKilled', { creatureId: creature.id, creatureDefId: creature.def.id, position: creature.position.clone(), cause });
      },
      carcassSpawned: (carcass) => {
        this.events.emit('carcassSpawned', { carcassId: carcass.id, sourceId: carcass.sourceId, position: carcass.position.clone() });
      },
    });
    this.ecosystem.spawnAll();
    this.ecosystemView = new EcosystemView(this.ecosystem);
    this.renderer.scene.add(this.ecosystemView.object);

    this.monsterAI = new MonsterAI(this.monster, rng);
    this.aiContext = { field: this.field, subject: { position: this.player.controller.position, isNoisy: false }, prey: this.ecosystem };
    this.ecosystemContext = { player: this.aiContext.subject, monsters: [this.monster] };

    this.combatResolver = new CombatResolver(this.events, this.balance.combat, rng);

    this.cameraRig = new CameraRig(this.renderer.camera, terrain, this.balance.camera);
    this.damageNumbers = new DamageNumberView(uiRoot, (world, out) => this.projectToScreen(world, out));
    this.hud = new HudView(uiRoot);
    this.hubView = new HubView(uiRoot);
    this.resultView = new ResultView(uiRoot);
    this.hubView.onStartQuest = (quest) => this.startQuest(quest);
    this.resultView.onReturn = () => this.enterHub();

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

    this.placeWorldForHub();
    this.enterHub();
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.detach();
  }

  // ---------------- scene flow ----------------

  enterHub(): void {
    this.setScene('hub');
    this.quest = null;
    this.hubView.render({
      playerName: 'レンジャー',
      weaponName: this.player.combat.weapon.name,
      weaponPower: this.player.combat.weapon.weaponPower,
      maxHp: this.player.stats.maxHp,
      quests: this.quests,
      inventoryLines: [],
      craftingLines: [],
    });
  }

  startQuest(def: QuestDefinition): void {
    this.resetWorldForQuest();
    this.quest = new QuestManager(def, this.balance.quest);
    this.quest.start();
    this.setScene('field');
    this.events.emit('questStarted', { questId: def.id });
  }

  private finishQuest(): void {
    const quest = this.quest;
    if (!quest) return;
    const success = quest.state === 'completed';
    if (success) this.events.emit('questCompleted', { questId: quest.def.id, clearTimeSeconds: quest.clearTimeSeconds });
    else this.events.emit('questFailed', { questId: quest.def.id, reason: quest.failReason ?? 'none' });

    this.resultView.render({
      success,
      questName: quest.def.name,
      failReason: FAIL_REASON_LABELS[quest.failReason ?? 'none'],
      clearTimeSeconds: quest.clearTimeSeconds,
      downs: quest.downs,
      brokenParts: quest.brokenPartIds.map((id) => this.monster.getPart(id).def.name),
      rewardLines: [],
    });
    this.setScene('result');
  }

  private setScene(scene: GameScene): void {
    this.scene = scene;
    this.hud.visible = scene === 'field';
    this.hubView.visible = scene === 'hub';
    this.resultView.visible = scene === 'result';
    this.cameraRig.setLockOnTarget(null);
    this.loop.timeScale = 1;
    if (scene !== 'field' && document.pointerLockElement) document.exitPointerLock();
    this.events.emit('sceneChanged', { scene });
  }

  /** 拠点画面の背景: プレイヤーはキャンプに立ち、カメラは初期向き。 */
  private placeWorldForHub(): void {
    const spawn = this.field.def.playerSpawn;
    this.player.controller.teleport(spawn.x, spawn.z);
    this.player.controller.yaw = spawn.yaw;
    this.cameraRig.yaw = spawn.yaw;
  }

  private resetWorldForQuest(): void {
    this.placeWorldForHub();
    this.player.stats.fullRestore();
    if (this.player.isDowned) this.player.controller.revive();
    this.player.combat.cancel();

    this.monster.reset();
    this.monsterAI.reset();
    const monsterSpawn = this.field.def.monsterSpawns[0];
    if (monsterSpawn) {
      const poi = this.field.getPoi(monsterSpawn.poiId);
      this.monster.teleport(poi.position.x, poi.position.z, monsterSpawn.yaw);
    }
    this.projectiles.clear();
    this.ecosystem.reset();
    this.lastHitSummary = 'quest start';
  }

  private respawnPlayer(): void {
    const spawn = this.field.def.playerSpawn;
    this.player.stats.fullRestore();
    this.player.controller.revive();
    this.player.controller.teleport(spawn.x, spawn.z);
    this.events.emit('playerRespawned', { position: this.player.controller.position.clone() });
    // 復帰したら見失わせる（キャンプまで追ってこない）
    this.monsterAI.perception.forget();
  }

  // ---------------- events ----------------

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
      this.quest?.notifyPartBroken(e.partId);
    });
    this.events.on('partSevered', (e) => {
      this.lastHitSummary = `PART SEVERED: ${this.monster.getPart(e.partId).def.name}`;
      this.quest?.notifyPartBroken(e.partId);
    });
    this.events.on('monsterDied', () => {
      this.cameraRig.setLockOnTarget(null);
      this.lastHitSummary = 'MONSTER DOWN';
      // 討伐した大型の死骸は剥ぎ取り対象として残す（T15）。スカベンジャーも寄ってくる。
      this.ecosystem.addCarcass(this.monster.def.id, this.monster.position, 240, 3, true);
      this.quest?.notifyMonsterDied(this.monster.def.id);
    });
    this.events.on('playerHit', (e) => {
      this.damageNumbers.spawn(e.position, e.damage, { player: true });
      this.lastHitSummary = `PLAYER HIT by ${e.attackId}: -${e.damage}`;
    });
    this.events.on('playerDowned', () => {
      this.lastHitSummary = 'PLAYER DOWNED';
      this.quest?.notifyPlayerDowned();
    });
    this.events.on('creatureHit', (e) => {
      this.damageNumbers.spawn(e.position, e.damage, {});
      this.lastHitSummary = `creature ${e.creatureId} -${e.damage}${e.died ? ' (killed)' : ''}`;
    });
    this.events.on('creatureKilled', (e) => {
      if (e.cause === 'monster') this.lastHitSummary = `${this.monster.def.name} hunted ${e.creatureDefId}`;
    });
    this.events.on('monsterToppled', (e) => (this.lastHitSummary = `TOPPLED via ${e.partId}`));
    this.events.on('monsterEnraged', () => (this.lastHitSummary = 'ENRAGED!'));
    this.events.on('monsterCalmed', () => (this.lastHitSummary = 'calmed down'));
    this.events.on('monsterExhausted', () => (this.lastHitSummary = 'EXHAUSTED'));
    this.events.on('monsterRecovered', () => (this.lastHitSummary = 'recovered'));
    this.events.on('monsterStateChanged', (e) => (this.lastHitSummary = `AI ${e.from} -> ${e.to}`));
  }

  // ---------------- debug ----------------

  private setupDebugLines(): void {
    if (!this.debug) return;
    const d = this.debug;
    const { controller, stats, combat } = this.player;
    const m = this.monster;
    const ai = this.monsterAI;
    d.addLine(() => `scene ${this.scene}  sim ${this.loop.simulationTime.toFixed(2)}s  timeScale ${this.loop.timeScale.toFixed(2)}${this.hitStop.isActive ? ' HITSTOP' : ''}  area ${this.field.areaAt(controller.position)?.name ?? '-'}`);
    d.addLine(() => {
      const q = this.quest;
      return q ? `quest ${q.state} ${q.timeRemaining.toFixed(0)}s left  downs ${q.downs}/${q.def.maxDowns}${q.state === 'returning' ? ` return ${q.returnRemaining.toFixed(0)}s` : ''}` : 'quest -';
    });
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
      const goal = ai.state === 'travel' || ai.state === 'flee' || ai.state === 'investigate' || ai.state === 'hunt' ? ` -> ${ai.goalLabel} (${m.position.horizontalDistanceTo(ai.goal).toFixed(0)}m)` : '';
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
    d.addLine(() => {
      const counts = new Map<string, number>();
      for (const c of this.ecosystem.creatures) {
        const key = `${c.def.id}:${c.state}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const summary = [...counts.entries()].map(([k, v]) => `${k}x${v}`).join(' ');
      return `eco ${summary}  carcasses ${this.ecosystem.carcasses.length}`;
    });
    d.addLine(() => `last: ${this.lastHitSummary}`);
    d.addLine(() => `pointerLock ${this.input.isPointerLocked ? 'on' : 'off (click canvas)'}  WASD/Shift/Space  J light  K heavy(hold)  Tab lock  F1 heal F2 inf.stamina F3 kill F4 reset F5 AI pause F6 enrage F7 warp F9 abandon`);
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

  // ---------------- simulation ----------------

  private update(dt: number): void {
    const input = this.input.poll();
    if (this.scene !== 'field') return;

    // カメラ回転はシミュレーションではなく入力処理なので、timeScale=0 の Hit Stop 中でも動かす
    this.cameraRig.applyLook(input.lookDeltaX, input.lookDeltaY);
    if (input.lockOnPressed) this.toggleLockOn();
    if (input.abandonQuestPressed) this.quest?.abandon();
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
    this.ecosystem.update(dt, this.ecosystemContext);

    this.combatResolver.resolvePlayerAttacks(this.player, [this.monster]);
    this.combatResolver.resolvePlayerAttacksOnCreatures(this.player, this.ecosystem);
    this.combatResolver.resolveMonsterAttacks([this.monster], this.projectiles.projectiles, this.player);

    if (this.cameraRig.isLockedOn) {
      const dist = controller.position.horizontalDistanceTo(this.monster.position);
      if (dist > this.balance.camera.lockOnMaxDistance || !this.monster.isAlive) this.cameraRig.setLockOnTarget(null);
    }

    this.updateQuest(dt);
  }

  private updateQuest(dt: number): void {
    const quest = this.quest;
    if (!quest) return;
    const tick = quest.update(dt);
    if (tick.respawnNow) this.respawnPlayer();
    if (quest.state === 'completed' || quest.state === 'failed') this.finishQuest();
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

  private projectToScreen(world: Vec3, out: ScreenPoint): void {
    const canvas = this.renderer.renderer.domElement;
    this.cameraRig.project(world, out, canvas.clientWidth, canvas.clientHeight);
  }

  // ---------------- rendering ----------------

  private render(alpha: number, frameDt: number): void {
    this.hitStop.update(frameDt);
    this.playerView.sync(alpha);
    const aiState = this.monsterAI.state;
    this.monsterView.ecologyPose = aiState === 'sleep' || aiState === 'eat' || aiState === 'drink' ? aiState : 'none';
    this.monsterView.sync(alpha, frameDt);
    this.projectileView.sync(this.projectiles.projectiles, alpha);
    this.ecosystemView.sync(alpha, frameDt);
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
    if (this.scene === 'field') this.renderHud();
    this.debug?.update(frameDt);
  }

  private renderHud(): void {
    const m = this.hudModel;
    const { stats, combat, controller } = this.player;
    const quest = this.quest;
    const monster = this.monster;
    m.hpRatio = stats.hpRatio;
    m.staminaRatio = stats.staminaRatio;
    m.weaponName = combat.weapon.name;
    m.sharpnessLabel = SHARPNESS_LABELS[combat.weapon.sharpness];
    m.objective = quest?.objectiveText ?? '';
    m.timeRemaining = quest?.timeRemaining ?? 0;
    m.timeWarning = quest?.isTimeWarning ?? false;
    m.downs = quest?.downs ?? 0;
    m.maxDowns = quest?.def.maxDowns ?? 0;
    m.respawnCountdown = quest?.respawnRemaining ?? 0;
    m.lockOn = this.cameraRig.isLockedOn;
    // 対象の情報は「見つけている / 見つけられている」ときだけ出す（観察を促す）
    const near = controller.position.horizontalDistanceTo(monster.position) <= this.balance.camera.lockOnMaxDistance;
    m.monsterVisible = monster.isAlive && (near || this.monsterAI.perception.detected);
    m.monsterName = monster.def.name;
    m.monsterHpRatio = monster.stats.hpRatio;
    m.monsterBadges.length = 0;
    if (monster.condition.isEnraged) m.monsterBadges.push('怒り');
    if (monster.condition.isExhausted) m.monsterBadges.push('疲労');
    if (monster.stats.hpRatio <= monster.def.behavior.fleeHpRatio) m.monsterBadges.push('瀕死');
    if (this.monsterAI.state === 'sleep') m.monsterBadges.push('睡眠');
    if (this.monsterAI.state === 'eat') m.monsterBadges.push('捕食中');
    for (const part of monster.parts) {
      if (part.state === 'broken') m.monsterBadges.push(`${part.def.name} 破壊`);
      if (part.state === 'severed') m.monsterBadges.push(`${part.def.name} 切断`);
    }
    this.hud.render(m);
  }
}
