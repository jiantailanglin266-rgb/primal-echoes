import { createScreenRoot, type Screen } from './Screen';

export interface MenuActions {
  hunt: () => void;
  codex: () => void;
  settings: () => void;
  credits: () => void;
}

const ITEMS: (keyof MenuActions)[] = ['hunt', 'codex', 'settings', 'credits'];

/** メインメニュー。項目は左寄せ、余白を大きく。ホバー／フォーカスで左の金線が伸び、小さな音が鳴る。文言は i18n。 */
export class MenuScreen implements Screen {
  readonly id = 'menu';
  readonly root: HTMLElement;
  onHover: (() => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(actions: MenuActions, version: string) {
    this.root = createScreenRoot('pe-menu', `
      <div class="pe-menu__inner">
        <div class="pe-eyebrow" data-i18n="menu.eyebrow"></div>
        <nav class="pe-menu__list"></nav>
      </div>
      <div class="pe-menu__foot">
        <span data-i18n="brand.title"></span><span>${version}</span>
      </div>`);
    const list = this.root.querySelector('.pe-menu__list') as HTMLElement;
    for (const key of ITEMS) {
      const button = document.createElement('button');
      button.className = 'pe-menu-item pe-menu__item';
      button.innerHTML = `<span class="pe-menu__eyebrow" data-i18n="menu.${key}Eyebrow"></span><span class="pe-menu__label" data-i18n="menu.${key}"></span>`;
      button.addEventListener('click', () => actions[key]());
      button.addEventListener('pointerenter', () => {
        button.focus({ preventScroll: true });
        this.onHover?.();
      });
      button.addEventListener('focus', () => this.onHover?.());
      list.appendChild(button);
    }
  }
}
