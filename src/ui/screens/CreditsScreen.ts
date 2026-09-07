import { createScreenRoot, q, type Screen } from './Screen';

/** 語り部（クレジット）。文言は i18n（credits.*）。 */
export class CreditsScreen implements Screen {
  readonly id = 'credits';
  readonly root: HTMLElement;
  onBack: (() => void) | null = null;

  constructor() {
    this.root = createScreenRoot('pe-credits', `
      <div class="pe-sub__inner pe-sub__inner--narrow">
        <header class="pe-sub__header">
          <div class="pe-eyebrow" data-i18n="credits.eyebrow"></div>
          <h1 class="pe-heading" data-i18n="credits.title"></h1>
        </header>
        <dl class="pe-credits__list">
          <dt data-i18n="credits.made"></dt><dd data-i18n="brand.studio"></dd>
          <dt data-i18n="credits.design"></dt><dd data-i18n="credits.designText"></dd>
          <dt data-i18n="credits.world"></dt><dd data-i18n="credits.worldText"></dd>
          <dt data-i18n="credits.tech"></dt><dd data-i18n="credits.techText"></dd>
          <dt data-i18n="credits.fonts"></dt><dd data-i18n="credits.fontsText"></dd>
          <dt data-i18n="credits.sound"></dt><dd data-i18n="credits.soundText"></dd>
          <dt data-i18n="credits.thanks"></dt><dd data-i18n="credits.thanksText"></dd>
        </dl>
        <p class="pe-credits__close" data-i18n="credits.close"></p>
        <footer class="pe-sub__foot"><button class="pe-button pe-menu-item pe-sub__back is-default" data-i18n="credits.back"></button></footer>
      </div>`);
    q(this.root, '.pe-sub__back').addEventListener('click', () => this.onBack?.());
  }
}
