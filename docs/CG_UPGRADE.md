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

## Phase 2 — 環境と空気感（完了 2026-09-05）

ステージは「森林と峡谷（翠嵐峡谷）」。外部アセットは未配置でも成立するよう、すべて手続き生成で代替し、置けば自動で差し替わるローダーを用意した。

| 変更ファイル | 内容 |
|---|---|
| `src/presentation/render/Environment.ts` | 大気散乱の空（three/addons Sky）。太陽位置は Lighting と同期。空を PMREM に焼いて IBL（scene.environment）、太陽や天候が変わると 0.5 秒間隔で焼き直し。`assets/hdri/environment.hdr` があれば HDRI を IBL + 背景（blurriness 0.12）に使用。距離フォグ FogExp2（色は太陽高度と雨から近似）、高さフォグはマテリアルへのシェーダ注入（`patchMaterial`、CSM の後に連結）。雨で濁り・フォグ・太陽色・環境光を連続的に変化 |
| `src/presentation/render/ProceduralTextures.ts` | タイル可能な fBm から草/土/岩の albedo と法線を生成（512²、ミップ・異方性） |
| `src/presentation/render/TerrainMaterial.ts` | MeshStandardMaterial に 3 層ブレンドを注入。重み = 高さ（土 1.2m〜、岩 2.6m〜）と傾斜（法線 y < 0.82 で岩）。セルごとに UV を回転・平行移動した 2 サンプルを混ぜてタイル感を消す（簡易 stochastic） |
| `src/presentation/render/Vegetation.ts` | InstancedMesh: 草 14,000（交差板、上向き法線、風の頂点シェーダ、色ばらつき）、木 140（森エリア優先、幹 + 多面体の樹冠、樹冠に弱い風）、岩 90。配置はキャンプ・水場を避け、傾斜で絞る。glTF へ差し替える際はジオメトリ/マテリアルを渡すだけ |
| `src/presentation/render/DebugPanel.ts` | 空（濁り・レイリー・ミー）、フォグ濃度、高さフォグ、IBL 強度、風の強さを追加 |
| `src/presentation/TerrainView.ts` / `WeatherView.ts` / `SceneRenderer.ts` | 地形マテリアル差し替え、雨の空/フォグ処理を Environment へ移管、高さフォグの一括注入 |

見送り: ゴッドレイ用ボリューム板（Phase 4 のブルームで代替し、必要なら後日）。LOD は InstancedMesh のため未適用（glTF 導入時に three/addons LOD を `Scatter` へ追加）。

確認手順: `?debug=1` → 出発 → 右上パネル「Sky / Fog」「Wind」を操作。雨は F6 ではなく `__game.weather.force('rain')`（コンソール）で即時確認できる。

FPS 影響: 三角形 19 万 → 36 万、ドローコール +12（草・木・岩は各 1 コール）。ペインで 60fps 維持。PMREM 焼き直しは 0.5 秒に 1 回で体感遅延なし。

## Phase 3 — キャラクターとモンスターの glTF パイプライン（完了 2026-09-05）

| 変更ファイル | 内容 |
|---|---|
| `scripts/copy-decoders.mjs` + package.json（predev/prebuild/postinstall） | three の Draco / Basis デコーダを `public/libs/` へコピー（git 管理外、常に three と同版） |
| `src/presentation/render/AssetLoader.ts` | GLTFLoader + DRACOLoader + KTX2Loader。`loadModel(name)` は `assets/models/<name>.glb` を HEAD で確認してから読み、無ければ null。`parseModel(buffer)` でメモリ上の GLB も読める。`tuneMaterials`（envMapIntensity / roughness 一括、皮膚・鱗用に MeshPhysicalMaterial の sheen/clearcoat へ変換）、`fitToHeight` |
| `src/presentation/render/CharacterRig.ts` | AnimationMixer ラッパー。状態 → クリップ名候補の対応表（PLAYER_CLIP_MAP / MONSTER_CLIP_MAP、Mixamo の命名揺れを部分一致で吸収）、0.12〜0.25 秒のクロスフェード、once クリップの再トリガー、複数ファイルのクリップ合成（addClips） |
| `src/presentation/PlayerView.ts` / `MonsterView.ts` | glTF が読めたらプリミティブを隠して差し替え、ゲーム状態からクリップを駆動。当たり判定・移動ロジックは親 Object3D（core の位置/向き）に紐付いたまま。プレイヤーは右手ボーンがあれば武器をそこへ付け替え |
| `tests/presentation/CharacterRig.test.ts` | クリップ解決・状態切替・合成のテスト |

