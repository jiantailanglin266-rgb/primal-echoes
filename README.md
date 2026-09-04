# PRIMAL ECHOES

完全オリジナル IP の 3D ハンティングアクション RPG。
「巨大生物の生態を理解することが、そのまま攻略になる。」

- ジャンル: 3D ハンティングアクション RPG
- 舞台: ヴァルディア大陸 / 生体エネルギー「エーテル」
- プレイヤー: レンジャー（巨大生物調査・討伐専門家）
- 現在の目標: **Vertical Slice 0.1**（Titan Blade × Valgaron × 翠嵐峡谷 × Hunt クエスト 1 本）

## 技術スタック
TypeScript (strict) / Three.js / Vite / Vitest。
シミュレーション層（`src/core`）は描画ライブラリに依存しない。詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

ブラウザで `http://localhost:5173/?debug=1` を開くとデバッグオーバーレイが有効になる。

## 検証

```bash
npm run check
```

`typecheck`（tsc）と `test`（vitest）を順に実行する。各 Phase はこれが通った状態で完了とする。

## ドキュメント
| ファイル | 内容 |
|---|---|
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | ゲームデザイン（コンセプト・戦闘・モンスター・生態系・VS0.1 定義） |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | レイヤー構成・モジュール責務・データ駆動・ADR |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase / MoSCoW / 依存順タスク |
| [docs/ASSET_TODO.md](docs/ASSET_TODO.md) | 必要な外部アセット一覧 |
| [docs/BALANCE.md](docs/BALANCE.md) | 調整値の記録と根拠 |

## オリジナリティ方針
既存作品からはジャンルの抽象的な仕組み（狩猟ループ・重量感戦闘・素材クラフト・生態観察・部位戦術）のみを参考にし、
固有のモンスター・キャラ・技・名称・UI・音・モデル・世界観は一切流用しない。
