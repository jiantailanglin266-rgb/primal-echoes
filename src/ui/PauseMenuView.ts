/**
 * ポーズメニュー（フィールド中に Esc）。
 * 続行・音量・任務中断。既存作品のメニュー構成を模倣せず最小限。
 */
export class PauseMenuView {
  readonly root: HTMLElement;
  private readonly volume: HTMLInputElement;
  onResume: (() => void) | null = null;
  onAbandon: (() => void) | null = null;
  onVolumeChange: ((value: number) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pe-screen pe-pause';
    this.root.innerHTML = `
      <div class="pe-screen-inner pe-pause-inner">
        <div class="pe-eyebrow">PAUSED</div>
        <h1>一時停止</h1>
        <div class="pe-pause-row">
          <label>音量 <input type="range" min="0" max="1" step="0.05" class="pe-pause-volume"></label>
        </div>
        <div class="pe-pause-actions">
          <button class="pe-button pe-button-primary pe-pause-resume">続ける</button>
          <button class="pe-button pe-pause-abandon">任務を中断して拠点へ</button>
        </div>
        <p class="pe-lead">Esc で再開</p>
      </div>
    `;
    parent.appendChild(this.root);
    this.volume = this.root.querySelector<HTMLInputElement>('.pe-pause-volume') as HTMLInputElement;
    this.root.querySelector('.pe-pause-resume')?.addEventListener('click', () => this.onResume?.());
    this.root.querySelector('.pe-pause-abandon')?.addEventListener('click', () => this.onAbandon?.());
    this.volume.addEventListener('input', () => this.onVolumeChange?.(Number(this.volume.value)));
    this.root.hidden = true;
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  get isVisible(): boolean {
    return !this.root.hidden;
  }

  setVolume(value: number): void {
    this.volume.value = String(value);
  }
}
