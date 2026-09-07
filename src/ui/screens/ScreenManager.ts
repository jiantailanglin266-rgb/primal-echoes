import { wait, type NavAction, type Screen } from './Screen';

const FADE_MS = 320;
const MENU_ITEM = '.pe-menu-item';

/**
 * 画面遷移を一元管理する。
 * - show(id): 現在の画面をフェードアウト → 次をフェードイン（同時に 1 画面）
 * - showOverlay(id): 画面の上に重ねる（静止メニュー・設定）。1 枚まで
 * - キーボード / ゲームパッドの共通ナビ: 矢印で `.pe-menu-item` のフォーカス移動、Enter/A で決定、Esc/B で戻る
 * マウス・タッチは通常の click で動く。
 */
export class ScreenManager {
  private readonly screens = new Map<string, Screen>();
  private current: Screen | null = null;
  private overlay: Screen | null = null;
  private readonly gamepad = new GamepadNav((action) => this.navigate(action));
  /** 遷移中は入力を捨てる。 */
  private busy = false;

  constructor(private readonly parent: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
  }

  register(screen: Screen): void {
    screen.root.hidden = true;
    screen.root.classList.add('pe-screen-anim');
    this.parent.appendChild(screen.root);
    this.screens.set(screen.id, screen);
  }

  get(id: string): Screen {
    const s = this.screens.get(id);
    if (!s) throw new Error(`[screens] unknown screen: ${id}`);
    return s;
  }

  get currentId(): string | null {
    return this.current?.id ?? null;
  }

  get overlayId(): string | null {
    return this.overlay?.id ?? null;
  }

  /** どの画面も出ていない（フィールド中）。 */
  get isClear(): boolean {
    return this.current === null && this.overlay === null;
  }

  async show(id: string | null, options: { instant?: boolean } = {}): Promise<void> {
    if (this.overlay) this.hideOverlay(true);
    const next = id ? this.get(id) : null;
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    this.busy = true;
    if (prev) {
      prev.onLeave?.();
      if (options.instant) prev.root.hidden = true;
      else await fadeOut(prev.root);
    }
    if (next) {
      fadeIn(next.root);
      next.onEnter?.();
      focusFirst(next.root);
    }
    this.busy = false;
  }

  showOverlay(id: string): void {
    const next = this.get(id);
    if (this.overlay === next) return;
    if (this.overlay) {
      this.overlay.onLeave?.();
      this.overlay.root.hidden = true;
    }
    this.overlay = next;
    fadeIn(next.root);
    next.onEnter?.();
    focusFirst(next.root);
  }

  hideOverlay(instant = false): void {
    const prev = this.overlay;
    if (!prev) return;
    this.overlay = null;
    prev.onLeave?.();
    if (instant) prev.root.hidden = true;
    else void fadeOut(prev.root);
    if (this.current) focusFirst(this.current.root);
  }

  /** 毎フレーム呼ぶ（実時間）。ゲームパッドのポーリングと画面の演出更新。 */
  update(dt: number): void {
    if (this.current || this.overlay) this.gamepad.poll(dt);
    this.current?.update?.(dt);
    this.overlay?.update?.(dt);
  }

  /** 入力を受ける画面（オーバーレイ優先）。 */
  private get active(): Screen | null {
    return this.overlay ?? this.current;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const screen = this.active;
    if (!screen || this.busy) return;
    if (screen.onKey?.(event)) {
      event.preventDefault();
      return;
    }
    const action = keyToAction(event);
    if (!action) return;
    // スライダーやテキスト入力には左右キーを渡す
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT') && (action === 'left' || action === 'right')) return;
    if (this.navigate(action)) event.preventDefault();
  };

  private navigate(action: NavAction): boolean {
    const screen = this.active;
    if (!screen || this.busy) return false;
    const items = Array.from(screen.root.querySelectorAll<HTMLElement>(`${MENU_ITEM}:not([disabled])`)).filter((el) => el.offsetParent !== null);
    const focused = document.activeElement as HTMLElement | null;
    const index = focused ? items.indexOf(focused) : -1;
    switch (action) {
      case 'up':
      case 'down': {
        if (items.length === 0) return false;
        const step = action === 'up' ? -1 : 1;
        const next = index < 0 ? (action === 'up' ? items.length - 1 : 0) : (index + step + items.length) % items.length;
        items[next]?.focus();
        return true;
      }
      case 'left':
      case 'right': {
        if (!focused || !screen.root.contains(focused)) return false;
        focused.dispatchEvent(new CustomEvent('pe-nav', { detail: action, bubbles: true }));
        return true;
      }
      case 'activate': {
        if (focused && screen.root.contains(focused)) {
          focused.click();
          return true;
        }
        items[0]?.click();
        return items.length > 0;
      }
      case 'back':
        if (screen.onBack) {
          screen.onBack();
          return true;
        }
        return false;
    }
  }
}

function keyToAction(event: KeyboardEvent): NavAction | null {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'Enter':
    case 'Space':
    case 'NumpadEnter':
      return 'activate';
    case 'Escape':
    case 'Backspace':
      return 'back';
    default:
      return null;
  }
}

function focusFirst(root: HTMLElement): void {
  const preferred = root.querySelector<HTMLElement>(`${MENU_ITEM}.is-default`) ?? root.querySelector<HTMLElement>(`${MENU_ITEM}:not([disabled])`);
  preferred?.focus({ preventScroll: true });
}

function fadeIn(root: HTMLElement): void {
  root.classList.remove('is-leaving');
  root.classList.add('is-entering');
  root.hidden = false;
  // 2 フレーム待ってからクラスを外すと transition が走る
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-entering')));
  // 非表示タブでは rAF が止まるので保険
  window.setTimeout(() => root.classList.remove('is-entering'), 120);
}

async function fadeOut(root: HTMLElement): Promise<void> {
  root.classList.add('is-leaving');
  await wait(FADE_MS);
  root.hidden = true;
  root.classList.remove('is-leaving');
}

/**
 * ゲームパッド → NavAction。標準マッピング（A 決定 / B 戻る / 十字キー・左スティック）。
 * ボタンは立ち上がりだけ、スティックは 0.2 秒間隔でリピート。
 */
class GamepadNav {
  private readonly prev = new Map<number, boolean>();
  private repeat = 0;

  constructor(private readonly emit: (action: NavAction) => void) {}

  poll(dt: number): void {
    if (typeof navigator.getGamepads !== 'function') return;
    const pad = Array.from(navigator.getGamepads()).find((p) => p && p.connected);
    if (!pad) return;
    const pressed = (i: number): boolean => Boolean(pad.buttons[i]?.pressed);
    const edge = (i: number, action: NavAction): void => {
      const now = pressed(i);
      if (now && !this.prev.get(i)) this.emit(action);
      this.prev.set(i, now);
    };
    edge(0, 'activate');
    edge(1, 'back');
    edge(12, 'up');
    edge(13, 'down');
    edge(14, 'left');
    edge(15, 'right');
    edge(9, 'activate'); // Start
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    this.repeat -= dt;
    if (Math.abs(x) < 0.6 && Math.abs(y) < 0.6) {
      this.repeat = 0;
      return;
    }
    if (this.repeat > 0) return;
    this.repeat = 0.22;
    if (Math.abs(y) >= Math.abs(x)) this.emit(y < 0 ? 'up' : 'down');
    else this.emit(x < 0 ? 'left' : 'right');
  }
}
