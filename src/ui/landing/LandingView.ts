import { assetUrl } from '@presentation/render/assetUrl';
import { applyTranslations, getLanguage, setLanguage, t, tList } from '@i18n/index';

const ICONS = assetUrl('assets/brand/icons.svg');

/**
 * ゲーム起動前のランディング（index.html の最初の画面）。
 * ファーストビューは 3D の実シーン（回転カメラ）の上にロゴ・タグライン・「狩りに出る」。
 * 下へスクロールするとコンセプト、世界、獣、操作、動作環境、語り部、更新履歴。
 */
export class LandingView {
  readonly root: HTMLElement;
  onStart: (() => void) | null = null;
  private readonly cta: HTMLButtonElement;
  private ready = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pe-landing';
    this.root.innerHTML = this.template();
    parent.appendChild(this.root);
    this.cta = this.root.querySelector('.pe-landing__cta') as HTMLButtonElement;
    this.cta.addEventListener('click', () => {
      if (this.ready) this.onStart?.();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => {
      b.addEventListener('click', () => {
        setLanguage(b.dataset['lang'] as 'ja' | 'en');
        this.rerender();
      });
    });
    this.root.querySelector('.pe-landing__scroll')?.addEventListener('click', () => {
      this.root.querySelector('.pe-landing__section')?.scrollIntoView({ behavior: 'smooth' });
    });
    applyTranslations(this.root);
    this.syncLanguageButtons();
  }

  /** 準備ができたらボタンを「狩りに出る」にする。 */
  setReady(ready: boolean): void {
    this.ready = ready;
    this.cta.disabled = !ready;
    this.cta.textContent = ready ? t('landing.cta') : t('loading.listening');
  }

  setProgress(label: string): void {
    if (!this.ready) this.cta.textContent = label;
  }

  hide(): void {
    this.root.classList.add('is-leaving');
    window.setTimeout(() => this.root.remove(), 700);
  }