フォールバック: モデル未配置ではこれまでのプリミティブがそのまま動く（本番ページの挙動は不変）。

### モデル差し替え手順
1. リグ済み glTF を用意（Sketchfab / Fab は CC-BY 以上のライセンスを確認。Meshy / Tripo で生成 → Mixamo で自動リグ → Mixamo からモーション付き FBX を書き出し → Blender で glTF 出力）
2. 圧縮:
   ```bash
   npx @gltf-transform/cli optimize ranger.glb ranger.opt.glb --compress draco --texture-compress ktx2
   ```
3. `public/assets/models/ranger.glb`（プレイヤー）、`public/assets/models/valgaron.glb`（モンスター）として配置
4. クリップ名は `CharacterRig.ts` の対応表に部分一致すればよい（例: "Walking", "mixamo.com|Roll"）。無い状態は `rig.missingStates` に溜まるので `?debug=1` で確認
5. 複数の Mixamo モーション（同一スケルトン）は別 glb にして `rig.addClips(gltf.animations)` で合成

## Phase 4 — ポストプロセス（完了 2026-09-05）

| 変更ファイル | 内容 |
|---|---|
| `src/presentation/render/PostFX.ts` | three/addons EffectComposer。順序: Render → GTAO（サンプル数可変）→ UnrealBloom → Bokeh DoF（焦点はプレイヤー距離へ自動追従）→ Grade（ビネット・色収差・グレイン・彩度・影/ハイライトの色寄せを 1 パス）→ SMAA → Output。品質プリセット low / mid / high。`pulseChromatic()` で咆哮時の一瞬の強調（Phase 5 用） |
| `src/presentation/SceneRenderer.ts` | postfx 有効時は composer で描画、無効時は直接描画。リサイズ伝播 |
| `src/presentation/render/DebugPanel.ts` | PostFX フォルダ（プリセット切替・各パス ON/OFF・強度） |
| `src/app/GameManager.ts` | DoF 焦点距離の毎フレーム更新 |
| `Environment.ts` / `Lighting.ts` | コンポーザー前提で再調整（露出 0.85、フォグ 0.0022、高さフォグ 0.1、ミー 0.003、太陽高度 52°、影 0.75、環境光 1.1） |

見送り: モーションブラー（速度バッファが無く、カメラ移動だけの疑似ブラーは残像感が強いため）、LUT ファイル読み込み（数式グレードで代替。`LUTPass` を Grade の前に挟めば対応可能）。

つまずいた点と学び:
- Bloom はトーンマッピング前の HDR 値に掛かる。大気散乱の空は輝度 3〜10 あるため、LDR 前提の閾値 0.9 だと画面全体が白飛びする。閾値 8.0 で太陽とエーテル発光だけが光る
- フォグは three の直接描画では sRGB 変換の後に混ざるが、コンポーザーでは線形空間で混ざるため見た目が濃くなる。密度を約半分に再調整した
- CSM の `setupMaterial` は `onBeforeCompile` を置き換えるので、風・地形ブレンド・高さフォグのフックは CSM の後に連結する（Phase 2 で修正）

FPS 影響（1280×720、開発機のブラウザペイン、ms/フレーム）:
| 構成 | ms |
|---|---|
| ポストプロセス無し | 3〜12（計測ばらつき） |
| low（Grade + Bloom） | 約 10 |
| mid（+ GTAO 6 サンプル + SMAA） | 約 21 |
| high（+ GTAO 10 サンプル + DoF） | 約 37 |

1080p / pixelRatio 2 で 60fps を切る場合は、GTAO → DoF → SMAA の順に落とす（GTAO が最も重い）。Phase 6 で端末判定と実測 FPS から自動選択する。
