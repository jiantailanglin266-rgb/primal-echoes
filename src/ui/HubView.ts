import type { QuestDefinition } from '@data/schemas/quest';

export interface HubCraftOption {
  recipeId: string;
  name: string;
  /** 「素材名 所持/必要」の行。 */
  materialLines: { text: string; satisfied: boolean }[];
  resultLine: string;
  canCraft: boolean;
}

export interface HubWeaponOption {
  id: string;
  name: string;
  weaponPower: number;
  level: number;
  equipped: boolean;
}

export interface HubModel {
  playerName: string;
  weapons: HubWeaponOption[];
  weaponName: string;
  weaponPower: number;
  weaponLevel: number;
  sharpnessLabel: string;
  maxHp: number;
  quests: QuestDefinition[];
  inventoryLines: string[];
  /** 次の強化候補。null なら最終段階。 */
  craft: HubCraftOption | null;
  /** 最終保存日時の表示（未保存なら空）。 */
  savedAtLabel: string;
  questClears: number;
}

/**
 * 拠点（調査ステーション）画面。
 * クエスト受注・装備確認・工房（強化）を行う DOM パネル。3D は背景として残す。
 */
export class HubView {
  readonly root: HTMLElement;
  private readonly questList: HTMLElement;
  private readonly status: HTMLElement;
  private readonly inventory: HTMLElement;
  private readonly crafting: HTMLElement;
  onStartQuest: ((quest: QuestDefinition) => void) | null = null;
  onCraft: ((recipeId: string) => void) | null = null;
  onSave: (() => void) | null = null;
  onDeleteSave: (() => void) | null = null;
  onEquip: ((weaponId: string) => void) | null = null;
  private readonly savedLabel: HTMLElement;
  private readonly weaponList: HTMLElement;

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
            <h2>武器</h2>
            <div class="pe-hub-weapons"></div>
            <h2>所持素材</h2>
            <div class="pe-hub-inventory pe-lines"></div>
            <h2>記録</h2>
            <div class="pe-hub-actions">
              <button class="pe-button pe-button-small pe-hub-save">記録する</button>
              <button class="pe-button pe-button-small pe-hub-delete">記録を消す</button>
            </div>
            <div class="pe-hub-saved"></div>
          </section>
          <section class="pe-panel">
            <h2>任務</h2>
            <div class="pe-hub-quests"></div>
          </section>
          <section class="pe-panel">
            <h2>工房</h2>
            <div class="pe-hub-crafting"></div>
          </section>
        </div>
      </div>
    `;
    parent.appendChild(this.root);
    this.questList = q(this.root, '.pe-hub-quests');
    this.status = q(this.root, '.pe-hub-status');
    this.inventory = q(this.root, '.pe-hub-inventory');
    this.crafting = q(this.root, '.pe-hub-crafting');
    this.savedLabel = q(this.root, '.pe-hub-saved');
    this.weaponList = q(this.root, '.pe-hub-weapons');
    this.root.querySelector('.pe-hub-save')?.addEventListener('click', () => this.onSave?.());
    this.root.querySelector('.pe-hub-delete')?.addEventListener('click', () => {
      if (window.confirm('記録を消去しますか？ 素材と強化が失われます。')) this.onDeleteSave?.();
    });
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  render(m: HubModel): void {
    this.status.innerHTML = `
      <div>${escapeHtml(m.playerName)}</div>
      <div>武器: ${escapeHtml(m.weaponName)}</div>
      <div>攻撃力 ${m.weaponPower} / 強化 Lv.${m.weaponLevel} / ${escapeHtml(m.sharpnessLabel)}</div>
      <div>体力: ${m.maxHp}</div>
      <div>討伐記録: ${m.questClears} 回</div>
    `;
    this.savedLabel.textContent = m.savedAtLabel ? `最終記録: ${m.savedAtLabel}` : '記録なし（クエスト終了と強化で自動記録）';
    this.inventory.replaceChildren(...(m.inventoryLines.length ? m.inventoryLines : ['（なし）']).map((t) => line(t)));

    this.weaponList.replaceChildren(
      ...m.weapons.map((w) => {
        const button = document.createElement('button');
        button.className = `pe-button pe-button-small pe-weapon-option${w.equipped ? ' is-equipped' : ''}`;
        button.textContent = `${w.equipped ? '◆ ' : ''}${w.name}  攻 ${w.weaponPower} / Lv.${w.level}`;
        button.disabled = w.equipped;
        button.addEventListener('click', () => this.onEquip?.(w.id));
        return button;
      }),
    );

    this.crafting.replaceChildren();
    if (!m.craft) {
      this.crafting.appendChild(line('この武器は最終段階まで強化済み'));
    } else {
      const card = document.createElement('article');
      card.className = 'pe-craft-card';
      const title = document.createElement('h3');
      title.textContent = m.craft.name;
      card.appendChild(title);
      const result = line(m.craft.resultLine);
      result.className = 'pe-craft-result';
      card.appendChild(result);
      const list = document.createElement('ul');
      list.className = 'pe-craft-materials';
      for (const mat of m.craft.materialLines) {
        const li = document.createElement('li');
        li.textContent = mat.text;
        li.classList.toggle('is-short', !mat.satisfied);
        list.appendChild(li);
      }
      card.appendChild(list);
      const button = document.createElement('button');
      button.className = 'pe-button pe-button-primary';
      button.textContent = '強化する';
      button.disabled = !m.craft.canCraft;
      const recipeId = m.craft.recipeId;
      button.addEventListener('click', () => this.onCraft?.(recipeId));
      card.appendChild(button);
      this.crafting.appendChild(card);
    }

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
