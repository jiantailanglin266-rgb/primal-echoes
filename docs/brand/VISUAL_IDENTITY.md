# PRIMAL ECHOES — VISUAL IDENTITY（B2）

前提: `BRAND_BIBLE.md`（畏怖 / 痕跡 / 静寂、5 原則）。実装トークンは `src/ui/tokens.css`、資産は `public/assets/brand/`、一覧は `docs/brand/styleguide.html`（開発サーバで `/docs/brand/styleguide.html`）。

---

## 1. カラーシステム

世界の素材から採る。黒曜石・玄武岩（地）、骨（文字）、古金（遺物）、苔（生）、緑青（残響）、赤鉄（血と火）。彩度は全体に低く、金だけが「光る」。

### 1.1 パレット
| 役割 | 名前 | HEX | 由来 |
|---|---|---|---|
| ニュートラル 最深 | obsidian | `#0b0c0a` | 黒曜石。画面の最も深い背景 |
| ニュートラル 背景 | basalt | `#15171a` | 玄武岩。標準背景 |
| ニュートラル 面 | slate | `#22252a` | 板岩。パネル |
| ニュートラル 線 | ash | `#3b3e42` | 灰。無彩の罫線・非活性 |
| テキスト | bone | `#e6dfcf` | 骨。本文 |
| テキスト 弱 | bone-dim | `#a39c8c` | 古い骨。補足 |
| テキスト 微 | bone-faint | `#6f6a5f` | 影の中の文字 |
| **プライマリ** | **gold** | **`#c9a962`** | 古金。唯一のアクセント。ロゴ・見出し・選択 |
| プライマリ 深 | gold-deep | `#8f7538` | 影の金。枠線・非活性の金 |
| プライマリ 淡 | gold-pale | `#e7d7a8` | ホバー・発光の芯 |
| **セカンダリ** | **moss** | **`#6f8a5a`** | 苔。生命・HP・回復 |
| セカンダリ 深 | moss-deep | `#3f5236` | 苔の影 |
| **アクセント 2** | **verdigris** | **`#5f8a86`** | 緑青。残響（エコー）属性・レア |
| 危険 | oxblood | `#8c3a2f` | 赤鉄。瀕死・警告の面 |
| 打撃 | ember | `#d1663f` | 熾火。会心・部位破壊・低 HP の線 |
| スタミナ | sand | `#cdb883` | 砂。スタミナ |

### 1.2 用途別トークン（`tokens.css`）
| トークン | 値 | 用途 |
|---|---|---|
| `--pe-bg` / `--pe-bg-deep` | basalt / obsidian | 背景 |
| `--pe-bg-panel` / `--pe-bg-hud` / `--pe-bg-screen` | 半透明の basalt / obsidian | パネル・HUD・全画面オーバーレイ |
| `--pe-line` / `--pe-line-strong` | bone 14% / 32% | 罫線 |
| `--pe-text` / `--pe-text-dim` / `--pe-text-faint` | bone 系 | 文字 3 階調 |
| `--pe-accent` / `--pe-accent-hover` / `--pe-accent-deep` | gold 系 | 強調・選択・ロゴ |
| `--pe-hp` / `--pe-hp-low` / `--pe-hp-ghost` | moss / ember / bone 35% | HP バー・低 HP・遅延バー |
| `--pe-stamina` | sand | スタミナ |
| `--pe-danger` / `--pe-strike` | oxblood / ember | 警告面・打撃 |
| `--pe-echo` | verdigris | 残響属性・IBL の色味の基準 |
| `--pe-beast` | `#b0654f` | 獣の HP・名前 |
| `--pe-damage` / `-crit` / `-break` | bone 淡 / `#e9a352` / ember | ダメージ数字 |
| `--pe-rarity-common / uncommon / rare / epic` | bone-dim / moss / verdigris / gold | レア度 4 段階 |

原則: コンポーネントに HEX を書かない。新しい色が要るときはトークンを増やし、この表に追記する。

