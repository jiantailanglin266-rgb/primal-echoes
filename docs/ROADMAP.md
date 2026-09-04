# PRIMAL ECHOES — Roadmap

## 開発方針
- **Vertical Slice 方式**。最初から完成版を作らない。
- 各 Phase は「コンパイルエラーなし・テスト通過・ドキュメント更新」で完了とする。
- プレースホルダー（プリミティブ形状・仮アニメ）でロジックを先に完成させる。

---

## Phase 一覧（VS0.1 = Phase 1〜10 の最小範囲）

| Phase | 内容 | VS0.1 範囲 |
|---|---|---|
| 1 | プレイヤー移動 / カメラ / 基本攻撃 / 回避 | 全部 |
| 2 | テスト用モンスター / HP / 攻撃判定 / ダメージ | 全部 |
| 3 | モンスターAI / 攻撃 / 怒り / 疲労 | Valgaron のみ |
| 4 | 部位判定 / 部位破壊 / 尻尾切断 | Valgaron の 頭・前脚・尾 |
| 5 | クエスト | Hunt x1 |
| 6 | 素材ドロップ | 剥ぎ取り + 報酬 |
| 7 | クラフト | Titan Blade 強化 1段階 |
| 8 | 武器4種 | Titan Blade のみ（他は Later） |
| 9 | フィールド / 生態系 | 縮小マップ + 小型2種の簡易生態 |
| 10 | UI / サウンド / エフェクト / セーブ | HUD最小・SE仮・セーブ最小 |

---

## Vertical Slice 0.1 — MoSCoW 分類

### Must Have
- [x] 固定ステップのゲームループ（T01 完了）/ シーン遷移（Hub -> Field -> Result -> Hub）（T14 完了）
- [x] プレイヤー移動・ダッシュ・回避（無敵時間）・スタミナ（T03 完了）
- [x] TPS カメラ（Free）+ カメラコリジョン（地形のみ）（T04 完了）/ [ ] LockOn（T06）
- [x] Titan Blade: Light / Heavy / Charge / DodgeAttack の攻撃データとコンボ（T05 完了）
- [x] HitDetection（攻撃ヒットボックス x 部位）と DamageSystem（式のデータ駆動）（T06 完了）
- [x] Valgaron: Stats / 部位（head, body, forelegs, hindlegs, tail）（T07 完了）/ 6攻撃 / 距離帯選択（T08 完了）
- [x] Valgaron AI: 生態（Patrol -> Eat -> Drink -> Sleep）+ 逃走/帰巣 + 知覚（T10 完了）/ 戦闘 State Machine（T08）+ 怒り + 疲労（T09 完了）
- [x] 部位破壊（頭・前脚）と尻尾切断、戦闘への影響（T11 完了）
- [x] クエスト（Hunt / 制限時間 / 力尽き回数）+ リザルト（T14 完了）
- [x] 剥ぎ取りと素材付与、インベントリ（T15 完了）
- [x] Titan Blade 強化レシピ（3 段階）（T16 完了）
- [x] 縮小フィールド（BaseCamp / Forest / River / Cave）と Valgaron の移動経路（T12 完了。地形は手続き生成のプレースホルダー）
- [x] 小型生物 2 種（Grast: 逃走・群れ、Skarv: 死骸に集合）（T13 完了）
- [x] HUD（HP / Stamina / 斬れ味 / クエスト目標 / 大型の状態バッジ）（T14 で最小版。T17 で仕上げ）
- [x] Hit Stop / ダメージ数字（T06 完了）/ Camera Shake（T18 完了）
- [x] セーブ（インベントリ・装備・クエスト進行）（T19 完了）
- [x] Debug Overlay + デバッグキー（F1〜F9、`?debug=1`）

### Should Have
- [x] Soft Lock（VS0.2）
- [x] 環境ギミック 1 種（落石）（VS0.2）
- [x] 天候（雨）で洞窟へ移動（VS0.2）
- [x] 気絶（頭部蓄積）（T07/T08 で実装済み）
- [x] 回復薬（活性薬、T20）/ [ ] スタミナ薬
- [x] 仮 SE（合成音）/ 仮 VFX（点群スパーク、VS0.2）

### Later（VS0.2 以降）
- 残り武器3種（Rift Saber / Break Hammer / Arc Bow）
- 捕獲クエスト・調査・採取・生存・複数討伐
- 防具5部位・スキル発動システム
- キャラクタークリエイト
- フルサイズマップ（Cliff / Nest / Ruins）・ロード無し全域
- 昼夜サイクルと夜行性生物
- 本番モデル・アニメーション・VFX・音楽（ASSET_TODO.md 参照）
- マルチプレイ（未定）

---

## 実装タスク（依存関係順）

