import { createScreenRoot, wait, type Screen } from './Screen';

/** 起動直後のスタジオ表示。黒背景に名前が静かに浮かんで消える（約 2.6 秒、入力で短縮）。 */
export class StudioScreen implements Screen {
  readonly id = 'studio';
  readonly root: HTMLElement;
  private skip: (() => void) | null = null;

  constructor(studioName: string) {
    this.root = createScreenRoot('pe-studio', `
      <div class="pe-studio__inner">
        <div class="pe-studio__name">${studioName}</div>
        <div class="pe-studio__line"></div>
      </div>`);
  }

  onKey(): boolean {
    this.skip?.();
    return true;
  }

  /** 表示が終わる（または飛ばされる）まで待つ。 */
  async play(): Promise<void> {
    const inner = this.root.querySelector<HTMLElement>('.pe-studio__inner');
    if (!inner) return;
    let skipped = false;
    const done = new Promise<void>((resolve) => {
      this.skip = () => {
        skipped = true;
        resolve();
      };
    });
    const click = (): void => this.skip?.();
    this.root.addEventListener('pointerdown', click);
    inner.classList.add('is-visible');
    await Promise.race([wait(2000), done]);
    inner.classList.remove('is-visible');
    if (!skipped) await wait(600);
    this.root.removeEventListener('pointerdown', click);
    this.skip = null;
  }
}
