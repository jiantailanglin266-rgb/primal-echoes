# PRIMAL ECHOES — Game Design Document (v0.1 初期案)

> 状態: 初期案 / Vertical Slice 0.1 に必要な範囲を優先して記述。
> 本書は完全オリジナルIPの設計書であり、既存作品の固有要素（名称・モンスター・技・UI・世界観等）は一切流用しない。

---

## 1. コンセプト

| 項目 | 内容 |
|---|---|
| 仮タイトル | PRIMAL ECHOES |
| ジャンル | 3Dハンティングアクション RPG |
| 一言コンセプト | **「巨大生物の生態を理解することが、そのまま攻略になる。」** |
| プレイヤー呼称 | レンジャー（巨大生物調査・討伐専門家） |
| 大型生物呼称 | タイタン |
| 舞台 | ヴァルディア大陸（生体エネルギー「エーテル」が生態系を形成する未知の大陸） |

### 1.1 体験の柱（Pillars）

1. **観察が武器になる** — 食事・睡眠・飲水・巡回・縄張り争い・負傷逃走といった生態が、そのまま攻略情報になる。
2. **重量と間合いの戦闘** — 攻撃には必ず「発生→判定→硬直」のリスクがあり、無制限キャンセルはない。強い攻撃ほど遅く、重い。
3. **狩猟ループの手触り** — 素材→装備→より強い個体、の循環を短いスパンで回す。
4. **生きているフィールド** — プレイヤーがいなくても生態系が動いている。

### 1.2 参考として許容する抽象概念（ORIGINALITY RULE）

- 巨大生物を狩るゲームループ／重量感のある戦闘／素材から装備を作る／生態観察による攻略／部位を狙う戦術性
- 上記以外（固有モンスター・キャラ・技名・UI配置・アイコン・文章・世界設定・音）は**参照禁止**。

---

## 2. 世界設定（最小限）

- **ヴァルディア大陸**: 人類未踏の大陸。各地に「調査拠点（ステーション）」が建設され、レンジャーが派遣される。
- **エーテル**: 生体エネルギー。タイタンは体内に大量に蓄積し、怒り状態で活性化する。素材にも残留し、装備の性能源になる。
- **レンジャー**: 討伐だけでなく「調査」「捕獲」「生態記録」も職務。クエストの種類に反映。

---

## 3. プレイヤー

### 3.1 キャラクター作成
- 体型／顔／髪型／髪色／肌色／目／声／名前 を設定可能。
- **能力値差は付けない**。性能は 武器・防具・スキル・プレイヤースキル で決まる。
- レベルアップによるステータス成長は原則採用しない。
- VS0.1 では作成UIは省略し、デフォルト外見のプレイスホルダーを使用（Later）。

### 3.2 パラメータ

| パラメータ | 内部名 | 備考 |
|---|---|---|
| 体力 | `hp` / `maxHp` | 0で戦闘不能 |
| スタミナ | `stamina` / `maxStamina` | 回避・ダッシュ・一部攻撃・特殊行動で消費。自然回復 |
| 攻撃力 | `attack` | 武器基礎値＋スキル |
| 防御力 | `defense` | 防具合計＋スキル |
| 会心率 | `critRate` | 0〜1 |
| 属性攻撃 | `elementAttack[element]` | 武器由来 |
| 属性耐性 | `elementResist[element]` | 防具由来 |
| 移動速度 | `moveSpeed` | 武器抜刀時に係数 |
| 斬れ味 | `sharpness` | 近接武器のみ。攻撃で消耗、研磨で回復 |

### 3.3 基本アクション
- 移動／ダッシュ（スタミナ消費）／回避（無敵時間あり・スタミナ消費）／抜刀・納刀／アイテム使用／採取／攻撃各種。
- 回避の無敵フレームと消費量はデータ化し、装備スキルで拡張可能。

---

## 4. 戦闘設計

### 4.1 戦闘哲学
- 最重要は **「攻撃するタイミングの見極め」**。
- 攻撃は `Startup → Active → Recovery` の三相を必ず持ち、Recovery 中はキャンセル不可（回避キャンセル可能ウィンドウは攻撃ごとにデータで定義）。
- 強攻撃ほど「発生が遅い／硬直が長い／スタミナ消費大」の代わりに「ダメージ／部位ダメージ／怯ませ値」が高い。

