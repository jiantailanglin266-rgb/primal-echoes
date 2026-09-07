import { createScreenRoot, escapeHtml, q, type Screen } from './Screen';

export interface CodexEntry {
  id: string;
  name: string;
  title: string;
  kind: string;
  habitat: string;
  ecology: string;
  hint: string;
  sighting: string;
  /** 一度でも狩りに出て遭遇したか。false は「記録なし」。 */
  seen: boolean;
}

/** 図鑑。左に一覧、右に選択中の獣の記録。文章は B5 で本番のものに差し替える。 */
export class CodexScreen implements Screen {
  readonly id = 'codex';
  readonly root: HTMLElement;
  onBack: (() => void) | null = null;
  private entries: CodexEntry[] = [];
  private selected = 0;

  constructor() {
    this.root = createScreenRoot('pe-codex', `
      <div class="pe-sub__inner">
        <header class="pe-sub__header">
          <div class="pe-eyebrow">Codex</div>
          <h1 class="pe-heading">図鑑</h1>
        </header>
        <div class="pe-codex__columns">
          <nav class="pe-codex__list"></nav>
          <article class="pe-codex__detail pe-slab"></article>
        </div>
        <footer class="pe-sub__foot"><button class="pe-button pe-menu-item pe-sub__back">戻る</button></footer>
      </div>`);
    q(this.root, '.pe-sub__back').addEventListener('click', () => this.onBack?.());
  }

  render(entries: CodexEntry[]): void {
    this.entries = entries;
    this.selected = Math.min(this.selected, Math.max(0, entries.length - 1));
    const list = q(this.root, '.pe-codex__list');
    list.replaceChildren(
      ...entries.map((e, i) => {
        const button = document.createElement('button');
        button.className = `pe-menu-item pe-codex__item${i === this.selected ? ' is-selected' : ''}${e.seen ? '' : ' is-unknown'}`;
        button.textContent = e.seen ? e.name : '記録なし';
        button.addEventListener('click', () => {
          this.selected = i;
          this.render(this.entries);
        });
        button.addEventListener('focus', () => {
          if (this.selected !== i) {
            this.selected = i;
            this.renderDetail();
            list.querySelectorAll('.pe-codex__item').forEach((el, j) => el.classList.toggle('is-selected', j === i));
          }
        });
        return button;
      }),
    );
    this.renderDetail();
  }

  private renderDetail(): void {
    const e = this.entries[this.selected];
    const detail = q(this.root, '.pe-codex__detail');
    if (!e) {
      detail.innerHTML = '<p class="pe-text-dim">まだ何も記されていない。</p>';
      return;
    }
    if (!e.seen) {
      detail.innerHTML = `
        <div class="pe-eyebrow">Unknown</div>
        <h2 class="pe-codex__name">――</h2>
        <p class="pe-text-dim">痕跡は見つかっていない。狩りに出て、この頁を埋めよ。</p>`;
      return;
    }
    detail.innerHTML = `
      <div class="pe-eyebrow">${escapeHtml(e.kind)}</div>
      <h2 class="pe-codex__name">${escapeHtml(e.name)}</h2>
      <div class="pe-codex__title">${escapeHtml(e.title)}</div>
      <dl class="pe-codex__facts">
        <dt>生息域</dt><dd>${escapeHtml(e.habitat)}</dd>
      </dl>
      <h3>生態</h3>
      <p>${escapeHtml(e.ecology)}</p>
      <h3>観察の手がかり</h3>
      <p>${escapeHtml(e.hint)}</p>
      <h3>目撃記録</h3>
      <p class="pe-codex__sighting">${escapeHtml(e.sighting)}</p>`;
  }
}