```
T01  [done] プロジェクト雛形（Vite+TS+Three+Vitest）、固定ステップ GameLoop、EventBus、Vec3/math
T02  [done] data/ ローダーと型検証、balance.json
T03  [done] 手続き地形（HeightProvider）と PlayerController（移動/ダッシュ/回避/スタミナ）
T04  [done] CameraRig（Free/Collision）。LockOn は T06 で追加
T05  [done] AttackData と PlayerCombat 状態機械（先行入力/派生/回避キャンセル/チャージ）、Titan Blade データ
T06  [done] Valgaron プリミティブ（部位形状 = 当たり判定）+ HitDetection + DamageSystem + LockOn + HitStop + ダメージ数字
T07  [done] MonsterStats / MonsterPart（部位・肉質・partHp・怯み蓄積・破壊/切断判定）
T08  [done] MonsterCombat（telegraph -> startup -> active -> recovery）+ Valgaron 6 攻撃（突進/跳躍/投石の移動含む）+ プレイヤー被弾（のけぞり/無敵/戦闘不能）+ 最小戦闘 AI（距離帯・向き・クールダウン・接近）
T09  [done] MonsterCondition（怒り: 被ダメ蓄積で発動/咆哮/攻撃力・速度↑/スタミナ消費↑/頭部弱点化、疲労: スタミナ枯渇/速度↓/突進・投石不可/怒り強制解除）
T10  [done] MonsterAI 生態層（欲求: 空腹/渇き/疲れ -> travel/eat/drink/sleep、巡回、知覚: 視覚扇形+聴覚、alert -> combat、見失い -> investigate、瀕死 -> flee -> 巣で睡眠、寝込みを襲うと起きる）
T11  [done] 部位破壊効果（頭破壊: 突進/噛みつき威力↓、尾切断: 尾攻撃射程 -40%、前脚破壊: 転倒閾値 -30%、攻撃封印）+ 脚部怯み = 転倒（5 秒）
T12  [done] フィールド定義（翠嵐峡谷: 4 エリア・巣/水場/餌場/巡回点 4・スポーン）+ Field クラス + 仮描画
T13  [done] 小型生物（Grast: 群れ/うろつき/逃走、Skarv: 死骸に集まり食べる）+ EcosystemManager + Valgaron の狩り（hunt）+ 死骸 + プレイヤー攻撃の小型生物ヒット
T14  [done] QuestManager（Hunt / 制限時間 / 力尽き回数 / 討伐後 45 秒の帰還猶予）+ シーン遷移（Hub -> Field -> Result -> Hub）+ HUD（HP/ST/斬れ味/タイマー/目標/対象の状態バッジ）+ 拠点・リザルト画面
T15  [done] アイテム定義 10 種、剥ぎ取り（E キー 2.5 秒・拘束・被弾で中断・死骸ごとの回数）、抽選表、Inventory、クエスト報酬 + 部位破壊報酬、入手通知
T16  [done] レシピ 3 段階（Titan Blade I/II/III）、CraftingManager（素材消費・段階管理・性能差し替え）、拠点の工房パネル
T17  [done] ポーズメニュー（Esc: 続行/音量/中断）、HUD 通知（入手・破壊・気絶・転倒）
T18  [done] Camera Shake（Hit Stop 長に比例）、合成 SE 11 種（外部アセット不使用）、Hit Stop / ダメージ数字は T06
T19  [done] SaveManager（localStorage、version 付き、破損時は無視）、クエスト終了・強化で自動記録、拠点で手動記録/消去
T20  [done] 通しプレイ検証（PlaytestBot `?bot=1` で 3 回討伐成功）・威力/HP 調整・活性薬支給・BALANCE.md 記録 -> **VS0.1 完了（2026-09-05）**

```

依存: T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11。
T12/T13 は T10 以降、T14〜T16 は T11 以降、T17〜T19 は随時、T20 最後。

## VS0.2（2026-09-05 完了）
- [x] Rift Saber（2 本目の武器）+ 拠点での武器切替 + 武器ごとの強化 2 段階 + 装備の保存
- [x] Soft Lock（マウスを触っていない間だけ、24m/±69° 内の対象へ緩く向く）
- [x] 天候（雨 70〜120 秒 / 晴れ 180〜320 秒）。雨は Valgaron が洞窟の巣へ避難し、知覚が 0.7 倍
- [x] 環境ギミック（落石 2 箇所: 220 ダメージ + 転倒、1 クエスト 1 回）
- [x] 仮 VFX（ヒットスパーク・部位破壊・落石の点群）
- [x] Break Hammer（3 本目、打撃・気絶特化、強化 2 段階）
- [ ] 手動プレイでの手触り確認（マウス感度・カメラ距離・攻撃の重さ）と BALANCE.md への追記（ユーザー）

## その後の候補
1. 本番アセット差し替えの土台: プレイヤー/Valgaron の GLTF 読み込みと部位メッシュ対応（ASSET_TODO.md）
2. 残り武器（Arc Bow: プレイヤー側の射撃システムが必要）と防具・スキル
3. 捕獲クエストと調査クエスト
