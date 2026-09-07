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
        <div class="pe-eyebrow" data-i18n="pause.eyebrow"></div>
        <h1 class="pe-heading" data-i18n="pause.title"></h1>
        <nav class="pe-pause__list">
          <button class="pe-menu-item pe-menu__item is-default pe-pause__resume"><span class="pe-menu__eyebrow" data-i18n="pause.resumeEyebrow"></span><span class="pe-menu__label" data-i18n="pause.resume"></span></button>
          <button class="pe-menu-item pe-menu__item pe-pause__settings"><span class="pe-menu__eyebrow" data-i18n="pause.settingsEyebrow"></span><span class="pe-menu__label" data-i18n="pause.settings"></span></button>
          <button class="pe-menu-item pe-menu__item pe-pause__abandon"><span class="pe-menu__eyebrow" data-i18n="pause.retreatEyebrow"></span><span class="pe-menu__label" data-i18n="pause.retreat"></span></button>
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
