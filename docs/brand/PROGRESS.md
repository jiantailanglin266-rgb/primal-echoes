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
