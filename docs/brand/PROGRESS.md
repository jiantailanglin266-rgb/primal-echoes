# ブランディング進捗（B0〜B8）

各フェーズの成果物と、けん君が判断すべき点。基準は `BRAND_BIBLE.md`、見た目は `VISUAL_IDENTITY.md`。

## B0 監査 / B1 ブランドコア（2026-09-07、承認済み）
- `BRAND_AUDIT.md`、`BRAND_BIBLE.md`。推奨案をすべて採用（タイトル維持＋副題、タグライン案 2、残響／原獣／狩人、武器和名、UI 語、翠嵐前哨、仮スタジオ名 Hollow Signal）。

## B2 ビジュアルアイデンティティ（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `docs/brand/VISUAL_IDENTITY.md` | パレット、トークン、LUT 方針、書体、ロゴ規定、アイコン言語、グラフィック言語 |
| `src/ui/tokens.css` | CSS 変数（色・用途別・レア度・書体・サイズ・間隔・動き） |
| `public/assets/brand/logo.svg` ほか（logo-mono / logo-vertical / wordmark / symbol / symbol-gold / favicon） | Cinzel と Shippori Mincho をアウトライン化したワードマーク、シンボル「裂かれた残響」 |
| `public/assets/brand/icons.svg`（+ `icons-preview.html`） | 線画アイコン 35 種のスプライト |
| `docs/brand/styleguide.html` | 一枚見本（開発サーバで `/docs/brand/styleguide.html`） |
| `index.html` | Google Fonts、favicon、description、theme-color |
| `src/presentation/render/PostFX.ts` | グレードの影＝緑青、ハイライト＝古金へ |

## B3 タイトル画面と画面遷移（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `src/ui/screens/ScreenManager.ts` | 画面の登録・フェード遷移（320ms）・オーバーレイ・キーボード／ゲームパッド共通ナビ（矢印/WASD・Enter/A・Esc/B、`.pe-menu-item` のフォーカス移動） |
| `src/ui/screens/StudioScreen.ts` | 起動時のスタジオ名（2 秒、入力で短縮） |
| `src/ui/screens/TitleScreen.ts` | 3D 背景（回転カメラ、狩人と獣は非表示）＋縦組みロゴ＋残響の環＋「耳を澄ませ」 |
| `src/ui/screens/MenuScreen.ts` | 狩りに出る／図鑑／設定／語り部。左寄せ・大余白・ホバーで金線と小さな音 |
| `src/ui/screens/LoadingScreen.ts` | 環が内側から満ちる進捗、断片テキスト（仮 5 本、B5 で 30 本） |
| `src/ui/screens/ResultScreen.ts` | 討伐: 獣の名を大きく、討伐まで／与えた傷／受けた傷／膝をついた をカウントアップ。帰還: 「失敗」と言わず「再び向かう」を最短導線に |
| `src/ui/screens/SettingsScreen.ts` | 画質（低／中／高、QualityManager 連動）、音量、操作表、言語（日本語／English、B5 で反映） |
| `src/ui/screens/CodexScreen.ts` / `CreditsScreen.ts` / `PauseScreen.ts` | 図鑑（未遭遇は「記録なし」）、語り部、静止（続ける／設定／狩りを退く） |
| `src/ui/styles/screens.css` | 全画面のスタイル（トークンのみ使用） |
| `src/ui/HubView.ts` | 前哨の文言を BRAND_BIBLE に合わせ、画面システムに登録 |
| `src/presentation/CameraRig.ts` | `setOrbit()`（タイトル・メニュー背景の回転カメラ） |

削除: `ResultView.ts` / `PauseMenuView.ts` / `LoadingView.ts`。

流れ: ローディング → スタジオ → タイトル（入力待ち）→ メニュー → 前哨 → 狩り → 討伐／帰還 → 前哨。`?skipIntro=1` または `?bot=1` でオープニングを飛ばす。

