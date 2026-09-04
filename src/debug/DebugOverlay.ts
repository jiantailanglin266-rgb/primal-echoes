/**
 * 開発用オーバーレイ。`?debug=1` で有効化。
 * 表示項目は行単位で登録し、各システムが自分の状態を文字列で提供する。
 * DOM を直接触るのはこの層だけで、core 層はこの存在を知らない。
 */
export type DebugLineProvider = () => string;

export class DebugOverlay {
  private readonly element: HTMLElement;
  private readonly providers: DebugLineProvider[] = [];

  private frameCount = 0;
  private fpsAccumulator = 0;
  private fps = 0;

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'pe-debug-overlay';
    root.appendChild(this.element);
  }

  addLine(provider: DebugLineProvider): void {
    this.providers.push(provider);
  }

  /** 描画フレームごとに呼ぶ。FPS は 0.5 秒ごとに更新して読みやすくする。 */
  update(frameDt: number): void {
    this.frameCount += 1;
    this.fpsAccumulator += frameDt;
    if (this.fpsAccumulator >= 0.5) {
      this.fps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    const lines = [`FPS ${this.fps.toFixed(0)}`];
    for (const provider of this.providers) {
      lines.push(provider());
    }
    this.element.textContent = lines.join('\n');
  }

  static isEnabled(): boolean {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }
}