### 1.3 LUT（カラーグレーディング）の方向性 → CG Phase 4 へ
- 影を **緑青（verdigris）** へ、ハイライトを **古金（gold-pale）** へ寄せる 2 トーン。中間調は触らない。
- 彩度は基準の 0.9。空と苔の緑だけが色を持ち、岩と土は無彩に近づける。
- 黒は浮かせない（リフトを上げない）。最暗部は obsidian。
- 雨天は全体を basalt 寄りに沈め、金の発光（残響・ロゴ）だけを残す。
- 現行 `PostFX.ts` の Grade は shadowTint `(0.86, 0.96, 1.0)` → **`(0.84, 0.95, 0.93)`（緑青）**、highlightTint `(1.0, 0.96, 0.88)` → **`(1.0, 0.95, 0.82)`（古金）** に更新する（B3 で反映）。

---

## 2. タイポグラフィ

| 役割 | 書体 | ウェイト | 用途 |
|---|---|---|---|
| ディスプレイ（欧文） | **Cinzel** | 600 / 700 | ロゴ周辺、eyebrow、討伐名、章タイトル。大文字＋広い字間 |
| 本文・和文見出し | **Shippori Mincho** | 400 / 500 / 700 | 本文、ボタン、説明、和文の見出し。明朝で「古い記録」の声 |
| 数値（HUD） | **Cormorant Garamond** | 600 / 700 | タイマー、討伐時間、ダメージ、カウントアップ。`font-variant-numeric: lining-nums tabular-nums` |
| 補助（開発） | Cascadia Mono 等 | | デバッグ表示のみ。プレイヤーには見せない |

読み込み: Google Fonts（`index.html`、`display=swap`）。フォールバックは `tokens.css` のスタックに従う（Times / 游明朝 / Hiragino Mincho）。ロゴはフォントに依存しないようアウトライン化済み SVG を使う。

### 2.1 サイズスケール（1.25 倍）
| トークン | px | 用途 |
|---|---|---|
| `--pe-fs-xs` | 11 | eyebrow、バッジ |
| `--pe-fs-sm` | 13 | 補足、HUD の小文字 |
| `--pe-fs-md` | 15 | 本文、ボタン |
| `--pe-fs-lg` | 19 | 小見出し |
| `--pe-fs-xl` | 24 | 見出し |
| `--pe-fs-2xl` | 30 | タイマー |
| `--pe-fs-3xl` | 38 | 画面タイトル |
| `--pe-fs-display` | 56 | 討伐した獣の名前、タイトル画面の文言 |

### 2.2 字間・行間
- 欧文ディスプレイ: 大文字、字間 `0.28em`（`--pe-ls-display`）。eyebrow は `0.34em`。
- ボタン: 字間 `0.18em`。和文は `0.04em`。
- 本文行間 `1.8`、見出し `1.2`。
- 和文の見出しは **1 行 12 字以内** で折り返さない。長い文は本文サイズに落とす。
- 数字は言葉より一段小さいサイズを基本にし、討伐時間だけは `--pe-fs-display`。

---

## 3. ロゴ

資産（`public/assets/brand/`）:
| ファイル | 内容 |
|---|---|
| `logo.svg` | 横組み。シンボル（金）＋ワードマーク（金）＋副題『原初の残響』（骨色） |
| `logo-mono.svg` | 横組み単色。`currentColor` で任意の 1 色に |
| `logo-vertical.svg` | 縦組み。シンボル上、ワードマーク下 |
| `wordmark.svg` | 文字のみ（単色） |
| `symbol.svg` / `symbol-gold.svg` | シンボル単体（単色 / 金） |
| `favicon.svg` | 暗い角丸の板にシンボル |

### 3.1 ワードマーク
- Cinzel 650 相当をアウトライン化。字間 0.16em。副題は Shippori Mincho Medium、字間 0.42em、ワードマーク幅に対して中央。
- 文字は書体ファイルに依存しない（パス埋め込み）。

### 3.2 シンボル「裂かれた残響」
- 三重の環（内側ほど太く、外へ薄れる＝減衰する残響）を、三条の爪痕が斜め 38° に断つ。中心に一点（原初）。
- 意味: 世界に鳴り続ける残響と、それに刻まれた獣の痕跡。ロードでは環が満ちていく演出に使う（B3）。
- 単色で成立する。塗りと線の比率は固定。

