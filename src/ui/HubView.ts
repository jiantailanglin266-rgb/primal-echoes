import type { QuestDefinition } from '@data/schemas/quest';

export interface HubModel {
  playerName: string;
  weaponName: string;
  weaponPower: number;
  maxHp: number;
  quests: QuestDefinition[];
  /** 所持素材の表示用（T15 で埋める）。 */
  inventoryLines: string[];
  /** クラフト候補の表示用（T16 で埋める）。 */
  craftingLines: string[];
}

/**
 * 拠点（調査ステーション）画面。
 * クエスト受注と装備確認を行う DOM パネル。3D は背景として残す。
 */
export class HubView {
  readonly root: HTMLElement;
  private readonly questList: HTMLElement;
  private readonly status: HTMLElement;
  private readonly inventory: HTMLElement;
  private readonly crafting: HTMLElement;
  onStartQuest: ((quest: QuestDefinition) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'pe-screen pe-hub';
    this.root.innerHTML = `
      <div class="pe-screen-inner">
        <header class="pe-screen-header">
          <div class="pe-eyebrow">VALDIA SURVEY STATION</div>
          <h1>ベースキャンプ</h1>
          <p class="pe-lead">レンジャー、任務を選び装備を確認してから出発せよ。</p>
        </header>
        <div class="pe-hub-columns">
          <section class="pe-panel">
            <h2>レンジャー</h2>
            <div class="pe-hub-status"></div>
            <h2>所持素材</h2>
            <div class="pe-hub-inventory pe-lines"></div>
          </section>
          <section class="pe-panel">
            <h2>任務</h2>
            <div class="pe-hub-quests"></div>
          </section>
          <section class="pe-panel">
            <h2>工房</h2>
            <div class="pe-hub-crafting pe-lines"></div>
          </section>
        </div>
      </div>
    `;
    parent.appendChild(this.root);
    this.questList = q(this.root, '.pe-hub-quests');
    this.status = q(this.root, '.pe-hub-status');
    this.inventory = q(this.root, '.pe-hub-inventory');
    this.crafting = q(this.root, '.pe-hub-crafting');
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  render(m: HubModel): void {
    this.status.innerHTML = `
      <div>${escapeHtml(m.playerName)}</div>
      <div>武器: ${escapeHtml(m.weaponName)}（攻撃力 ${m.weaponPower}）</div>
      <div>体力: ${m.maxHp}</div>
    `;
    this.inventory.replaceChildren(...(m.inventoryLines.length ? m.inventoryLines : ['（なし）']).map(line));
    this.crafting.replaceChildren(...(m.craftingLines.length ? m.craftingLines : ['（素材が足りない）']).map(line));

    this.questList.replaceChildren(
      ...m.quests.map((quest) => {
        const card = document.createElement('article');
        card.className = 'pe-quest-card';
        card.innerHTML = `
          <div class="pe-quest-type">${questTypeLabel(quest.type)}</div>
          <h3>${escapeHtml(quest.name)}</h3>
          <p>${escapeHtml(quest.description)}</p>
          <dl>
            <dt>制限時間</dt><dd>${Math.round(quest.timeLimitSeconds / 60)} 分</dd>
            <dt>力尽き</dt><dd>${quest.maxDowns} 回で失敗</dd>
          </dl>
        `;
        const button = document.createElement('button');
        button.className = 'pe-button pe-button-primary';
        button.textContent = '出発する';
        button.addEventListener('click', () => this.onStartQuest?.(quest));
        card.appendChild(button);
        return card;
      }),
    );
  }
}

function line(text: string): HTMLElement {
  const e = document.createElement('div');
  e.textContent = text;
  return e;
}

function q(root: HTMLElement, selector: string): HTMLElement {
  const e = root.querySelector<HTMLElement>(selector);
  if (!e) throw new Error(`Hub element not found: ${selector}`);
  return e;
}

function questTypeLabel(type: QuestDefinition['type']): string {
  const labels: Record<QuestDefinition['type'], string> = {
    hunt: '討伐',
    capture: '捕獲',
    investigation: '調査',
    gathering: '採取',
    survival: '生存',
    multiHunt: '連続討伐',
  };
  return labels[type];
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