  private rerender(): void {
    const scroll = this.root.scrollTop;
    this.root.innerHTML = this.template();
    applyTranslations(this.root);
    this.syncLanguageButtons();
    (this.root.querySelector('.pe-landing__cta') as HTMLButtonElement).addEventListener('click', () => this.ready && this.onStart?.());
    this.root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLanguage(b.dataset['lang'] as 'ja' | 'en'); this.rerender(); }));
    this.setReady(this.ready);
    this.root.scrollTop = scroll;
  }

  private syncLanguageButtons(): void {
    this.root.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset['lang'] === getLanguage()));
  }

  private template(): string {
    const beasts = ['valgaron', 'yelmoth', 'zarghvane'];
    const controls: [string, string][] = [
      ['W A S D', t('settings.actions.moveForward')],
      ['Shift', t('settings.actions.dash')],
      ['Space', t('settings.actions.dodge')],
      ['J / K', `${t('settings.actions.lightAttack')} / ${t('settings.actions.heavyAttack')}`],
      ['Tab', t('settings.actions.lockOn')],
      ['E', t('settings.actions.interact')],
      ['H', t('settings.actions.useItem')],
      ['Esc', t('settings.actions.pause')],
    ];
    const history = tList('landing.history');
    return `
      <div class="pe-landing__lang"><button data-lang="ja">日本語</button><button data-lang="en">English</button></div>
      <section class="pe-landing__hero">
        <img class="pe-landing__logo" src="${assetUrl('assets/brand/logo-vertical.svg')}" alt="PRIMAL ECHOES" draggable="false" />
        <p class="pe-landing__tagline" data-i18n="brand.tagline"></p>
        <p class="pe-landing__concept" data-i18n="landing.oneLine"></p>
        <button class="pe-landing__cta" disabled></button>
        <div class="pe-landing__requirements" data-i18n="landing.heroNote"></div>
        <button class="pe-landing__scroll" aria-label="scroll"><svg class="pe-icon"><use href="${ICONS}#pe-icon-back"/></svg></button>
      </section>
      <section class="pe-landing__section">
        <div class="pe-eyebrow" data-i18n="landing.conceptEyebrow"></div>
        <h2 class="pe-heading" data-i18n="landing.conceptTitle"></h2>
        <div class="pe-landing__pillars">
          ${[1, 2, 3].map((i) => `<div class="pe-slab pe-landing__pillar"><svg class="pe-icon"><use href="${ICONS}#pe-icon-${['trace', 'blade', 'echo'][i - 1]}"/></svg><h3 data-i18n="landing.pillar${i}Title"></h3><p data-i18n="landing.pillar${i}Text"></p></div>`).join('')}
        </div>
      </section>
      <section class="pe-landing__section pe-landing__section--world">
        <div class="pe-eyebrow" data-i18n="landing.worldEyebrow"></div>
        <h2 class="pe-heading" data-i18n="landing.worldTitle"></h2>
        <p class="pe-landing__prose" data-i18n="landing.worldText"></p>
        <p class="pe-landing__quote" data-i18n="landing.worldQuote"></p>
      </section>
      <section class="pe-landing__section">
        <div class="pe-eyebrow" data-i18n="landing.beastsEyebrow"></div>
        <h2 class="pe-heading" data-i18n="landing.beastsTitle"></h2>
        <div class="pe-landing__beasts">
          ${beasts.map((id) => `<article class="pe-slab pe-landing__beast${id === 'valgaron' ? '' : ' is-soon'}"><div class="pe-landing__beast-title" data-i18n="landing.beasts.${id}.title"></div><h3 data-i18n="landing.beasts.${id}.name"></h3><p data-i18n="landing.beasts.${id}.text"></p>${id === 'valgaron' ? '' : `<span class="pe-landing__soon" data-i18n="landing.soon"></span>`}</article>`).join('')}
        </div>
      </section>
      <section class="pe-landing__section pe-landing__section--two">
        <div>
          <div class="pe-eyebrow" data-i18n="landing.controlsEyebrow"></div>
          <h2 class="pe-heading" data-i18n="landing.controlsTitle"></h2>
          <table class="pe-landing__table">${controls.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
          <p class="pe-landing__note" data-i18n="landing.gamepad"></p>
        </div>
        <div>
          <div class="pe-eyebrow" data-i18n="landing.reqEyebrow"></div>
          <h2 class="pe-heading" data-i18n="landing.reqTitle"></h2>
          <ul class="pe-landing__list">${tList('landing.requirements').map((r) => `<li>${r}</li>`).join('')}</ul>
        </div>
      </section>
      <footer class="pe-landing__footer">
        <div class="pe-landing__footer-grid">
          <div>
            <div class="pe-eyebrow" data-i18n="credits.title"></div>
            <p><span data-i18n="credits.made"></span> — <span data-i18n="brand.studio"></span></p>
            <p><span data-i18n="credits.design"></span> — <span data-i18n="credits.designText"></span></p>
            <p class="pe-landing__note" data-i18n="credits.worldText"></p>
          </div>
          <div>
            <div class="pe-eyebrow" data-i18n="landing.followEyebrow"></div>
            <ul class="pe-landing__list">
              <li><a href="https://github.com/jiantailanglin266-rgb/primal-echoes" target="_blank" rel="noopener">GitHub</a></li>
              <li><a href="https://x.com/" target="_blank" rel="noopener" data-i18n="landing.snsPlaceholder"></a></li>
              <li><a href="docs/presskit/" target="_blank" rel="noopener" data-i18n="landing.presskit"></a></li>
            </ul>
          </div>
          <div>
            <div class="pe-eyebrow" data-i18n="landing.historyEyebrow"></div>
            <ul class="pe-landing__list pe-landing__history">${history.map((h) => `<li>${h}</li>`).join('')}</ul>
          </div>
        </div>
        <p class="pe-landing__close" data-i18n="brand.tagline"></p>
      </footer>`;
  }
}
