/**
 * 1 シミュレーションステップ分の生入力。
 * `*Pressed` はそのステップで押された瞬間だけ true（エッジ）、`*Held` は押されている間 true。
 */
export interface InputState {
  /** 左右（-1..1）。右が正。 */
  moveX: number;
  /** 前後（-1..1）。前が正。 */
  moveY: number;
  /** マウス移動量（ピクセル）。ステップごとに消費される。 */
  lookDeltaX: number;
  lookDeltaY: number;
  dashHeld: boolean;
  dodgePressed: boolean;
  lightAttackPressed: boolean;
  heavyAttackPressed: boolean;
  heavyAttackHeld: boolean;
  specialPressed: boolean;
  lockOnPressed: boolean;
  interactPressed: boolean;
  debugHealPlayerPressed: boolean;
  debugToggleInfiniteStaminaPressed: boolean;
  debugKillMonsterPressed: boolean;
  debugResetMonsterPressed: boolean;
}

export function createEmptyInputState(): InputState {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    dashHeld: false,
    dodgePressed: false,
    lightAttackPressed: false,
    heavyAttackPressed: false,
    heavyAttackHeld: false,
    specialPressed: false,
    lockOnPressed: false,
    interactPressed: false,
    debugHealPlayerPressed: false,
    debugToggleInfiniteStaminaPressed: false,
    debugKillMonsterPressed: false,
    debugResetMonsterPressed: false,
  };
}
