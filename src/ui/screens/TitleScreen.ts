import { createScreenRoot, q, type Screen } from './Screen';
import { assetUrl } from '@presentation/render/assetUrl';

/**
 * タイトル画面。背景は 3D シーン（カメラがゆっくり回る）。
 * ロゴは残響のモチーフ（環が外へ広がって消える）とともに現れ、文言「耳を澄ませ」で入力を待つ。
 */
export class TitleScreen implements Screen {
  readonly id = 'title';
  readonly root: HTMLElement;
  private resolveInput: (() => void) | null = null;

  constructor() {
    this.root = createScreenRoot('pe-title', `
      <div class="pe-title__ripples" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="pe-title__logo"><img src="${assetUrl('assets/brand/logo-vertical.svg')}" alt="PRIMAL ECHOES 原初の残響" draggable="false" /></div>
      <div class="pe-title__prompt">
        <div class="pe-title__call">耳を澄ませ</div>
        <div class="pe-title__hint">鍵を押す、または画面に触れる</div>
      </div>
      <div class="pe-title__tagline">原初は、まだ鳴っている。</div>`);
    this.root.addEventListener('pointerdown', () => this.resolveInput?.());
  }

  onEnter(): void {
    this.root.classList.remove('is-ready');
    // ロゴが出てから 1.2 秒後に文言を出す
    window.setTimeout(() => this.root.classList.add('is-ready'), 1200);
  }

  onKey(event: KeyboardEvent): boolean {
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(event.code)) return false;
    if (event.code.startsWith('F') && event.code.length <= 3) return false; // F1〜F12 はデバッグ用
    this.resolveInput?.();
    return true;
  }

  /** 何かの入力があるまで待つ。 */
  waitForInput(): Promise<void> {
    return new Promise((resolve) => {
      this.resolveInput = () => {
        this.resolveInput = null;
        resolve();
      };
    });
  }

  /** ゲームパッドの決定にも反応させる。 */
  onBack = (): void => {
    this.resolveInput?.();
  };

  get logoElement(): HTMLElement {
    return q(this.root, '.pe-title__logo');
  }
}
