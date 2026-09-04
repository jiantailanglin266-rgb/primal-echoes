import { Vec3 } from '@shared/math/Vec3';

/**
 * 「プレイヤーが何をしたいか」を core 層向けに解決した入力。
 * キー配置やカメラ相対変換は app/input 層で済ませ、core はデバイスを知らない。
 */
export interface PlayerIntent {
  /** ワールド空間 XZ の移動方向。長さ 0〜1（アナログ入力対応）。 */
  move: Vec3;
  /** ダッシュ保持中。 */
  dash: boolean;
  /** このステップで回避が押された（エッジ）。 */
  dodge: boolean;
  /** このステップで弱攻撃が押された（エッジ）。 */
  lightAttack: boolean;
  /** このステップで強攻撃が押された（エッジ）。 */
  heavyAttack: boolean;
  /** 強攻撃ボタンを保持中（チャージ判定）。 */
  heavyHeld: boolean;
}

export function createEmptyIntent(): PlayerIntent {
  return {
    move: new Vec3(),
    dash: false,
    dodge: false,
    lightAttack: false,
    heavyAttack: false,
    heavyHeld: false,
  };
}

export function clearIntent(intent: PlayerIntent): void {
  intent.move.set(0, 0, 0);
  intent.dash = false;
  intent.dodge = false;
  intent.lightAttack = false;
  intent.heavyAttack = false;
  intent.heavyHeld = false;
}
