import { createScreenRoot, type Screen } from './Screen';

export interface MenuActions {
  hunt: () => void;
  codex: () => void;
  settings: () => void;
  credits: () => void;
}

const ITEMS: { key: keyof MenuActions; label: string; eyebrow: string }[] = [
  { key: 'hunt', label: '狩りに出る', eyebrow: 'Hunt' },
  { key: 'codex', label: '図鑑', eyebrow: 'Codex' },
  { key: 'settings', label: '設定', eyebrow: 'Settings' },
  { key: 'credits', label: '語り部', eyebrow: 'Credits' },
];

/** メインメニュー。項目は左寄せ、余白を大きく。ホバー／フォーカスで左の金線が伸び、小さな音が鳴る。 */
export class MenuScreen implements Screen {
  readonly id = 'menu';
  readonly root: HTMLElement;
  onHover: (() => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(actions: MenuActions, version: string) {
    this.root = createScreenRoot('pe-menu', `
      <div class="pe-menu__inner">
        <div class="pe-eyebrow">Verdant Outpost</div>
        <nav class="pe-menu__list"></nav>
      </div>
      <div class="pe-menu__foot">
        <span>PRIMAL ECHOES</span><span>${version}</span>
      </div>`);
    const list = this.root.querySelector('.pe-menu__list') as HTMLElement;
    for (const item of ITEMS) {
      const button = document.createElement('button');
      button.className = 'pe-menu-item pe-menu__item';
      button.innerHTML = `<span class="pe-menu__eyebrow">${item.eyebrow}</span><span class="pe-menu__label">${item.label}</span>`;
      button.addEventListener('click', () => actions[item.key]());
      button.addEventListener('pointerenter', () => {
        button.focus({ preventScroll: true });
        this.onHover?.();
      });
      button.addEventListener('focus', () => this.onHover?.());
      list.appendChild(button);
    }
  }
}