スクリーンショット取得手順:
1. `npm run dev` → `http://localhost:5173/`（デバッグ表示を消すには `?debug=0` のまま）
2. ローディング: 起動直後 0〜3 秒。スタジオ: 3〜5 秒。タイトル: 入力するまで
3. メニュー: 任意のキー。設定・図鑑・語り部: メニュー項目
4. 前哨: 「狩りに出る」。討伐画面: `?debug=1` で F7 → F3 → 帰還を待つ（またはコンソールで `__game.quest.returnRemaining = 0`）。帰還画面: 狩り中に Esc → 狩りを退く
5. ブラウザの幅 1280×720 以上で撮る（狭い幅では前哨が 1 列になる）

けん君が決めること:
- スタジオ名（現在は仮の **Hollow Signal**。`src/app/GameManager.ts` の `STUDIO_NAME`）
- タイトルの文言「耳を澄ませ」／補助「鍵を押す、または画面に触れる」
- メニュー項目名「狩りに出る／図鑑／設定／語り部」（「語り部」＝クレジット）
- 討伐画面の数字の名前「討伐まで／与えた傷／受けた傷／膝をついた」
- ローディングの進捗ラベル（大陸を起こす → 痕跡を辿る → 空を写す → 刃を研ぐ → 目を慣らす → 耳を澄ませた）

見送り: BGM のフェードイン（B6 で音が入ってから）。タッチ操作は click で動くが、フィールドの操作系（仮想パッド）は範囲外。

## B4 インゲーム HUD（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `src/ui/hud/HudView.ts` | 左上 = 刃アイコン・体力（細く長く、減少は遅延バーの残像）・気力・膝（残数の菱形）。右上 = 古地図風の方位帯（N/E/S/W の目盛り、獣と前哨の印、金の針）・刻限・目標（雨アイコン）。上中央 = 獣の登場演出（二つ名＋名前を大きく、3 秒で消え小さな体力へ）。下中央 = 通知・手元の案内・薬の枠（アイコン・残数・キー）。下中央の少し上 = 一行バナー（1.5 秒）。右下 = 初回だけの手引き（24 秒、モーダル無し） |
| `src/ui/hud/DamageNumberView.ts` | 近い位置に続けて出る数字は段と横位置をずらして重ねない。会心は色と大きさを変える |
| `src/ui/hud/HudDebug.ts` | `?hud=1` で HUD の全状態を確認（右のボタンで切替、方位帯は自動で回る） |
| `src/ui/styles/hud.css` | トークンのみ。低体力は画面端の赤いビネットを心拍でゆっくり脈動（点滅させない）。気力切れはバーが熾火色＋小さな警告音。16:9 / 21:9 / 縦画面の分岐 |
| `src/app/GameManager.ts` | 部位破壊・切断・討伐・新しい土地・狩りの開始をバナーへ。獣の初認識で登場演出。方位の計算（北 = +Z）。初回の手引き（localStorage `pe.tutorialSeen`） |
| `src/data/fields/verdant_tempest.json` | エリア名を前哨／苔の谷底／白瀬／獣の寝床に |

設計原則の適用: 同時に見せる要素は最大 5（自分・方位と刻限・獣・薬と案内・バナー）。旧 HUD の右下モンスターパネルと上中央の通知ピルは廃止。「力尽き n/3」は「膝 ◆◆◆」に。

`?hud=1` の使い方: `http://localhost:5173/?hud=1` を開き、右のボタン（通常／低体力／体力減少／気力切れ／獣 登場／獣 怒り／剥ぎ取り／案内／膝をつく／通知／バナー／ダメージ／雨・刻限／手引き）で状態を切り替える。ゲームは起動しないので画面幅を変えながら崩れを確認できる。

けん君が決めること: 手引きの文言（6 行）、方位帯の前哨アイコン（現在は洞窟アイコンを代用。前哨のアイコンを B2 のスプライトに足すか）。

