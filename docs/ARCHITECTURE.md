# PRIMAL ECHOES — Architecture (v0.1 初期案)

> 状態: VS0.1 完了時点。エンジンは TypeScript + Three.js で確定（2026-09-05）。
> 「シミュレーション層はエンジン非依存」という方針は Godot / Unity を選んだ場合も同一に適用する。

---

## 1. 技術スタック（推奨案）

| 層 | 採用 | 理由 |
|---|---|---|
| 言語 | TypeScript (strict) | 環境に Node 24 が既存。静的型でデータ駆動設計と相性が良い |
| 3D描画 | Three.js | Chrome/Edge で即実行・検証可能。プリミティブでの Vertical Slice に十分 |
| ビルド | Vite | HMR で反復が速い |
| テスト | Vitest | シミュレーション層（ダメージ式・AI・部位破壊）を描画なしで単体テスト |
| 物理 | 自前の軽量判定（カプセル/球/OBB）＋高さマップ地形 | 巨大生物のヒットゾーン判定は独自実装の方が制御しやすい。汎用物理エンジンは VS0.1 では不要 |
| UI | HTML/CSS オーバーレイ | HUD・メニューは DOM が最速。独自レイアウト |
| セーブ | localStorage → 後に File System Access API / ファイル | 段階的移行 |