### 4.2 ダメージ式

```
PhysicalDamage = WeaponPower × MotionValue × HitZoneMod(physType) × SharpnessMod × CritMod × OtherMods
ElementDamage  = ElementPower × ElementMotionValue × HitZoneMod(element) × SharpnessElemMod × OtherMods
TotalDamage    = round(PhysicalDamage + ElementDamage)
PartDamage     = TotalDamage × AttackData.partDamageMultiplier
StunDamage     = AttackData.stunDamage × HitZone.stunMod   (頭部など特定部位のみ)
```

- 物理種別: `slash` / `impact` / `projectile`
- 属性: `fire` / `water` / `thunder` / `ice` / `aether`
- 全係数は JSON データで定義し、コード内に固定値を持たない。

### 4.3 ヒットゾーン（部位）
- モンスターごとに部位構成を定義: 例 `head, body, leftForeleg, rightForeleg, leftHindleg, rightHindleg, tail, wing...`
- 各部位: 物理3種＋属性5種の耐性係数、`partHp`、`breakable`、`severable`、破壊時の効果参照。

### 4.4 部位破壊
- `partHp` が 0 になると **Part Break** 発生。効果はデータ駆動で、戦闘に影響させる:
  - 角/甲殻破壊 → 突進の威力・追尾低下
  - 前脚破壊 → 転倒しやすくなる（怯み蓄積値の閾値低下）
  - 尻尾切断 → 尻尾攻撃の射程短縮、切断部位から追加素材
- 部位破壊は報酬にも加算される。

### 4.5 怯み・転倒・気絶
- 各部位に怯み蓄積値。閾値到達で `Flinch`。脚部なら `Topple`（転倒）。
- 頭部への打撃で `stunGauge` 蓄積、閾値で `Stunned`（数秒無防備）。
- 閾値は時間経過で減衰し、繰り返すたびに閾値が上昇（連続ハメ防止）。

---

## 5. モンスター

### 5.1 AI 状態（共通）

```
Idle / Patrol / Eat / Drink / Sleep / Search / Investigate / Alert /
Combat / Enraged / Exhausted / Injured / Flee / ReturnToNest / Dead / Captured
```

判断入力: プレイヤー距離・方向、HP、内部スタミナ、部位破壊状態、怒り状態、現在エリア、地形、他モンスター、時刻、天候。

### 5.2 攻撃選択
- 距離帯 `near / middle / far` ごとに攻撃候補と重みを持つ。
- 各攻撃は `telegraph → startup → active → recovery` を必ず持ち、テレグラフで「観察→予測→回避→反撃」が成立する。
- 怒り状態・部位破壊状態で候補テーブルが差し替わる。

### 5.3 怒り（Enrage）
- 蓄積ダメージ／特定部位破壊／時間経過で発動。
- 上昇: 攻撃速度・ダメージ・移動速度・攻撃性。
- 代償: 内部スタミナ消費増、特定部位（エーテル活性部）が弱点化。

### 5.4 疲労（Exhaustion）
- 内部スタミナが激しい攻撃で減少 → 閾値以下で `Exhausted`。
- 攻撃速度低下、隙増大、特定攻撃が不発、食事・休息を試みる（食事中は大きな隙）。

### 5.5 最初の大型モンスター: ヴァルガロン / Valgaron

| 項目 | 内容 |
|---|---|
| 分類 | 四足獣型タイタン |
| 外見 | 岩石状の甲殻、巨大な前脚、長い尾、発達した顎 |
| 生息 | 森林／峡谷／洞窟 |
| 通常行動 | 縄張り巡回 → 草食生物を捕食 → 川で飲水 → 洞窟で睡眠 |
| 攻撃 | Bite / Claw / Tail Sweep / Charge / Jump Slam / Rock Throw |
| 怒り時 | 甲殻内部のエーテルが発光・活性化。Charge が2段階に、Rock Throw が範囲化 |
| 部位 | head(角付き, breakable) / body / foreleg L,R (breakable) / hindleg L,R / tail (severable) |