## B5 ゲーム内テキストと i18n（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `src/i18n/ja.json` / `en.json` | 全テキスト 288 項目（UI 文言、ローディングの断片 30 本、討伐・帰還の一言 各 5 パターン×4、図鑑、エリア紹介 100 字と一行キャッチ、素材説明、語り部、初回の手引き） |
| `src/i18n/index.ts` | `t()`（`{name}` 置換）、`tPick()`（複数パターンから乱択）、`tList()`、`dataName()`（データ定義の表示名を辞書で上書き）、`setLanguage()`（保存＋`data-i18n` 要素の一括差し替え＋購読者へ通知） |
| `docs/brand/COPY_DECK.md` | 全テキストの対訳一覧（`node scripts/copy-deck.mjs` で JSON から生成。ここで読み、JSON を直す） |
| `src/data/**` | 表示名を BRAND_BIBLE に統一（巨断刀／裂空剣／砕岩槌、技名の漢字化、角／甲殻、残響核／残響片、蘇生薬、崩れ岩棚、獣の攻撃名）。属性 id `aether` → `echo`、素材 id `aether_*` → `echo_*`（保存データは読み込み時に読み替え） |
| `src/ui/**`, `src/app/GameManager.ts` | コード内の日本語リテラルを排し、静的ラベルは `data-i18n`、動的文字列は `t()` / `dataName()`。HUD の目標行は core の文言を使わず状態から組む |
| `docs/GAME_DESIGN.md`, `README.md` | 用語（原獣／残響／狩人／前哨）を更新 |

校正: 禁止表現（感嘆符、クエスト、ミッション、ボス、敵、失敗、死亡、セーブ、ロード、クリア、プレイヤー）と一文 42 字超を機械照合し、違反 0。数字と単位の間は半角スペース、漢字の開き方は規約どおり。

言語切替: 設定 → 言語 で即時反映（メニュー・設定・前哨・HUD・討伐画面を確認済み）。`localStorage pe.lang` に保存。

けん君が読むもの: `docs/brand/COPY_DECK.md` を通読し、直したい行を JSON に反映（キー名で検索できる）。特に 30 本の断片テキストと、討伐・帰還の一言 20 本は好みが出る箇所。

## B6 サウンドアイデンティティ（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `docs/brand/SOUND_DIRECTION.md` | 方向性（BGM は環境音主体・層の音量で遷移、SE は石・骨・革、サウンドロゴ 2 秒、無音でも成立）、実装、素材の置き場と入手手順 |
| `src/audio/AudioEngine.ts` | AudioContext、バス（music / sfx / ambience → master）、初回操作で解錠、素材の読み込み（無ければ合成） |
| `src/audio/synth.ts` | ノイズ層・正弦波層、風・ドローン・素材のループ、フェード |
| `src/audio/Sfx.ts` | 効果音 17 種（矩形波を使わない合成レシピ、ピッチ揺らぎ ±3〜12%、間引き）。素材があれば差し替え |
| `src/audio/Music.ts` | 4 層（bed / pulse / strings / drums）を場面と激しさで混ぜる。合成の太鼓は BPM 72 の 2 小節パターンを先読み予約 |
| `src/audio/Ambience.ts` | エリア別の風・虫・水・洞・雨。雨は虫を黙らせる |
| `src/audio/AudioManager.ts` | 窓口。`play` / `playLogo` / `setMusic` / `setAmbience` / 音量 3 系統 / `update` |
| `src/app/GameManager.ts` | 場面→音（タイトル／探索／戦闘＋怒り／討伐）、エリアと雨→環境音、足音・回避・薬の音、最初の入力でサウンドロゴ |
| `src/ui/screens/SettingsScreen.ts`, `src/core/save/SaveManager.ts` | 音量を 全体／音楽／効果音 の 3 つに。保存に持つ |
| `tests/audio/mixers.test.ts` | 層の音量表・フェード秒・環境音表・ピッチ幅・矩形波禁止・音の長さ |

削除: `src/presentation/AudioManager.ts`。

制約: ブラウザはユーザー操作の前に音を出せないため、サウンドロゴは「タイトルで最初の鍵を押した瞬間」に鳴る（タイトル表示と同時には鳴らせない）。素材ファイルが無い状態でもすべて合成音で鳴り、無音でも視覚の手応え（Hit Stop・火花・バナー・色収差）で進行できる。

けん君が決めること: 素材音源を入れるか（入れるなら `public/assets/audio/` の命名に従い、README の出典欄へ）。合成音のままでも成立するが、太鼓と咆哮は素材にすると質感が一段上がる。

