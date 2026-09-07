import { createScreenRoot, q, type Screen } from './Screen';

/** 静止（ポーズ）。フィールドの上に重ねる。続ける・設定・狩りを退く。 */
export class PauseScreen implements Screen {
  readonly id = 'pause';
  readonly root: HTMLElement;
  onResume: (() => void) | null = null;
  onSettings: (() => void) | null = null;
  onAbandon: (() => void) | null = null;

  constructor() {
    this.root = createScreenRoot('pe-pause', `
      <div class="pe-pause__inner">
        <div class="pe-eyebrow">Still</div>
        <h1 class="pe-heading">静止</h1>
        <nav class="pe-pause__list">
          <button class="pe-menu-item pe-menu__item is-default pe-pause__resume"><span class="pe-menu__eyebrow">Resume</span><span class="pe-menu__label">続ける</span></button>
          <button class="pe-menu-item pe-menu__item pe-pause__settings"><span class="pe-menu__eyebrow">Settings</span><span class="pe-menu__label">設定</span></button>
          <button class="pe-menu-item pe-menu__item pe-pause__abandon"><span class="pe-menu__eyebrow">Retreat</span><span class="pe-menu__label">狩りを退く</span></button>
        </nav>
      </div>`);
    q(this.root, '.pe-pause__resume').addEventListener('click', () => this.onResume?.());
    q(this.root, '.pe-pause__settings').addEventListener('click', () => this.onSettings?.());
    q(this.root, '.pe-pause__abandon').addEventListener('click', () => this.onAbandon?.());
  }

  onBack = (): void => {
    this.onResume?.();
  };
}
