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
- [ ] 固定ステップのゲームループ、シーン遷移（Hub -> Field -> Result -> Hub）
- [ ] プレイヤー移動・ダッシュ・回避（無敵時間）・スタミナ
- [ ] TPS カメラ（Free / LockOn）+ カメラコリジョン（地形のみ）
- [ ] Titan Blade: Light / Heavy / Charge / DodgeAttack の攻撃データとコンボ
- [ ] HitDetection（攻撃ヒットボックス x 部位）と DamageSystem（式のデータ駆動）
- [ ] Valgaron: Stats / 部位（head, body, forelegs, hindlegs, tail）/ 6攻撃 / 距離帯選択
- [ ] Valgaron AI: 生態（Patrol -> Eat -> Drink -> Sleep）+ 戦闘 State Machine + 怒り + 疲労 + 逃走/帰巣
- [ ] 部位破壊（頭・前脚）と尻尾切断、戦闘への影響
- [ ] クエスト（Hunt / 制限時間 / 力尽き回数）+ リザルト
- [ ] 剥ぎ取りと素材付与、インベントリ
- [ ] Titan Blade 強化レシピ 1 段階
- [ ] 縮小フィールド（BaseCamp / Forest / River / Cave）と Valgaron の移動経路
- [ ] 小型生物 2 種（Grast: 逃走・群れ、Skarv: 死骸に集合）
- [ ] HUD（HP / Stamina / 斬れ味 / クエスト目標 / 大型の状態アイコン）
- [ ] Hit Stop / ダメージ数字 / 最低限の Camera Shake
- [ ] セーブ（インベントリ・装備・クエスト進行）
- [ ] Debug Overlay + デバッグキー

### Should Have
- [ ] Soft Lock
- [ ] 環境ギミック 1 種（落石）
- [ ] 天候（雨）で洞窟へ移動
- [ ] 気絶（頭部蓄積）
- [ ] 回復薬・スタミナ薬アイテム
- [ ] 仮 SE / 仮 VFX（パーティクル）

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
T01  プロジェクト雛形（Vite+TS+Three+Vitest）、Lint、固定ステップ GameLoop、EventBus、Vec3/math   <- 最初の実装対象
T02  data/ ローダーと型検証、balance.json
T03  地形（平面 + 高さマップ）と PlayerController（移動/ダッシュ/回避/スタミナ）
T04  CameraRig（Free/LockOn/Collision）
T05  AttackData と PlayerCombat 状態機械、Titan Blade のコンボデータ
T06  ダミーモンスター（球体）+ HitDetection + DamageSystem（単体テスト）
T07  MonsterStats / MonsterPart（部位・耐性・partHp）
T08  MonsterCombat（telegraph -> startup -> active -> recovery のデータ実行）+ 6 攻撃
T09  MonsterAI 戦闘層（距離帯選択・怒り・疲労）
T10  MonsterAI 生態層（Patrol/Eat/Drink/Sleep/Flee/ReturnToNest）+ Perception
T11  部位破壊・切断とその効果反映
T12  フィールド定義（エリアノード・水場・巣）と Valgaron の経路
T13  小型生物（Grast/Skarv）+ EcosystemManager 簡易版
T14  QuestManager（Hunt / 制限時間 / 力尽き）+ Result 画面
T15  剥ぎ取り・素材・Inventory
T16  CraftingManager と Titan Blade 強化
T17  HUD / メニュー / DebugOverlay
T18  Hit Stop / Camera Shake / ダメージ数字 / 仮SE
T19  SaveManager（Autosave / Manual）
T20  通しプレイ検証・バランス初期値記録（BALANCE.md）-> VS0.1 完了
```

依存: T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T10 -> T11。
T12/T13 は T10 以降、T14〜T16 は T11 以降、T17〜T19 は随時、T20 最後。