## B7 ローンチ資産（2026-09-07）
成果物:
| ファイル | 内容 |
|---|---|
| `src/ui/landing/LandingView.ts`, `src/ui/styles/landing.css` | `index.html` の最初の画面。ファーストビューは 3D の実シーン（回転カメラ）＋縦組みロゴ＋タグライン＋「狩りに出る」。下へ: コンセプト 3 柱、世界、原獣 3 体（1 体＋近日 2 体）、操作、動作環境、語り部・導線・更新履歴。日本語／English 切替。準備中はボタンが進捗ラベルになる |
| `index.html` | OGP（og:title / description / image 1200×630 / url / locale）、Twitter Card（summary_large_image）、canonical、apple-touch-icon |
| `public/assets/brand/og-image.png`, `key-visual.jpg`, `apple-touch-icon.png`, `icon-512.png` | PIL で生成（Cinzel / Shippori Mincho をアウトライン描画、シンボルを再現） |
| `src/tools/FreeCamera.ts`, `src/tools/PhotoMode.ts` | `?photo=1`: HUD と画面を消し、自由カメラ（ドラッグ／W A S D／Q E／Shift）。道具箱: 撮る ×2 / ×4（PNG を新しいタブで開き、保存リンクも出す）、獣を呼ぶ（AI 停止）、雨、太陽の高さと方位、H で道具箱を隠す |
| `src/tools/TrailerCam.ts`, `docs/brand/TRAILER_STORYBOARD.md` | 60 秒・9 カットの絵コンテと、それを再生するカメラパス（`?trailer=1`）。黒帯、一行の文字入れ、獣の配置、音楽の山（獣の登場で drums、山場で heat 1、寝床で resolve）、最後にロゴカード。Space 停止、R 最初から、数字でカットへ |
| `README.md` | 全面刷新: キービジュアル、ワンライン、プレイ URL、特徴、操作、動作環境、技術構成、開発、アセット、ドキュメント、クレジット、ライセンス |
| `docs/presskit/README.md` | 作品概要、ファクトシート、特徴、ロゴ一覧、スクリーンショットの置き場と撮り方、引用可能な一文、連絡先（`{{ 連絡先 }}`） |
| `src/app/GameManager.ts` | `enterBackdrop()`（画面なし＋回転カメラ）、`enterToolMode()`、`captureScreenshot(scale)`（pixelRatio を一時的に上げて描き PNG に）、`world` の窓口 |

起動の流れ（既定）: ランディング（裏で読み込み。ボタンが「狩りに出る」になる）→ スタジオ → メニュー。`?landing=0` で従来のローディング → スタジオ → タイトル → メニュー。

### 公開前チェックリスト
| 項目 | 状態 | 確認方法 |
|---|---|---|
| ランディングの表示崩れ（1280 / 800 / 縦） | 確認済み（狭幅は 1 列） | ブラウザ幅を変えて `/` を開く |
| OGP の検証 | 未（デプロイ後） | https://cards-dev.twitter.com/validator 相当、または Slack / Discord に URL を貼る。`og:image` は絶対 URL |
| favicon / apple-touch-icon | 確認済み | タブとホーム追加 |
| モバイル動作 | 表示は確認済み、操作は未対応（キーボード前提） | iOS Safari / Android Chrome で `/` を開く。画質「低」で起動する |
| 言語切替 | 確認済み | ランディング右上 |
| `?photo=1` の保存 | ブラウザペインではダウンロードが無効。実ブラウザで確認 | 撮る ×2 → 新しいタブに PNG |
| `?trailer=1` | カメラパスは確認。録画は OBS 等 | 1920×1080 で再生 |
| 連絡先・SNS | 未（プレースホルダ） | `docs/presskit/README.md` の `{{ 連絡先 }}`、`landing.snsPlaceholder` |
| スタジオ名 | 仮（Hollow Signal） | `src/i18n/*.json` の `brand.studio` |

けん君が決めること: 連絡先、SNS の URL、スタジオ名、プレスキットのスクリーンショット 6 枚（`?photo=1` で撮る）、トレーラーの実プレイ差し替え（カット 6）。
