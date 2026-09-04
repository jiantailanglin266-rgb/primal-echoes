import { KEY_BINDINGS, type BindingAction } from './bindings';
import { createEmptyInputState, type InputState } from './InputState';

/**
 * キーボード + マウスから InputState を生成する。
 * ブラウザイベントは非同期に届くので、ここで蓄積し、
 * シミュレーションステップごとに `poll()` でまとめて取り出す。
 * エッジ入力（押した瞬間）は poll で消費され、次の poll では false に戻る。
 */
export class KeyboardMouseInput {
  private readonly held = new Set<string>();
  private readonly pressedSinceLastPoll = new Set<string>();
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private attached = false;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('click', this.onCanvasClick);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('click', this.onCanvasClick);
  }

  poll(): InputState {
    const state = createEmptyInputState();
    state.moveX = this.axis('moveRight', 'moveLeft');
    state.moveY = this.axis('moveForward', 'moveBackward');
    state.dashHeld = this.isHeld('dash');
    state.heavyAttackHeld = this.isHeld('heavyAttack');
    state.dodgePressed = this.wasPressed('dodge');
    state.lightAttackPressed = this.wasPressed('lightAttack');
    state.heavyAttackPressed = this.wasPressed('heavyAttack');
    state.specialPressed = this.wasPressed('special');
    state.lockOnPressed = this.wasPressed('lockOn');
    state.interactPressed = this.wasPressed('interact');
    state.debugHealPlayerPressed = this.wasPressed('debugHealPlayer');
    state.debugToggleInfiniteStaminaPressed = this.wasPressed('debugToggleInfiniteStamina');
    state.debugKillMonsterPressed = this.wasPressed('debugKillMonster');
    state.debugResetMonsterPressed = this.wasPressed('debugResetMonster');
    state.debugToggleAiPausePressed = this.wasPressed('debugToggleAiPause');
    state.debugForceEnragePressed = this.wasPressed('debugForceEnrage');
    state.lookDeltaX = this.lookDeltaX;
    state.lookDeltaY = this.lookDeltaY;

    this.pressedSinceLastPoll.clear();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return state;
  }

  private axis(positive: BindingAction, negative: BindingAction): number {
    return (this.isHeld(positive) ? 1 : 0) - (this.isHeld(negative) ? 1 : 0);
  }

  private isHeld(action: BindingAction): boolean {
    return KEY_BINDINGS[action].some((code) => this.held.has(code));
  }

  private wasPressed(action: BindingAction): boolean {
    return KEY_BINDINGS[action].some((code) => this.pressedSinceLastPoll.has(code));
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Tab でフォーカスが飛ぶ / F キーでブラウザ機能が動くとゲーム入力が奪われるため抑止する
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('F')) e.preventDefault();
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressedSinceLastPoll.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private readonly onBlur = (): void => {
    // ウィンドウを離れた瞬間のキーは keyup が届かないので全解除する
    this.held.clear();
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isPointerLocked) return;
    this.lookDeltaX += e.movementX;
    this.lookDeltaY += e.movementY;
  };

  private readonly onCanvasClick = (): void => {
    if (!this.isPointerLocked) {
      void this.canvas.requestPointerLock();
    }
  };
}
