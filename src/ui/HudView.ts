/**
 * 戦闘中 HUD。既存作品の配置を模倣せず、
 * 「左下: 自分の状態 / 右上: 任務と時間 / 右下: 対象の状態」の独自レイアウト。
 * 描画は 1 フレーム 1 回、変化のあった要素だけ DOM を書き換える。
 */
export interface HudModel {
  hpRatio: number;
  staminaRatio: number;
  weaponName: string;
  sharpnessLabel: string;
  objective: string;
  timeRemaining: number;
  timeWarning: boolean;
  monsterName: string;
  monsterVisible: boolean;
  monsterHpRatio: number;
  monsterBadges: string[];
  lockOn: boolean;
  downs: number;
  maxDowns: number;
  /** 戦闘不能中の復帰カウント（0 で非表示）。 */
  respawnCountdown: number;
  /** 操作案内（空で非表示）。 */
  prompt: string;
  /** 剥ぎ取りなどの進捗 0〜1（0 で非表示）。 */
  promptProgress: number;
  /** 直近に入手したアイテムの通知行。 */
  notices: string[];
  /** クイックアイテム欄の表示。 */
  itemSlot: string;
}

export function createHudModel(): HudModel {
  return {
    hpRatio: 1,
    staminaRatio: 1,
    weaponName: '',
    sharpnessLabel: '',
    objective: '',
    timeRemaining: 0,
    timeWarning: false,
    monsterName: '',
    monsterVisible: false,
    monsterHpRatio: 1,
    monsterBadges: [],
    lockOn: false,
    downs: 0,
    maxDowns: 0,
    respawnCountdown: 0,
    prompt: '',
    promptProgress: 0,
    notices: [],
    itemSlot: '',
  };
}

export class HudView {
  readonly root: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly monsterPanel: HTMLElement;
  private readonly monsterName: HTMLElement;
  private readonly monsterFill: HTMLElement;
  private readonly badges: HTMLElement;
  private readonly downs: HTMLElement;
  private readonly respawn: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly promptFill: HTMLElement;
  private readonly notices: HTMLElement;
  private readonly itemSlot: HTMLElement;
  private lastBadges = '';
  private lastNotices = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', 'pe-hud');
    this.root.innerHTML = `
      <div class="pe-hud-player">
        <div class="pe-hud-weapon"></div>
        <div class="pe-bar pe-bar-hp"><div class="pe-bar-fill"></div></div>
        <div class="pe-bar pe-bar-stamina"><div class="pe-bar-fill"></div></div>
        <div class="pe-hud-downs"></div>
        <div class="pe-hud-item"></div>
      </div>
      <div class="pe-hud-quest">
        <div class="pe-hud-timer"></div>
        <div class="pe-hud-objective"></div>
      </div>
      <div class="pe-hud-monster">
        <div class="pe-hud-monster-name"></div>
        <div class="pe-bar pe-bar-monster"><div class="pe-bar-fill"></div></div>
        <div class="pe-hud-badges"></div>
      </div>
      <div class="pe-hud-respawn" hidden></div>
      <div class="pe-hud-prompt" hidden>
        <div class="pe-hud-prompt-text"></div>
        <div class="pe-bar pe-bar-prompt"><div class="pe-bar-fill"></div></div>
      </div>
      <div class="pe-hud-notices"></div>
    `;
    parent.appendChild(this.root);
    this.hpFill = q(this.root, '.pe-bar-hp .pe-bar-fill');
    this.staminaFill = q(this.root, '.pe-bar-stamina .pe-bar-fill');
    this.weapon = q(this.root, '.pe-hud-weapon');
    this.objective = q(this.root, '.pe-hud-objective');
    this.timer = q(this.root, '.pe-hud-timer');
    this.monsterPanel = q(this.root, '.pe-hud-monster');
    this.monsterName = q(this.root, '.pe-hud-monster-name');
    this.monsterFill = q(this.root, '.pe-bar-monster .pe-bar-fill');
    this.badges = q(this.root, '.pe-hud-badges');
    this.downs = q(this.root, '.pe-hud-downs');
    this.respawn = q(this.root, '.pe-hud-respawn');
    this.prompt = q(this.root, '.pe-hud-prompt');
    this.promptText = q(this.root, '.pe-hud-prompt-text');
    this.promptFill = q(this.root, '.pe-bar-prompt .pe-bar-fill');
    this.notices = q(this.root, '.pe-hud-notices');
    this.itemSlot = q(this.root, '.pe-hud-item');
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  render(m: HudModel): void {
    this.hpFill.style.width = `${(m.hpRatio * 100).toFixed(1)}%`;
    this.hpFill.classList.toggle('is-low', m.hpRatio <= 0.3);
    this.staminaFill.style.width = `${(m.staminaRatio * 100).toFixed(1)}%`;
    setText(this.weapon, `${m.weaponName}  ${m.sharpnessLabel}`);
    setText(this.objective, m.objective);
    setText(this.timer, formatTime(m.timeRemaining));
    this.timer.classList.toggle('is-warning', m.timeWarning);
    setText(this.downs, m.maxDowns > 0 ? `力尽き ${m.downs}/${m.maxDowns}` : '');
    setText(this.itemSlot, m.itemSlot);

    this.monsterPanel.hidden = !m.monsterVisible;
    if (m.monsterVisible) {
      setText(this.monsterName, `${m.lockOn ? '◎ ' : ''}${m.monsterName}`);
      this.monsterFill.style.width = `${(m.monsterHpRatio * 100).toFixed(1)}%`;
      const badgeKey = m.monsterBadges.join('|');
      if (badgeKey !== this.lastBadges) {
        this.lastBadges = badgeKey;
        this.badges.replaceChildren(...m.monsterBadges.map((b) => el('span', 'pe-badge', b)));
      }
    }

    this.respawn.hidden = m.respawnCountdown <= 0;
    if (m.respawnCountdown > 0) setText(this.respawn, `戦闘不能… ${Math.ceil(m.respawnCountdown)} 秒後にキャンプで復帰`);

    this.prompt.hidden = m.prompt === '' || m.respawnCountdown > 0;
    if (m.prompt !== '') {
      setText(this.promptText, m.prompt);
      this.promptFill.style.width = `${(m.promptProgress * 100).toFixed(1)}%`;
    }

    const noticeKey = m.notices.join('|');
    if (noticeKey !== this.lastNotices) {
      this.lastNotices = noticeKey;
      this.notices.replaceChildren(...m.notices.map((n) => el('div', 'pe-notice', n)));
    }
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function q(root: HTMLElement, selector: string): HTMLElement {
  const e = root.querySelector<HTMLElement>(selector);
  if (!e) throw new Error(`HUD element not found: ${selector}`);
  return e;
}

function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
