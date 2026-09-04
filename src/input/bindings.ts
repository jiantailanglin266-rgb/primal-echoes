/**
 * キー割り当て。KeyboardEvent.code を使い、キーボード配列に依存しない物理位置で判定する。
 * 将来の設定画面ではこのテーブルを差し替える。
 */
export const KEY_BINDINGS = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'ShiftRight'],
  dodge: ['Space'],
  lightAttack: ['KeyJ'],
  heavyAttack: ['KeyK'],
  special: ['KeyL'],
  lockOn: ['Tab', 'KeyQ'],
  interact: ['KeyE'],
  // ---- デバッグ（?debug=1 のときだけ GameManager が処理する）----
  debugHealPlayer: ['F1'],
  debugToggleInfiniteStamina: ['F2'],
  debugKillMonster: ['F3'],
  debugResetMonster: ['F4'],
  debugToggleAiPause: ['F5'],
} as const;

export type BindingAction = keyof typeof KEY_BINDINGS;
