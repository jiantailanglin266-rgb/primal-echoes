# PRIMAL ECHOES

完全オリジナル IP の 3D ハンティングアクション RPG。
「巨大生物の生態を理解することが、そのまま攻略になる。」

- ジャンル: 3D ハンティングアクション RPG
- 舞台: ヴァルディア大陸 / 生体エネルギー「エーテル」
- プレイヤー: レンジャー（巨大生物調査・討伐専門家）
- 現在の状態: **Vertical Slice 0.1 完了**（Titan Blade × Valgaron × 翠嵐峡谷 × Hunt クエスト 1 本、プレースホルダー表示）

## 遊べること（VS0.1）
拠点で任務を受注 → フィールドで生態を観察・追跡 → 戦闘（部位破壊・怒り・疲労・転倒・気絶・逃走）→ 討伐 → 剥ぎ取り → リザルト → 拠点で武器強化（3 段階）→ 再出発。素材と強化は自動保存される。

## 技術スタック
TypeScript (strict) / Three.js / Vite / Vitest。
シミュレーション層（`src/core`）は描画ライブラリに依存しない。詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 描画アーキテクチャ
Phase 1〜6 の CG 強化（[docs/CG_UPGRADE.md](docs/CG_UPGRADE.md)）で入った構成。すべて `src/presentation/` 配下で、`src/core/` のロジックは触らない。

| 層 | モジュール | 内容 |
|---|---|---|
| レンダラ | `render/Renderer.ts` | WebGL（WebGPU は CSM/コンポーザーと非互換のため不採用）、sRGB 出力 + ACES、品質プリセット low / mid / high（pixelRatio 上限・影解像度・カスケード数・草密度/描画距離） |
| 光 | `render/Lighting.ts` | 太陽のカスケードシャドウマップ（3 段、practical 分割）+ 半球光。`refreshMaterials()` で後から増えたメッシュにも CSM を適用 |
| 空・環境 | `render/Environment.ts` | 大気散乱の空 → PMREM で IBL を焼く（雨で再焼き）。HDRI があればそちらを使用。FogExp2 + シェーダ注入の高さフォグ。雨で空・霧・露出を連動 |
| 地形・植生 | `render/ProceduralTextures.ts` / `TerrainMaterial.ts` / `Vegetation.ts` | fBm の草・土・岩テクスチャを高さと傾斜で 3 層ブレンド（確率的 UV でタイル目を消す）。草 14,000 本は 36m 格子のチャンク InstancedMesh（視錐台・距離カリング）、木・岩も InstancedMesh、風は頂点シェーダで共有 |
| キャラクター | `render/AssetLoader.ts` / `CharacterRig.ts` | glTF + Draco + KTX2。`assets/models/*.glb` があればプリミティブと差し替え、クリップ名の対応表でアニメを駆動。無ければ手続きアニメのプリミティブ |
| ポストプロセス | `render/PostFX.ts` | Render → GTAO → HDR Bloom → DoF（焦点はプレイヤー距離）→ Grade（ビネット・色収差・グレイン・色寄せ）→ SMAA → Output |
| カメラ・手応え | `CameraRig.ts` / `fx/Juice.ts` | 肩越し + バネ追従 + ダッシュ FOV、Hit Stop / シェイク / スローモーション / 命中光 / 咆哮の色収差 |
| 品質・配信 | `render/QualityManager.ts` / `ui/LoadingView.ts` | GPU 名・モバイル・解像度から初期品質を決め、3 秒平均 FPS が 55 未満なら 1 段階下げる（`?quality=low|mid|high` で固定）。起動時はローディング画面でアセット確認 → IBL 焼き込み → シェーダコンパイル → ウォームアップ描画。アセット URL にはビルド ID を付与 |

調整は `?debug=1` の右上パネル（Tone / Sun / Ambient / Sky・Fog / PostFX / Camera / Wind）と左下の stats.js、オーバーレイの `quality` / `draw` 行で行う。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

ブラウザで `http://localhost:5173/` を開く。キャンバスをクリックするとマウスでカメラを回せる（ポインターロック）。

| 操作 | キー |
|---|---|
| 移動 / ダッシュ | WASD / Shift |
| 回避 | Space |
| 弱攻撃 / 強攻撃（長押しで溜め） | J / K |
| ロックオン | Tab または Q |
| 剥ぎ取り | E（死骸のそばで） |
| 活性薬 | H |
| 一時停止 | Esc |

### デバッグ
- `?debug=1` でオーバーレイ（FPS・品質・描画コール・メモリ）、stats.js、描画パネル、当たり判定表示。`?quality=low|mid|high` で品質を固定。F1 回復 / F2 無限スタミナ / F3 討伐 / F4 モンスター初期化 / F5 AI 停止 / F6 怒り / F7 モンスターの背後へワープ / F9 任務中断
- `?bot=1` で通しプレイ検証ボット。コンソールから `__game.update(1/60)` を回すと早回しできる（検証手順は [docs/BALANCE.md](docs/BALANCE.md)）

## アセットの配置（任意）
外部アセットが無くても手続き生成で動きます。置くと自動で差し替わります（すべて CC0 など再配布可能なものを使うこと）。

| 置く場所 | 内容 | 用途 |
|---|---|---|
| `public/assets/hdri/environment.hdr` | 等距円筒 HDRI（Poly Haven など、2K 推奨） | IBL と背景。無ければ大気散乱の手続き空 |
| `public/assets/textures/terrain/{grass,dirt,rock}_{albedo,normal}.jpg` | 地形テクスチャ 1K〜2K | 地形 3 層ブレンド（現状は手続き生成。差し替え対応は Phase 3 以降） |
| `public/assets/models/*.glb` | glTF（Draco/KTX2 圧縮可） | プレイヤー/モンスター/植生（Phase 3 のパイプライン） |

描画の調整は `?debug=1` の右上パネルで行い、決まった値をコードへ書き戻します。

## 検証

```bash
npm run check
```

`typecheck`（tsc）と `test`（vitest、170 件）を順に実行する。各 Phase はこれが通った状態で完了とする。

## ドキュメント
| ファイル | 内容 |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | ゲームデザイン（コンセプト・戦闘・モンスター・生態系・VS0.1 定義） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | レイヤー構成・モジュール責務・データ駆動・ADR |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase / MoSCoW / 依存順タスクと進捗 |
| [docs/ASSET_TODO.md](docs/ASSET_TODO.md) | 必要な外部アセット一覧 |
| [docs/BALANCE.md](docs/BALANCE.md) | 調整値の記録と根拠、通しプレイ検証ログ |

## オリジナリティ方針
既存作品からはジャンルの抽象的な仕組み（狩猟ループ・重量感戦闘・素材クラフト・生態観察・部位戦術）のみを参考にし、
固有のモンスター・キャラ・技・名称・UI・音・モデル・世界観は一切流用しない。音も外部素材を使わず合成している。