### 5.6 小型生物（VS0.1 は2種）
- **草食: グラスト（Grast）** — 群れ行動、大型接近で逃走、Valgaron の捕食対象。
- **腐肉食: スカルヴ（Skarv）** — 死骸に集まる、単体では臆病、プレイヤーを見ると距離を取る。

---

## 6. 生態系
- 大型捕食者は小型草食生物を狩る → 死骸にスカベンジャーが集まる。
- 雨 → 一部生物が洞窟へ。夜 → 夜行性生物出現。
- 生態系は **プレイヤー非依存のシミュレーション** として毎 tick 更新される（簡易版から開始）。

---

## 7. 武器（4系統・VS0.1 は Titan Blade のみ）

| 武器 | 特徴 |
|---|---|
| **Titan Blade**（巨大両手剣） | 非常に遅い・一撃が重い・チャージ可・部位破壊性能高 |
| Rift Saber（高速剣） | 連続攻撃・高機動・回避派生・属性相性良 |
| Break Hammer（巨大ハンマー） | 打撃特化・頭部で気絶狙い・チャージ・高疲労性能 |
| Arc Bow（弓） | 遠距離・スタミナ管理・チャージ射撃・部位狙い・特殊矢 |

基本入力: `Light / Heavy / Special / DodgeAttack / Charge`。コンボはデータ（`AttackData`）で管理。

---

## 8. 装備・クラフト・スキル
- 防具部位: Head / Chest / Arms / Waist / Legs。各々 `defense`、属性耐性、スキルポイント。
- 素材希少度: Common / Uncommon / Rare / Epic。ドロップ率はデータ化し過度な周回を要求しない。
- スキル例（オリジナル名）: Might Surge（攻撃強化）／Keen Edge（会心強化）／Second Wind（スタミナ回復）／Phantom Step（回避延長）／Ember Ward（火耐性）／Sunder（部位破壊強化）／Vital Strike（弱点特効）。

---

## 9. クエスト
- 種類: Hunt / Capture / Investigation / Gathering / Survival / MultiTargetHunt
- 定義: `target, timeLimit, rewards, failureConditions`
- 基本失敗: 制限時間終了／規定回数の戦闘不能／特殊条件失敗。

---

## 10. フィールド: 翠嵐峡谷 / Verdant Tempest
- エリア: BaseCamp / Forest / River / Cave / Cliff / Nest / Ruins（ロードなしで連続）
- ギミック: 落石・蔦・崖・毒植物・爆発植物・水流。戦闘利用可。

---

## 11. カメラ・ゲームフィール・UI
- TPS カメラ: Lock On / Soft Lock / Free。Camera Collision 必須。
- 命中時: Hit Stop（武器重量で強度可変）／Camera Shake／Particle／SE／ダメージ数字。過剰演出で敵の動きが見えなくならないこと。
- HUD: HP / Stamina / 武器状態 / アイテムショートカット / モンスター情報 / クエスト目標 / ミニマップ。独自レイアウト。

---

## 12. アイテム・セーブ
- アイテム: 回復薬 / スタミナ回復 / 罠 / 投擲 / バフ。名称・アイコン・演出はオリジナル。
- セーブ: PlayerData / Inventory / Equipment / QuestProgress / CraftingUnlocks / Settings。Autosave ＋ Manual。

---

## 13. Vertical Slice 0.1 の定義

| 要素 | 内容 |
|---|---|
| プレイヤー | 1人、キャラクリなし（プレースホルダー） |
| 武器 | Titan Blade のみ |
| 大型 | Valgaron ×1 |
| 小型 | Grast / Skarv |
| マップ | Verdant Tempest（縮小版: BaseCamp / Forest / River / Cave） |
| クエスト | Hunt: Valgaron 討伐 ×1 |
| ループ | 開始 → 受注 → 出発 → 探索・追跡 → 戦闘 → 討伐 → 剥ぎ取り → 帰還 → 武器強化 → 再受注 |

完成判定: 上記ループを **プレースホルダーモデルで通しプレイ可能** であること。
