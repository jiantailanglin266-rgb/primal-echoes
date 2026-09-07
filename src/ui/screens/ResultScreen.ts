import { createScreenRoot, escapeHtml, q, type Screen } from './Screen';
import { t } from '@i18n/index';

export interface ResultModel {
  success: boolean;
  /** 討伐した獣の名（討伐時）。帰還時は狩りの名。 */
  headline: string;
  /** 二つ名、または帰還の理由（世界の言葉）。 */
  subline: string;
  clearTimeSeconds: number;
  damageDealt: number;
  hitsTaken: number;
  downs: number;
  brokenParts: string[];
  rewardLines: string[];
}

const COUNT_SECONDS = 1.4;

/**
 * 狩りの終わり。討伐は獣の名を大きく、数字はカウントアップ。
 * 帰還（失敗）は「失敗」と言わず、次の狩りへの導線を最短にする。
 */
export class ResultScreen implements Screen {
  readonly id = 'result';
  readonly root: HTMLElement;
  onReturn: (() => void) | null = null;
  onRetry: (() => void) | null = null;
  private model: ResultModel | null = null;
  private elapsed = 0;

  constructor() {
    this.root = createScreenRoot('pe-result', `
      <div class="pe-result__inner">
        <div class="pe-eyebrow pe-result__eyebrow"></div>
        <h1 class="pe-result__headline"></h1>
        <div class="pe-result__subline"></div>
        <div class="pe-result__numbers">
          <div class="pe-result__num"><span class="pe-result__value" data-key="time">0:00</span><span class="pe-result__key" data-i18n="result.time"></span></div>
          <div class="pe-result__num"><span class="pe-result__value" data-key="damage">0</span><span class="pe-result__key" data-i18n="result.damage"></span></div>
          <div class="pe-result__num"><span class="pe-result__value" data-key="hits">0</span><span class="pe-result__key" data-i18n="result.hits"></span></div>
          <div class="pe-result__num"><span class="pe-result__value" data-key="downs">0</span><span class="pe-result__key" data-i18n="result.downs"></span></div>
        </div>
        <div class="pe-result__columns">
          <section><h2 class="pe-result__h" data-i18n="result.parts"></h2><ul class="pe-result__parts"></ul></section>
          <section><h2 class="pe-result__h" data-i18n="result.rewards"></h2><ul class="pe-result__rewards"></ul></section>
        </div>
        <div class="pe-result__actions">
          <button class="pe-button pe-button-primary pe-menu-item pe-result__retry is-default"></button>
          <button class="pe-button pe-menu-item pe-result__return" data-i18n="result.outpost"></button>
        </div>
      </div>`);
    q(this.root, '.pe-result__retry').addEventListener('click', () => this.onRetry?.());
    q(this.root, '.pe-result__return').addEventListener('click', () => this.onReturn?.());
  }

  onBack = (): void => {
    this.onReturn?.();
  };

  render(m: ResultModel): void {
    this.model = m;
    this.elapsed = 0;
    this.root.classList.toggle('is-success', m.success);
    q(this.root, '.pe-result__eyebrow').textContent = m.success ? t('result.concluded') : t('result.returned');
    q(this.root, '.pe-result__headline').textContent = m.headline;
    q(this.root, '.pe-result__subline').textContent = m.subline;
    q(this.root, '[data-key="time"]').parentElement!.hidden = !m.success;
    q(this.root, '.pe-result__parts').innerHTML = m.brokenParts.length ? m.brokenParts.map((p) => `<li>${escapeHtml(p)}</li>`).join('') : `<li class="pe-text-dim">${t('result.none')}</li>`;
    q(this.root, '.pe-result__rewards').innerHTML = m.rewardLines.length ? m.rewardLines.map((r) => `<li>${escapeHtml(r)}</li>`).join('') : `<li class="pe-text-dim">${t('result.none')}</li>`;
    q(this.root, '.pe-result__retry').textContent = m.success ? t('result.again') : t('result.retry');
    this.applyNumbers(0);
  }

  onEnter(): void {
    this.elapsed = 0;
  }

  update(dt: number): void {
    if (!this.model || this.elapsed >= COUNT_SECONDS) return;
    this.elapsed = Math.min(COUNT_SECONDS, this.elapsed + dt);
    this.applyNumbers(easeOut(this.elapsed / COUNT_SECONDS));
  }

  private applyNumbers(t: number): void {
    const m = this.model;
    if (!m) return;
    q(this.root, '[data-key="time"]').textContent = formatClock(m.clearTimeSeconds * t);
    q(this.root, '[data-key="damage"]').textContent = Math.round(m.damageDealt * t).toLocaleString('ja-JP');
    q(this.root, '[data-key="hits"]').textContent = String(Math.round(m.hitsTaken * t));
    q(this.root, '[data-key="downs"]').textContent = String(Math.round(m.downs * t));
  }
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
