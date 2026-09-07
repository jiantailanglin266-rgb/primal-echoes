# CG Upgrade — 本格CG化の記録

元プロンプト: `primal-echoes_cg_upgrade_prompts.md`（Phase 0〜6）。
前提の差分: 本プロジェクトは importmap+CDN ではなく **Vite ビルド（TypeScript）+ GitHub Actions → Pages** で配信している。
ビルド不要構成へ戻す利点はないため、Vite ビルドを維持したまま各フェーズを適用する（公開 URL は不変）。

## Phase 0 — 現状診断（2026-09-05）

### 描画構成
| 項目 | 現状 |
|---|---|
| Three.js | 0.185.1（npm、Vite でバンドル） |
| レンダラー | WebGLRenderer（antialias、pixelRatio ≤ 2、shadowMap PCFSoft）。トーンマッピングなし・色空間は既定 |
| シーングラフ | Scene 直下に TerrainView（平面メッシュ + ワイヤ）、FieldView（POI 円盤・エリア環）、PlayerView（RangerModel）、MonsterView（部位ピボット + ValgaronDecor）、EcosystemView、ProjectileView、GimmickView、WeatherView（雨点群）、HitSparkView、HitboxDebugView |
| カメラ | PerspectiveCamera 60°、CameraRig（追従・ロックオン・ソフトロック・地形コリジョン・シェイク） |
| マテリアル | MeshStandardMaterial 17 箇所（生成時に複製）、MeshBasicMaterial 5、PointsMaterial 2、LineBasic 1。テクスチャ 0 枚（全て単色） |
| ライト | DirectionalLight 1（影あり、固定 80m 正方形の影カメラ、2048）+ HemisphereLight 1 |
| アセット | すべてプリミティブ生成（glTF/OBJ なし）。本番ビルド JS 706KB（gzip 178KB） |
| ポストプロセス | なし |
| フォグ | 線形 Fog（雨で濃度変化） |

### ボトルネック候補
| 項目 | 概算 |
|---|---|
| ドローコール | 約 150〜250（部位 7 + 装飾 60、レンジャー 30、小型生物 11 体 × 5、POI/ギミック 20、地形 2、点群 2） |
| ポリゴン | 約 6 万（地形 128×128 が最大） |
| テクスチャ | 0（メモリ負荷は無いが、質感も無い） |

### 「安っぽく見える原因」トップ5
1. **トーンマッピング無し・単色マテリアル**: 光の階調が出ず、全てがプラスチックに見える
2. **影の解像度**: 固定 80m 範囲を 2048 で覆うため、足元の影がぼやける（1 テクセル ≈ 8cm）
3. **地形が単色平面**: テクスチャ・法線・傾斜による変化が無く、スケール感が無い
4. **空気感の欠如**: 空が単色、環境光が平坦、遠景の霞みが線形フォグだけ
5. **ポストプロセス無し**: AO が無く接地感が無い。ブルームも無く発光（エーテル）が光として見えない

### リファクタ計画（描画レイヤーの分離）
```
src/presentation/render/
  Renderer.ts     レンダラー生成（色空間・トーンマッピング・品質別 pixelRatio）
  Lighting.ts     太陽（CSM）・環境光・空
  Environment.ts  空/IBL・フォグ・高さフォグ（Phase 2）
  PostFX.ts       EffectComposer と品質プリセット（Phase 4）
  DebugPanel.ts   lil-gui（?debug=1）
```
既存の `SceneRenderer` は上記を束ねる薄い facade に縮小し、各 View は変更しない（マテリアル差し替えは render 層から traverse で行う）。

### 先にやる小さな整理
- `SceneRenderer.setupLights` を `Lighting.ts` へ移す
- 全 View の `castShadow/receiveShadow` を traverse で一括設定できるようにする（個別指定漏れを無くす）

### 判断: WebGPU について
WebGPURenderer は CSM アドオン・EffectComposer と互換が無く（TSL 版の別実装が必要）、二重実装になる。
GitHub Pages で「確実に動く」ことを優先し、**当面は WebGLRenderer のみ**とする。WebGPU 対応は Phase 6 以降の別課題として残す。

## Phase 1 — 描画基盤（完了 2026-09-05）

| 変更ファイル | 内容 |
|---|---|
| `src/presentation/render/Renderer.ts` | WebGLRenderer 生成。sRGB 出力・ACES Filmic・露出 1.0・PCF 影・品質別 pixelRatio 上限（low 1 / mid 1.5 / high 2） |
| `src/presentation/render/Lighting.ts` | 太陽 = CSM（three/addons/csm、カスケード 3、2048、practical 分割、fade）+ HemisphereLight。方位/高度/強さ/影の濃さを API 化。`refreshMaterials()` で後から増えたメッシュにも CSM シェーダを適用 |
| `src/presentation/render/DebugPanel.ts` | lil-gui（`?debug=1`）: 露出・太陽方位・高度・強さ・影の濃さ・環境光 |
| `src/presentation/SceneRenderer.ts` | 上記の facade。`refreshShadows()` で全メッシュの cast/receive と CSM 設定を一括適用（1.5 秒ごと + クエスト開始時） |
| `src/app/GameManager.ts` | パネル生成と refresh 呼び出し（3 行） |

WebGPU は見送り（Phase 0 の判断参照）。

確認手順: `npm run dev` → `http://localhost:5173/?debug=1` → 出発 → 右上パネルで露出・太陽を動かすと即時反映。影は足元がシャープ（近景カスケードは約 2cm/テクセル）。

FPS 影響: ドローコール 250 → 614（影パスが 3 カスケード分増加）。開発機のブラウザペインでは 60fps を維持。低スペック向けには quality=low（カスケード 2・1024）を用意済み（Phase 6 で自動選択）。
