/**
 * 画面（全面オーバーレイ）の共通インターフェース。
 * DOM の生成は各画面が持ち、表示・遷移・入力の振り分けは ScreenManager が担う。
 */
export interface Screen {
  readonly id: string;
  readonly root: HTMLElement;
  /** フェードインの直後。 */
  onEnter?(): void;
  /** フェードアウトの直前。 */
  onLeave?(): void;
  /** 戻る操作（Esc / B ボタン）。画面側が差し替えられるようプロパティにする。 */
  onBack?: (() => void) | null;
  /** 生のキー入力。true を返すと共通ナビ（矢印・Enter）を行わない。 */
  onKey?(event: KeyboardEvent): boolean;
  /** 毎フレーム（実時間秒）。カウントアップなどの演出用。 */
  update?(dt: number): void;
}

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'activate' | 'back';

/** 画面の DOM を作る小さなヘルパ。 */
export function createScreenRoot(className: string, html: string): HTMLElement {
  const root = document.createElement('div');
  root.className = `pe-screen ${className}`;
  root.innerHTML = html;
  return root;
}

export function q<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`[screen] element not found: ${selector}`);
  return el;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/** 実時間で待つ（非表示タブでも進む）。 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
