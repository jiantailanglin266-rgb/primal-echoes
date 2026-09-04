import { escapeHtml } from './HubView';
import { formatTime } from './HudView';

export interface ResultModel {
  success: boolean;
  questName: string;
  failReason: string;
  clearTimeSeconds: number;
  downs: number;
  brokenParts: string[];
  /** 獲得素材の表示行（T15 で埋める）。 */
  rewardLines: string[];
}

/** クエスト終了画面。 */
export class ResultView {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  onReturn: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pe-screen pe-result';
    this.root.innerHTML = `
      <div class="pe-screen-inner pe-result-inner">
        <div class="pe-result-body"></div>
        <button class="pe-button pe-button-primary pe-result-return">拠点へ戻る</button>
      </div>
    `;
    parent.appendChild(this.root);
    this.body = this.root.querySelector<HTMLElement>('.pe-result-body') as HTMLElement;
    this.root.querySelector<HTMLButtonElement>('.pe-result-return')?.addEventListener('click', () => this.onReturn?.());
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  render(m: ResultModel): void {
    const rewards = m.rewardLines.length ? m.rewardLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('') : '<li>（なし）</li>';
    const parts = m.brokenParts.length ? m.brokenParts.map((p) => `<li>${escapeHtml(p)}</li>`).join('') : '<li>（なし）</li>';
    this.body.innerHTML = `
      <div class="pe-eyebrow">${m.success ? 'MISSION COMPLETE' : 'MISSION FAILED'}</div>
      <h1>${m.success ? '討伐完了' : 'クエスト失敗'}</h1>
      <p class="pe-lead">${escapeHtml(m.questName)}${m.success ? '' : ` — ${escapeHtml(m.failReason)}`}</p>
      <div class="pe-result-grid">
        <section><h2>記録</h2>
          <dl>
            <dt>討伐時間</dt><dd>${m.success ? formatTime(m.clearTimeSeconds) : '-'}</dd>
            <dt>力尽き</dt><dd>${m.downs} 回</dd>
          </dl>
        </section>
        <section><h2>部位破壊</h2><ul>${parts}</ul></section>
        <section><h2>獲得素材</h2><ul>${rewards}</ul></section>
      </div>
    `;
  }
}