### 代替案（ユーザー選択時）
- **Godot 4 (GDScript/C#)**: 公式配布の単体exeで導入が軽く、headless モードでテスト可。ダウンロードにユーザー許可が必要。
- **Unity 6 (C#)**: ジャンルの業界標準。Unity Hub + Editor（数GB）+ アカウントのユーザー側インストールが必要。エディタなしではビルド検証不可。

---

## 2. レイヤー構成（依存は上→下のみ。循環禁止）

```
┌──────────────────────────────────────────────┐
│ app/          起動・シーン遷移・GameManager     │
├──────────────────────────────────────────────┤
│ presentation/ Three.js 描画・アニメ・VFX・音     │  <- core の状態を「読む」だけ
│ ui/           HUD・メニュー・デバッグ表示(DOM)   │  <- core の状態を「読む」+ 入力イベント発行
│ input/        キー/パッド -> InputState         │
├──────────────────────────────────────────────┤
│ core/         シミュレーション (エンジン非依存)  │  <- Three.js を import しない
│   player/  combat/  monster/  ecosystem/        │
│   quest/  inventory/  crafting/  save/          │
├──────────────────────────────────────────────┤
│ data/         JSON 定義 (武器・攻撃・モンスター・ │
│               部位・素材・クエスト・バランス)     │
├──────────────────────────────────────────────┤
│ shared/       math / events / rng / types        │
└──────────────────────────────────────────────┘
```

**鉄則**
1. `core/` は描画ライブラリを一切参照しない。`Vec3` 等は `shared/math` の自前型。
2. `presentation/` と `ui/` は `core/` の状態を読み、EventBus 経由の通知を受ける。core を直接書き換えない。
3. 調整値はすべて `data/*.json`。コードに Magic Number を書かない（定数は `data/balance.json` か `shared/constants.ts`）。
4. 固定タイムステップ（60Hz）でシミュレーション、描画は補間。Hit Stop はシミュレーション時間のスケールで実装。

---

## 3. 主要モジュールと責務

### core/player
| モジュール | 責務 |
|---|---|
| `PlayerController` | 入力 -> 移動・回避・ダッシュの状態遷移。地形との接地 |
| `PlayerCombat` | 攻撃状態機械（Startup/Active/Recovery）、コンボ遷移、キャンセルウィンドウ |
| `PlayerStats` | HP/Stamina/攻撃/防御/耐性の集計（装備・スキル反映） |
| `WeaponController` | 装備武器の `WeaponDefinition` を読み、入力 -> `AttackData` を解決 |

### core/combat
| モジュール | 責務 |
|---|---|
| `AttackData` | 型定義。damage/motionValue/startup/active/recovery/staminaCost/hitbox/partDamage/stunDamage |
| `HitDetection` | 攻撃ヒットボックス x モンスター HitZone の交差判定。「どの攻撃が・どの部位に」を `HitEvent` として発行 |
| `DamageSystem` | ダメージ式の唯一の実装。HitEvent -> DamageResult |
| `HitStop` | 武器重量別の時間停止量を返す（演出は presentation 側） |

### core/monster
| モジュール | 責務 |
|---|---|
| `MonsterController` | 個体の位置・向き・アニメ状態のオーナー。AI の決定を実行 |
| `MonsterAI` | Behavior Tree（生態レイヤー）+ State Machine（戦闘レイヤー）。距離帯別の攻撃選択 |
| `MonsterCombat` | 攻撃の telegraph/startup/active/recovery 実行とヒットボックス生成 |
| `MonsterStats` | HP・内部スタミナ・怒りゲージ・疲労・状態異常 |
| `MonsterPart` | 部位ごとの partHp/耐性/怯み蓄積/破壊・切断フラグと効果適用 |
| `MonsterPerception` | 視覚・聴覚・匂いによる発見/見失い判定 |

### core/ecosystem
| モジュール | 責務 |
|---|---|
| `EcosystemManager` | 時刻・天候・エリア毎の生物配置・相互作用（捕食・死骸・逃避） |
| `CreatureAI` | 小型生物の 捕食/逃走/睡眠/群れ 行動 |
| `SpawnManager` | 出現・リスポーン |

### core/quest, inventory, crafting, save
`QuestManager` / `ItemManager` / `InventoryManager` / `CraftingManager` / `SaveManager`（スキーマバージョン付き）

### app
`GameManager`（シーン: Title -> Hub -> Field -> Result）、`GameLoop`（固定ステップ）、`DebugManager`

### presentation
`SceneRenderer`, `CameraRig`（TPS/LockOn/SoftLock/Collision）, `EntityView`（core エンティティ <-> Three.Object3D 同期）, `PlaceholderAnimator`, `VfxManager`, `AudioManager`

### ui
`HudView`, `MenuView`, `DebugOverlay`, `DamageNumberView`

---

## 4. データ駆動（JSON スキーマ概要）

```
data/
  balance.json                       # グローバル係数（斬れ味係数、会心倍率、スタミナ回復等）
  weapons/titan_blade.json
  attacks/titan_blade.attacks.json   # AttackData[] とコンボグラフ
  monsters/valgaron.json             # stats, parts(HitZone), attacks, behavior params
  creatures/grast.json, skarv.json
  materials.json
  recipes.json
  quests/vs01_hunt_valgaron.json
  fields/verdant_tempest.json        # エリア・ノード・資源・ギミック
```

各 JSON は TypeScript の型（`data/schemas/*.ts`）で検証し、起動時にロード失敗を即エラーにする。

---

## 5. イベント駆動
`EventBus`（型付き）で core -> presentation/ui へ通知:
`hit`, `partBroken`, `partSevered`, `monsterStateChanged`, `enraged`, `exhausted`, `monsterDied`, `questStarted/Completed/Failed`, `itemObtained`, `playerDamaged`, `playerDowned` ...

---

## 6. ディレクトリ構成（推奨案）

```
primal-echoes/
  docs/            README, GAME_DESIGN, ARCHITECTURE, ROADMAP, ASSET_TODO, BALANCE
  src/
    app/  core/  data/  input/  presentation/  ui/  shared/  debug/
  tests/           core のユニットテスト（Vitest）
  public/          プレースホルダーアセット
```

---

## 7. デバッグ
- `DebugOverlay`: Player HP / Monster HP / State / Stamina / Target / 直近ダメージ / HitZone / Part HP / FPS
- キー: Monster Spawn / Kill / Player Heal / Infinite Stamina / AI Pause / HitZone 可視化 / Time Scale
- URL パラメータ `?debug=1` で有効化。

---

## 7.5 実装済みモジュール一覧（VS0.1 時点）

```
src/app/         GameManager（シーン遷移 hub/field/result・配線）, GameLoop（固定 60Hz）, HitStop, intentBuilder
src/core/player/ Player（集約）, PlayerController（移動/回避/被弾/拘束）, PlayerStats, PlayerIntent
src/core/combat/ AttackData, PlayerCombat（先行入力/派生/回避キャンセル/チャージ）, DamageSystem（式）,
                 HitDetection（球 × 部位）, shapes, CombatResolver（命中解決 + イベント発行）, Projectile, elements
src/core/monster/ Monster（集約 + 部位破壊効果集計）, MonsterStats, MonsterPart, MonsterCombat（攻撃タイムライン/反応）,
                  MonsterCondition（怒り/疲労）, MonsterNeeds（空腹/渇き/疲れ）, MonsterPerception, MonsterAI（生態 + 戦闘）
src/core/ecosystem/ EcosystemManager（小型生物・死骸・獲物提供）, Creature, Carcass
src/core/world/  Terrain（HeightProvider）, Field（エリア/POI）, Weather（晴/雨）, GimmickManager（落石）
src/core/quest/  QuestManager
src/core/inventory/ Inventory, LootTable, CarveController
src/core/crafting/ CraftingManager
src/core/save/   SaveManager（localStorage / memory）
src/data/        balance.json, weapons/, monsters/, creatures/, fields/, quests/, items.json, recipes.json, schemas/, validate, DataRegistry
src/input/       bindings, InputState, KeyboardMouseInput
src/presentation/ SceneRenderer, CameraRig（LockOn/SoftLock/Collision/Shake/肩越し/バネ追従/FOV）, fx/Juice（スロー・命中光・咆哮色収差）, PlayerView, MonsterView, EcosystemView, ProjectileView,
                  FieldView, TerrainView, WeatherView（雨・霧）, GimmickView, HitSparkView, HitboxDebugView, AudioManager（合成 SE）, placeholders
src/ui/          HudView, HubView, ResultView, PauseMenuView, DamageNumberView, styles/base.css
src/debug/       DebugOverlay, PlaytestBot
tests/           25 ファイル 160 テスト（core の全システム + presentation の一部）
```

依存の向きは §2 のとおり。`core/` から `presentation/`・`ui/`・`three` への import は無い（`grep -r "from 'three'" src/core` が空であることを CI 条件にできる）。

## 8. 設計判断の記録（ADR）
| # | 判断 | 理由 |
|---|---|---|
| 001 | core をエンジン非依存にする | ダメージ・AI・部位破壊を描画なしでテストしたい。将来エンジン移行の保険 |
| 002 | 固定 60Hz シミュレーション | フレーム依存のヒット判定・無敵時間のブレを排除 |
| 003 | 汎用物理エンジン不採用（VS0.1） | 巨大生物の部位判定は専用形状の方が制御しやすく、依存も減る |
| 004 | 部位の当たり形状 = 描画形状（球/カプセル） | データ調整の結果を目で確認できる。本番モデル導入後も判定形状は JSON 側に残す |
| 005 | 拠点/リザルトは DOM パネル、フィールド常駐 | VS0.1 ではロードを挟まず、シーン遷移をシミュレーション停止 + 表示切替で表現 |
| 006 | クールダウンは攻撃終了から計測 | 開始から計測すると攻撃時間より短い値が無意味になる |
| 007 | 投射物は発射時点の倍率を保持 | 飛行中に怒りが解けても弾の威力は変わらない（プレイヤーの予測を裏切らない） |
| 008 | 生態層はプレイヤー位置を参照しない | 「プレイヤーがいなくても動いている」を構造で保証。橋渡しは知覚だけ |
| 009 | SE は WebAudio 合成 | 外部素材ゼロで完全オリジナル。差し替え時は ID を維持して中身だけ変える |
