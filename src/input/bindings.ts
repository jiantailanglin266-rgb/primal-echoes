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
} as const;

export type BindingAction = keyof typeof KEY_BINDINGS;
