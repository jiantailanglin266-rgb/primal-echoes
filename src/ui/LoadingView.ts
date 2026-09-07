/**
 * 起動時のローディング画面。白画面で待たせず、進捗とブランドを見せる。
 * 進捗は GameManager.preload() から比率と短いラベルで受け取る。
 */
export class LoadingView {
  private readonly root: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly label: HTMLElement;
  private finished = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pe-loading';
    this.root.innerHTML = `
      <div class="pe-loading__inner">
        <div class="pe-loading__title">PRIMAL ECHOES</div>
        <div class="pe-loading__sub">翠嵐峡谷へ</div>
        <div class="pe-loading__track"><div class="pe-loading__bar"></div></div>
        <div class="pe-loading__label">起動中</div>
      </div>`;
    this.bar = this.root.querySelector('.pe-loading__bar') as HTMLElement;
    this.label = this.root.querySelector('.pe-loading__label') as HTMLElement;
    parent.appendChild(this.root);
  }

  set(ratio: number, label: string): void {
    if (this.finished) return;
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    this.label.textContent = label;
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.bar.style.width = '100%';
    this.root.classList.add('pe-loading--done');
    window.setTimeout(() => this.root.remove(), 700);
  }
}