### 3.3 使用規定
- 最小サイズ: 横組み 幅 160px、縦組み 幅 120px、シンボル単体 16px（favicon）。
- 余白: 四方にシンボル直径の 1/2 以上。
- 背景: obsidian / basalt、または写真の暗部。明るい背景では `logo-mono.svg` を basalt で。
- 禁止: 変形（縦横比変更・斜体化）、色の変更（金・骨・単色以外）、影・グロー・グラデーションの追加、ワードマークの書体差し替え、シンボルと文字の位置関係の変更、副題の削除（縦組みの小サイズのみ可）。

---

## 4. アイコン言語

- 線画、24×24、線幅 1.5、丸い端点と結合、塗りなし。角はわずかに丸める。
- 石に刻んだ記号、または野帳の図。可愛さ・光沢・立体感は持たせない。
- 色は文脈の文字色（`currentColor`）。金は選択中と重要事項のみ。
- 資産: `public/assets/brand/icons.svg`（`<symbol id="pe-icon-〜">` のスプライト、34 種）。使用は `<svg><use href="assets/brand/icons.svg#pe-icon-hp"/></svg>`。
- 必須 20 種: hp / stamina / blade / saber / hammer / bow / potion / material / core / trace / echo / hunt / forge / journal / map / compass / timer / rain / sun / cave。追加 14 種: roar / break / sever / settings / sound / pause / close / check / gamepad / keyboard / mouse / photo / back / twin / lance。

---

## 5. グラフィック言語

### 5.1 ルール
- **罫線**: 1px、bone 14%。強調は 32%。二重線・太線・角丸の大きい枠は使わない。
- **枠**: 角丸 2px。パネルは basalt 86% の面に 1px 罫線。四隅に短い金の「刻み」（4px）を置くのが本作の枠の印（下記 CSS）。
- **質感**: 石板は面の上に微細なノイズ（SVG feTurbulence、不透明度 4%）を重ねる。革・金属は表現しない。質感は 1 種類だけ。
- **装飾**: 見出しの下に 24px の短い金の線。それ以上の飾りは置かない。
- **光**: 発光は金のみ。`box-shadow: 0 0 24px rgba(201,169,98,0.18)` を上限とする。
- **動き**: `--pe-ease` で 320ms。出現はフェード＋4px の上昇。点滅・バウンド・スライドインは禁止。

### 5.2 CSS 実装例
```css
/* 石板パネル: 面 + 罫線 + 四隅の刻み + 微細ノイズ */
.pe-slab {
  position: relative;
  background: var(--pe-bg-panel);
  border: 1px solid var(--pe-line);
  border-radius: var(--pe-radius);
}
.pe-slab::before,
.pe-slab::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border: 1px solid var(--pe-accent-deep);
}
.pe-slab::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.pe-slab::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }

/* 見出し: 欧文 eyebrow + 和文見出し + 短い金の線 */
.pe-eyebrow { font: 600 var(--pe-fs-xs)/1 var(--pe-font-display); letter-spacing: var(--pe-ls-eyebrow); color: var(--pe-accent); text-transform: uppercase; }
.pe-heading { font: 500 var(--pe-fs-xl)/var(--pe-lh-tight) var(--pe-font-body); color: var(--pe-text); }
.pe-heading::after { content: ''; display: block; width: 24px; height: 1px; margin-top: 10px; background: var(--pe-accent); }

/* ボタン: 透明面 + 金の細枠。primary は金の面 */
.pe-button { font: 500 var(--pe-fs-md)/1 var(--pe-font-body); letter-spacing: var(--pe-ls-button); padding: 12px 22px; color: var(--pe-accent); background: transparent; border: 1px solid var(--pe-accent-deep); border-radius: var(--pe-radius); transition: color var(--pe-dur-fast) var(--pe-ease), border-color var(--pe-dur-fast) var(--pe-ease); }
.pe-button:hover { color: var(--pe-accent-hover); border-color: var(--pe-accent); }
.pe-button-primary { color: var(--pe-text-on-accent); background: var(--pe-accent); }
```

### 5.3 やってはいけない
- ゲーミング風ネオン、青白い発光、レインボー。
- 丸ゴシック、ポップ体、太い欧文サンセリフの見出し。
- グラデーションの多用（許すのは画面オーバーレイの上下 1 本のみ）。
- 角丸 8px 以上のカード、ドロップシャドウの重ね、ガラス風のぼかし枠。
- 赤い点滅、黄色の警告三角、感嘆符アイコン。
- 金以外の 2 色目のアクセント（緑青は「残響」の意味があるときだけ）。
