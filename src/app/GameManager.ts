import { GameLoop } from './GameLoop';
import { HitStop } from './HitStop';
import { buildPlayerIntent } from './intentBuilder';
import { assertItemReferences, loadBalance, loadCreatures, loadItems, loadQuests, loadRecipes, loadValgaron, loadVerdantTempest, loadWeapons } from '@data/DataRegistry';
import type { BalanceData } from '@data/schemas/balance';
import type { QuestDefinition } from '@data/schemas/quest';
import type { ItemDefinition } from '@data/schemas/item';
import type { CreatureDefinition } from '@data/schemas/creature';
import { Inventory } from '@core/inventory/Inventory';
import { CarveController } from '@core/inventory/CarveController';
import { mergeDrops, rollPartBreakRewards, rollQuestRewards, type LootDrop } from '@core/inventory/LootTable';
import { CraftingManager } from '@core/crafting/CraftingManager';
import { LocalStorageSaveStorage, SaveManager, createEmptySave, type SaveData } from '@core/save/SaveManager';
import { AudioManager } from '@presentation/AudioManager';
import { PauseMenuView } from '@ui/PauseMenuView';
import type { WeaponDefinition } from '@data/schemas/weapon';
import type { WeaponUpgradeRecipe } from '@data/schemas/recipe';
import { Field } from '@core/world/Field';
import { Weather } from '@core/world/Weather';
import { GimmickManager } from '@core/world/GimmickManager';
import { WeatherView } from '@presentation/WeatherView';
import { GimmickView } from '@presentation/GimmickView';
import { HitSparkView } from '@presentation/HitSparkView';
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
import { PlaytestBot } from '@debug/PlaytestBot';
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
  readonly weather: Weather;
  readonly gimmicks: GimmickManager;
  private readonly weatherView: WeatherView;
  private readonly gimmickView: GimmickView;
  private readonly hitSparks = new HitSparkView();
  readonly player: Player;
  readonly monster: Monster;
  readonly monsterAI: MonsterAI;
  readonly projectiles: ProjectileManager;
  readonly ecosystem: EcosystemManager;
  readonly quests: QuestDefinition[];
  quest: QuestManager | null = null;
  readonly items: Map<string, ItemDefinition>;
  readonly inventory = new Inventory();
  /** クエスト中だけ有効な支給品（持ち越さない）。 */
  readonly pouch = new Inventory();
  private static readonly QUICK_ITEM_ID = 'vital_tonic';
  readonly carve: CarveController;
  readonly crafting: CraftingManager;
  readonly recipes: WeaponUpgradeRecipe[];
  readonly saveManager: SaveManager;
  readonly audio = new AudioManager();
  private readonly pauseMenu: PauseMenuView;
  private paused = false;
  /** `?bot=1` で有効。通しプレイの自動検証用。 */
  bot: PlaytestBot | null = null;
  private questClears: Record<string, number> = {};
  private savedAt: string | null = null;
  /** 全武器の基準定義。強化はこれに性能を上書きして適用する。 */
  readonly weapons: Map<string, WeaponDefinition>;
  private equippedWeaponId = 'titan_blade';

  /** 装備中武器の基準定義（未強化）。 */
  private get baseWeapon(): WeaponDefinition {
    const weapon = this.weapons.get(this.equippedWeaponId) ?? this.weapons.values().next().value;
    if (!weapon) throw new Error('[GameManager] no weapons defined');
    return weapon;
  }
  private readonly creatureDefs: Map<string, CreatureDefinition>;
  private readonly rng: Random;
  /** 今回のクエスト中に得た素材（リザルト表示用）。 */
  private questLoot: LootDrop[] = [];
  private readonly notices: { text: string; remaining: number }[] = [];
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
    this.weapons = loadWeapons();
    const weapon = this.weapons.get(this.equippedWeaponId);
    if (!weapon) throw new Error('[GameManager] default weapon titan_blade is missing');
    const valgaronDef = loadValgaron();
    this.quests = loadQuests();
    this.items = loadItems();
    this.creatureDefs = loadCreatures();
    this.recipes = loadRecipes();
    for (const r of this.recipes) assertItemReferences(this.items, r.materials.map((m) => m.itemId), `recipes/${r.id}`);
    this.crafting = new CraftingManager(this.recipes, this.inventory);
    // 素材参照の整合性は起動時に落とす（typo をプレイ中の「何も出ない」で気付かないため）
    assertItemReferences(this.items, valgaronDef.carves.map((c) => c.itemId), `monsters/${valgaronDef.id}.carves`);
    assertItemReferences(this.items, valgaronDef.partBreakRewards.map((r) => r.itemId), `monsters/${valgaronDef.id}.partBreakRewards`);
    for (const c of this.creatureDefs.values()) assertItemReferences(this.items, c.carves.map((x) => x.itemId), `creatures/${c.id}.carves`);
    for (const q of this.quests) {
      assertItemReferences(this.items, q.rewards.map((r) => r.itemId), `quests/${q.id}.rewards`);
      assertItemReferences(this.items, q.supplies.map((s) => s.itemId), `quests/${q.id}.supplies`);
    }
    const rng = new Random(0xc0ffee);
    this.rng = rng;

    this.renderer = new SceneRenderer(canvas);
    this.input = new KeyboardMouseInput(canvas);

    this.field = new Field(loadVerdantTempest());
    this.renderer.scene.add(createFieldView(this.field));
    const terrain = this.field.terrain;
    this.weather = new Weather(this.field.def.weather, rng);
    this.weatherView = new WeatherView(this.weather, this.renderer.scene);
    this.renderer.scene.add(this.weatherView.object);
    this.gimmicks = new GimmickManager(this.field.def.gimmicks, (x, z) => terrain.getHeight(x, z), {
      onTriggered: (g) => {
        this.gimmickView.trigger(g);
        this.events.emit('gimmickTriggered', { gimmickId: g.def.id, position: g.position.clone() });
      },
      onImpact: (impact) => this.events.emit('gimmickImpact', impact),
    });
    this.gimmickView = new GimmickView(this.gimmicks);
    this.renderer.scene.add(this.gimmickView.object);
    this.renderer.scene.add(this.hitSparks.object);

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

    this.carve = new CarveController(
      this.player.controller,
      this.inventory,
      rng,
      (sourceId) => (sourceId === valgaronDef.id ? valgaronDef.carves : (this.creatureDefs.get(sourceId)?.carves ?? null)),
      this.balance.carve.durationSeconds,
      this.balance.carve.rangeMeters,
    );

    this.monsterAI = new MonsterAI(this.monster, rng);
    this.aiContext = { field: this.field, subject: { position: this.player.controller.position, isNoisy: false }, prey: this.ecosystem, weather: this.weather };
    this.ecosystemContext = { player: this.aiContext.subject, monsters: [this.monster] };

    this.combatResolver = new CombatResolver(this.events, this.balance.combat, rng);

    this.cameraRig = new CameraRig(this.renderer.camera, terrain, this.balance.camera);
    // ソフトロック: 生きていて見つけている/近い対象へ、マウスを触っていない間だけ緩く向く
    this.cameraRig.setSoftLockTarget(() => {
      const m = this.monster;
      if (!m.isAlive || this.scene !== 'field') return null;
      const near = this.player.controller.position.horizontalDistanceTo(m.position) <= this.balance.camera.softLockRange;
      if (!near && !this.monsterAI.perception.detected) return null;
      return this.lockOnPoint.set(m.position.x, m.position.y + m.def.stats.bodyRadius, m.position.z);
    });
    this.damageNumbers = new DamageNumberView(uiRoot, (world, out) => this.projectToScreen(world, out));
    this.hud = new HudView(uiRoot);
    this.hubView = new HubView(uiRoot);
    this.resultView = new ResultView(uiRoot);
    this.pauseMenu = new PauseMenuView(uiRoot);
    this.hubView.onStartQuest = (quest) => {
      this.audio.unlock();
      this.audio.play('uiClick');
      this.startQuest(quest);
    };
    this.hubView.onCraft = (recipeId) => this.craftWeapon(recipeId);
    this.hubView.onEquip = (weaponId) => this.equipWeaponById(weaponId);
    this.hubView.onSave = () => {
      this.saveGame();
      this.audio.play('uiClick');
      this.renderHub();
    };
    this.hubView.onDeleteSave = () => this.deleteSave();
    this.resultView.onReturn = () => {
      this.audio.play('uiClick');
      this.enterHub();
    };
    this.pauseMenu.onResume = () => this.setPaused(false);
    this.pauseMenu.onAbandon = () => {
      this.setPaused(false);
      this.quest?.abandon();
    };
    this.pauseMenu.onVolumeChange = (v) => this.audio.setMasterVolume(v);
    // 音はユーザー操作後にしか鳴らせない。最初のクリック/キーで解錠する。
    canvas.addEventListener('click', () => this.audio.unlock());
    window.addEventListener('keydown', () => this.audio.unlock(), { once: true });

    this.saveManager = new SaveManager(new LocalStorageSaveStorage());
    this.applySave(this.saveManager.load());

    const debugEnabled = DebugOverlay.isEnabled();
    this.debug = debugEnabled ? new DebugOverlay(debugRoot) : null;
    if (new URLSearchParams(window.location.search).get('bot') === '1') {
      this.bot = new PlaytestBot(this.player, this.monster);
    }
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
    this.renderHub();
  }

  // ---------------- save ----------------

  private applySave(save: SaveData | null): void {
    if (!save) return;
    this.inventory.loadSnapshot(save.inventory);
    if (this.weapons.has(save.equippedWeaponId)) this.equippedWeaponId = save.equippedWeaponId;
    this.player.equipWeapon(this.crafting.restore(save.crafting, this.baseWeapon));
    this.questClears = { ...save.questClears };
    this.audio.setMasterVolume(save.settings.masterVolume);
    this.pauseMenu.setVolume(save.settings.masterVolume);
    this.savedAt = save.savedAt;
  }

  private buildSave(): SaveData {
    const data = createEmptySave();
    data.inventory = this.inventory.toSnapshot();
    data.crafting = this.crafting.toProgress();
    data.questClears = { ...this.questClears };
    data.equippedWeaponId = this.equippedWeaponId;
    data.settings.masterVolume = this.audio.masterVolume;
    return data;
  }

  saveGame(): void {
    this.saveManager.save(this.buildSave());
    this.savedAt = new Date().toISOString();
  }

  private deleteSave(): void {
    this.saveManager.clear();
    this.inventory.clear();
    this.questClears = {};
    this.savedAt = null;
    this.equippedWeaponId = 'titan_blade';
    this.player.equipWeapon(this.crafting.restore({ weaponLevels: {} }, this.baseWeapon));
    this.renderHub();
  }

  private setPaused(paused: boolean): void {
    if (this.scene !== 'field') return;
    this.paused = paused;
    this.pauseMenu.visible = paused;
    this.pauseMenu.setVolume(this.audio.masterVolume);
    if (paused && document.pointerLockElement) document.exitPointerLock();
  }

  private renderHub(): void {
    const weapon = this.player.combat.weapon;
    const next = this.crafting.nextRecipe(weapon.id);
    this.hubView.render({
      playerName: 'レンジャー',
      weapons: [...this.weapons.values()].map((w) => {
        const leveled = this.crafting.weaponAtCurrentLevel(w);
        return { id: w.id, name: leveled.name, weaponPower: leveled.weaponPower, level: this.crafting.weaponLevel(w.id), equipped: w.id === this.equippedWeaponId };
      }),
      weaponName: weapon.name,
      weaponPower: weapon.weaponPower,
      weaponLevel: this.crafting.weaponLevel(weapon.id),
      sharpnessLabel: SHARPNESS_LABELS[weapon.sharpness],
      maxHp: this.player.stats.maxHp,
      quests: this.quests,
      inventoryLines: this.inventory.entries().map(([id, n]) => `${this.itemName(id)} ×${n}`),
      craft: next
        ? {
            recipeId: next.id,
            name: next.displayName,
            resultLine: `攻撃力 ${weapon.weaponPower} → ${next.result.weaponPower} / ${SHARPNESS_LABELS[next.result.sharpness]} / 会心 ${Math.round(next.result.critRate * 100)}%`,
            materialLines: this.crafting.materialStatus(next).map((s) => ({
              text: `${this.itemName(s.itemId)}  ${s.owned}/${s.required}`,
              satisfied: s.owned >= s.required,
            })),
            canCraft: this.crafting.canCraft(next),
          }
        : null,
      savedAtLabel: this.savedAt ? new Date(this.savedAt).toLocaleString('ja-JP') : '',
      questClears: Object.values(this.questClears).reduce((a, b) => a + b, 0),
    });
  }

  private equipWeaponById(weaponId: string): void {
    if (!this.weapons.has(weaponId) || weaponId === this.equippedWeaponId) return;
    this.equippedWeaponId = weaponId;
    this.player.equipWeapon(this.crafting.weaponAtCurrentLevel(this.baseWeapon));
    this.audio.play('uiClick');
    this.saveGame();
    this.renderHub();
  }

  private craftWeapon(recipeId: string): void {
    const recipe = this.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const upgraded = this.crafting.craft(recipe, this.baseWeapon);
    if (!upgraded) return;
    this.player.equipWeapon(this.crafting.weaponAtCurrentLevel(this.baseWeapon));
    this.events.emit('weaponCrafted', { recipeId, weaponName: this.player.combat.weapon.name });
    this.audio.play('itemGet');
    this.saveGame();
    this.renderHub();
  }

  startQuest(def: QuestDefinition): void {
    this.resetWorldForQuest();
    this.questLoot = [];
    this.notices.length = 0;
    this.pouch.clear();
    for (const s of def.supplies) this.pouch.add(s.itemId, s.count);
    this.quest = new QuestManager(def, this.balance.quest);
    this.quest.start();
    this.setScene('field');
    this.pushNotice(`任務開始: ${def.name}`);
    this.events.emit('questStarted', { questId: def.id });
  }

  private finishQuest(): void {
    const quest = this.quest;
    if (!quest) return;
    const success = quest.state === 'completed';
    if (success) {
      // クリア報酬 + 部位破壊報酬。剥ぎ取り分は既に questLoot に入っている。
      const drops = [...rollQuestRewards(quest.def.rewards, this.rng), ...rollPartBreakRewards(this.monster.def.partBreakRewards, quest.brokenPartIds, this.rng)];
      for (const drop of drops) {
        this.inventory.add(drop.itemId, drop.count);
        this.questLoot.push(drop);
        this.events.emit('itemObtained', { itemId: drop.itemId, count: drop.count, source: 'reward' });
      }
      this.questClears[quest.def.id] = (this.questClears[quest.def.id] ?? 0) + 1;
      this.events.emit('questCompleted', { questId: quest.def.id, clearTimeSeconds: quest.clearTimeSeconds });
      this.audio.play('questClear');
    } else {
      this.events.emit('questFailed', { questId: quest.def.id, reason: quest.failReason ?? 'none' });
      this.audio.play('questFail');
    }
    this.carve.cancel();
    this.setPaused(false);
    // 剥ぎ取った素材が失われないよう、クエスト終了時点で自動記録する
    this.saveGame();

    this.resultView.render({
      success,
      questName: quest.def.name,
      failReason: FAIL_REASON_LABELS[quest.failReason ?? 'none'],
      clearTimeSeconds: quest.clearTimeSeconds,
      downs: quest.downs,
      brokenParts: quest.brokenPartIds.map((id) => this.monster.getPart(id).def.name),
      rewardLines: mergeDrops(this.questLoot).map((d) => `${this.itemName(d.itemId)} ×${d.count}`),
    });
    this.setScene('result');
  }

  private itemName(itemId: string): string {
    return this.items.get(itemId)?.name ?? itemId;
  }

  private pushNotice(text: string): void {
    this.notices.push({ text, remaining: 3.5 });
    if (this.notices.length > 4) this.notices.shift();
  }

  private setScene(scene: GameScene): void {
    this.scene = scene;
    this.hud.visible = scene === 'field';
    this.hubView.visible = scene === 'hub';
    this.resultView.visible = scene === 'result';
    this.paused = false;
    this.pauseMenu.visible = false;
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
    this.weather.reset();
    this.gimmicks.reset();
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
    const fb = this.balance.feedback;
    this.events.on('hit', (e) => {
      if (this.bot) {
        this.bot.stats.hitsLanded++;
        this.bot.stats.damageDealt += e.result.total;
      }
      this.hitStop.trigger(e.hitStopSeconds);
      this.cameraRig.shake(e.hitStopSeconds * fb.shakePerHitStopSecond, Math.min(fb.shakeMaxSeconds, e.hitStopSeconds * 1.5));
      this.audio.play(e.hitStopSeconds >= fb.heavyHitStopThresholdSeconds ? 'hitHeavy' : 'hitLight');
      this.monsterView.flashPart(e.partId);
      this.hitSparks.burst(e.position, e.result.isCritical ? 16 : 9, e.result.isCritical ? 0xffb347 : 0xf4e9cf, e.result.isCritical ? 7 : 5);
      this.damageNumbers.spawn(e.position, e.result.total, { critical: e.result.isCritical });
      this.lastHitSummary = `${e.partId} ${e.result.total}${e.result.isCritical ? ' CRIT' : ''} (part ${e.result.partDamage.toFixed(0)})`;
      // 攻撃された = 発見される（寝込みを襲えば起きる）
      this.monsterAI.notifyAttacked(this.player.controller.position);
    });
    this.events.on('partBroken', (e) => {
      const shape = this.monster.getWorldShapes().find((s) => s.part.id === e.partId);
      if (shape) this.hitSparks.burst(shape.shape.a, 30, 0xff6b4a, 8);
      this.lastHitSummary = `PART BROKEN: ${this.monster.getPart(e.partId).def.name}`;
      this.quest?.notifyPartBroken(e.partId);
      this.cameraRig.shake(fb.shakeOnPartBreak, fb.shakeMaxSeconds);
      this.audio.play('partBreak');
      this.pushNotice(`${this.monster.getPart(e.partId).def.name} を破壊`);
    });
    this.events.on('partSevered', (e) => {
      this.lastHitSummary = `PART SEVERED: ${this.monster.getPart(e.partId).def.name}`;
      this.quest?.notifyPartBroken(e.partId);
      this.cameraRig.shake(fb.shakeOnPartBreak, fb.shakeMaxSeconds);
      this.audio.play('partBreak');
      this.pushNotice(`${this.monster.getPart(e.partId).def.name} を切断`);
    });
    this.events.on('monsterAttackStarted', () => this.audio.play('telegraph'));
    this.events.on('weatherChanged', (e) => {
      this.pushNotice(e.state === 'rain' ? '雨が降り始めた' : '雨が上がった');
      this.lastHitSummary = `weather ${e.state}`;
    });
    this.events.on('gimmickTriggered', (e) => {
      this.audio.play('carve');
      this.lastHitSummary = `gimmick ${e.gimmickId} triggered`;
    });
    this.events.on('gimmickImpact', (e) => {
      this.cameraRig.shake(fb.shakeOnPartBreak * 1.5, 0.5);
      this.audio.play('hitHeavy');
      this.hitSparks.burst(e.position, 40, 0xb9a48a, 9);
      this.pushNotice(e.hitMonsterIds.length > 0 ? '落石が直撃！' : '落石は外れた');
      this.lastHitSummary = `gimmick impact hits=${e.hitMonsterIds.length}`;
    });
    this.events.on('monsterEnraged', () => {
      this.cameraRig.shake(fb.shakeOnRoar, 0.6);
      this.audio.play('roar');
    });
    this.events.on('itemObtained', (e) => {
      if (e.source === 'carve') this.audio.play('carve');
    });
    this.events.on('monsterDied', () => {
      if (this.bot) this.bot.stats.killedAtSeconds = this.quest?.elapsed ?? null;
      this.cameraRig.setLockOnTarget(null);
      this.lastHitSummary = 'MONSTER DOWN';
      // 討伐した大型の死骸は剥ぎ取り対象として残す（T15）。スカベンジャーも寄ってくる。
      this.ecosystem.addCarcass(this.monster.def.id, this.monster.position, 240, 3, true);
      this.quest?.notifyMonsterDied(this.monster.def.id);
    });
    this.events.on('playerHit', (e) => {
      if (this.bot) this.bot.stats.damageTaken += e.damage;
      this.damageNumbers.spawn(e.position, e.damage, { player: true });
      this.lastHitSummary = `PLAYER HIT by ${e.attackId}: -${e.damage}`;
      this.cameraRig.shake(fb.shakeOnPlayerHit, 0.35);
      this.audio.play('playerHurt');
    });
    this.events.on('playerDowned', () => {
      if (this.bot) this.bot.stats.downs++;
      this.lastHitSummary = 'PLAYER DOWNED';
      this.quest?.notifyPlayerDowned();
      this.carve.cancel();
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
    this.events.on('monsterStunned', () => this.pushNotice('気絶！'));
    this.events.on('monsterToppled', () => this.pushNotice('転倒！'));
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
    d.addLine(() => `inventory ${this.inventory.entries().map(([id, n]) => `${id}x${n}`).join(' ') || '-'}`);
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
    if (input.pausePressed) this.setPaused(!this.paused);
    if (this.paused) return;

    // カメラ回転はシミュレーションではなく入力処理なので、timeScale=0 の Hit Stop 中でも動かす
    this.cameraRig.applyLook(input.lookDeltaX, input.lookDeltaY);
    if (input.lockOnPressed) this.toggleLockOn();
    if (input.abandonQuestPressed) this.quest?.abandon();
    if (this.debug) this.handleDebugInput(input);

    this.cameraRig.getForwardXZ(this.cameraForward);
    this.cameraRig.getRightXZ(this.cameraRight);
    buildPlayerIntent(input, this.cameraForward, this.cameraRight, this.intent);
    if (this.bot) this.bot.update(dt, input, this.intent, this.ecosystem.carcasses);
    if (input.useItemPressed) this.useQuickItem();

    this.player.update(this.intent, dt);
    this.field.terrain.clampToBounds(this.player.controller.position);

    if (this.weather.update(dt)) this.events.emit('weatherChanged', { state: this.weather.state });
    // 操作キーはギミック優先、次に剥ぎ取り
    const gimmickUsed = this.gimmicks.update(dt, this.player.controller.position, input.interactPressed, [this.monster]);
    const carved = this.carve.update(dt, input.interactPressed && !gimmickUsed && !this.gimmicks.prompt.available, this.ecosystem.carcasses);
    if (carved) {
      if (carved.drop) {
        this.questLoot.push(carved.drop);
        this.events.emit('itemObtained', { itemId: carved.drop.itemId, count: carved.drop.count, source: 'carve' });
        this.pushNotice(`${this.itemName(carved.drop.itemId)} ×${carved.drop.count} を入手`);
        this.lastHitSummary = `carved ${carved.drop.itemId}`;
      } else {
        this.pushNotice('何も得られなかった');
      }
    }
    for (let i = this.notices.length - 1; i >= 0; i--) {
      const n = this.notices[i] as { text: string; remaining: number };
      n.remaining -= dt;
      if (n.remaining <= 0) this.notices.splice(i, 1);
    }

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

  private useQuickItem(): void {
    const id = GameManager.QUICK_ITEM_ID;
    const def = this.items.get(id);
    if (!def?.effect || !this.pouch.has(id)) return;
    if (!this.player.useConsumable(def.effect)) return;
    this.pouch.remove(id);
    this.audio.play('itemGet');
    this.pushNotice(`${def.name} を使用（残り ${this.pouch.count(id)}）`);
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
    this.playerView.sync(alpha, frameDt);
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
    this.weatherView.update(frameDt, this.renderer.camera.position);
    this.gimmickView.update(frameDt);
    this.hitSparks.update(frameDt);
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
    m.objective = `${this.weather.isRaining ? '☂ 雨　' : ''}${quest?.objectiveText ?? ''}`;
    m.timeRemaining = quest?.timeRemaining ?? 0;
    m.timeWarning = quest?.isTimeWarning ?? false;
    m.downs = quest?.downs ?? 0;
    m.maxDowns = quest?.def.maxDowns ?? 0;
    m.respawnCountdown = quest?.respawnRemaining ?? 0;
    m.lockOn = this.cameraRig.isLockedOn;
    const carve = this.carve.prompt;
    if (this.carve.isCarving) {
      m.prompt = '剥ぎ取り中…';
      m.promptProgress = controller.interactProgress;
    } else if (this.gimmicks.prompt.available) {
      m.prompt = `E: ${this.gimmicks.prompt.name}を崩す`;
      m.promptProgress = 0;
    } else if (carve.available) {
      m.prompt = `E: 剥ぎ取る（残り ${carve.carvesRemaining}）`;
      m.promptProgress = 0;
    } else {
      m.prompt = '';
      m.promptProgress = 0;
    }
    m.notices = this.notices.map((n) => n.text);
    const quickDef = this.items.get(GameManager.QUICK_ITEM_ID);
    m.itemSlot = quickDef ? `${quickDef.name} ×${this.pouch.count(GameManager.QUICK_ITEM_ID)}  [H]` : '';
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
