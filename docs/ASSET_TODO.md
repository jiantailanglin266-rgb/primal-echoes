# ASSET_TODO

プレースホルダーで代用している外部アセットの一覧。
ロジック完成を優先し、ここに記録したものを後から差し替える。
すべて **完全オリジナル** で制作すること（既存作品の流用禁止）。

## 記法
- 状態: `placeholder`（仮で代用中）/ `spec`（仕様だけ決定）/ `wip` / `done`
- 現在の代用: どのプリミティブ／仮素材で動かしているか

## 3D モデル
| ID | 対象 | 状態 | 現在の代用 | 備考 |
|---|---|---|---|---|
| M-001 | プレイヤー（レンジャー）基本体型 | placeholder | カプセル + 板（`presentation/placeholders.ts`） | 将来キャラクリ対応のためモジュール分割（頭/胴/腕/腰/脚） |
| M-002 | Titan Blade | placeholder | 薄い Box | 長さ約 2.0m。チャージ時の発光部を想定 |
| M-003 | Valgaron | placeholder | 未作成（T06 でプリミティブ複合体） | 岩石状甲殻・巨大前脚・長い尾・発達した顎。部位ごとにメッシュ分割必須（head/body/legs×4/tail） |
| M-004 | Grast（草食小型） | placeholder | 未作成 | 群れで行動する小型草食生物 |
| M-005 | Skarv（腐肉食小型） | placeholder | 未作成 | 死骸に集まる |
| M-006 | 翠嵐峡谷 地形・植生 | placeholder | 平面 + グリッド | 高さマップ→本番地形へ |

## アニメーション
| ID | 対象 | 状態 | 備考 |
|---|---|---|---|
| A-001 | プレイヤー 移動/ダッシュ/回避/納刀・抜刀 | placeholder | 手続き的な傾き・移動で代用 |
| A-002 | Titan Blade 攻撃一式（Light×3 / Heavy / Charge 3段 / DodgeAttack） | placeholder | 判定タイミングは AttackData 側が正 |
| A-003 | Valgaron 生態（歩行/走行/食事/飲水/睡眠/咆哮） | placeholder | |
| A-004 | Valgaron 攻撃 6 種 + 怯み/転倒/瀕死/死亡 | placeholder | telegraph が視認できる予備動作を必須にする |

## VFX
| ID | 対象 | 状態 | 備考 |
|---|---|---|---|
| V-001 | ヒットスパーク（斬/打） | placeholder | |
| V-002 | Valgaron 怒り時エーテル発光 | placeholder | 甲殻の隙間が発光する想定 |
| V-003 | 部位破壊・切断の破片 | placeholder | |

## サウンド
| ID | 対象 | 状態 | 備考 |
|---|---|---|---|
| S-001 | 命中 SE（軽/重） | placeholder | 合成音で代用予定 |
| S-002 | Valgaron 咆哮・足音 | placeholder | |
| S-003 | 拠点 / フィールド BGM | spec | オリジナル楽曲 |

## UI
| ID | 対象 | 状態 | 備考 |
|---|---|---|---|
| U-001 | HUD アイコン一式（HP/Stamina/斬れ味/アイテム/大型状態） | placeholder | 独自レイアウト。既存作品の配置を模倣しない |
| U-002 | フォント（欧文ディスプレイ + 和文） | spec | ライセンス確認必須 |
