# BALANCE

調整値の記録。値そのものは `src/data/*.json` が正で、本書は **「なぜその値か」** と変更履歴を残す。

## 原則
- コードに Magic Number を書かない。すべて data 化する。
- 変更時は「変更前 → 変更後 / 理由 / 検証方法」を残す。
- 目標体験: 初見 Valgaron 討伐 **15〜20 分**、慣れたプレイヤーで **8〜12 分**。

## シミュレーション
| 項目 | 値 | 根拠 |
|---|---|---|
| fixedDeltaSeconds | 1/60 | 回避無敵フレームを 1F 単位で扱うため |
| maxSubStepsPerFrame | 5 | タブ復帰時の追いつき上限。これ以上は遅れを捨てる |
| maxFrameDeltaSeconds | 0.25 | 同上 |

## プレイヤー（`src/data/balance.json` > player）
| 項目 | 値 | 根拠 |
|---|---|---|
| maxHp / maxStamina | 100 / 100 | 表示上の分かりやすさ。装備で上限が伸びる前提 |
| walkSpeed / dashSpeed | 4.5 / 7.5 m/s | 身長 1.8m の人間の早歩き〜全力走。巨大生物との速度差を出すため走りは控えめ |
| dashStaminaPerSecond | 12 | 満タンから約 8 秒でダッシュ切れ。「追跡は走る、戦闘中は歩く」を促す |
| dashMinStamina | 5 | 残量ゼロ付近で走り出しがチラつくのを防ぐ |
| staminaRegenPerSecond / Delay | 25 / 0.6s | 回避 20 消費 → 約 1.4 秒で回復。連続回避は 5 回でガス欠 |
| dodge.staminaCost | 20 | 満タンで 5 回。無限回避を禁止する主要な制約 |
| dodge.durationSeconds / distance | 0.55s / 4.0m | 重量武器持ちの「転がり」。Valgaron の攻撃範囲（約 3〜5m）をギリギリ抜けられる長さ |
| dodge.invuln 0.04〜0.32s | 無敵 17F | 発生 2F 後から 0.28 秒。硬直後半 0.23 秒は無防備（回避連打の抑制） |
| turnSpeedRadPerSecond | 14 | 約 0.22 秒で反転。反応は良いが瞬間反転ではない |
| gravity | 25 | 実値 9.8 より重くして落下を「ゲーム的に」速める |

## カメラ（`src/data/balance.json` > camera）
| 項目 | 値 | 根拠 |
|---|---|---|
| distance / targetHeight | 6.5 / 1.5 | 巨大生物の全身が入り、かつプレイヤーの足元も見える距離 |
| pitch -0.55〜1.05 rad | | 上を見上げる角度を広めに取る（飛びかかり・大型の頭部確認） |
| followSharpness | 14 | 指数追従。約 0.07 秒で 63% 追従。ダッシュ時でも遅れが目立たない |
| groundMargin / collisionSamples | 0.45 / 12 | 地形めり込み防止。サンプル 12 で 0.54m 刻み |

## Titan Blade（T05 で確定）
未設定。

## Valgaron（T07〜T09 で確定）
未設定。

## 変更履歴
| 日付 | 項目 | 前 → 後 | 理由 |
|---|---|---|---|
| 2026-09-05 | 初版 | - | プロジェクト雛形作成 |
