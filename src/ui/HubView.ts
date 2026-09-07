import type { QuestDefinition } from '@data/schemas/quest';
import type { Screen } from './screens/Screen';
import { t } from '@i18n/index';

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
  /** 狩りの名と説明（i18n 済み）。 */
  questNames: Record<string, string>;
  questDescriptions: Record<string, string>;
}

/**
 * 拠点（調査ステーション）画面。
 * クエスト受注・装備確認・工房（強化）を行う DOM パネル。3D は背景として残す。
 */
export class HubView implements Screen {
  readonly id = 'hub';
  readonly root: HTMLElement;
  onBack: (() => void) | null = null;
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

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'pe-screen pe-hub';
    this.root.innerHTML = `
      <div class="pe-screen-inner">
        <header class="pe-screen-header">
          <div class="pe-eyebrow" data-i18n="hub.eyebrow"></div>
          <h1 data-i18n="hub.title"></h1>
          <p class="pe-lead" data-i18n="hub.lead"></p>
        </header>
        <div class="pe-hub-columns">
          <section class="pe-panel">
            <h2 data-i18n="hub.hunter"></h2>
            <div class="pe-hub-status"></div>
            <h2 data-i18n="hub.blade"></h2>
            <div class="pe-hub-weapons"></div>
            <h2 data-i18n="hub.materials"></h2>
            <div class="pe-hub-inventory pe-lines"></div>
            <h2 data-i18n="hub.journal"></h2>
            <div class="pe-hub-actions">
              <button class="pe-button pe-button-small pe-menu-item pe-hub-save" data-i18n="hub.save"></button>
              <button class="pe-button pe-button-small pe-menu-item pe-hub-delete" data-i18n="hub.burn"></button>
            </div>
            <div class="pe-hub-saved"></div>
          </section>
          <section class="pe-panel">
            <h2 data-i18n="hub.hunts"></h2>
            <div class="pe-hub-quests"></div>
          </section>
          <section class="pe-panel">
            <h2 data-i18n="hub.forge"></h2>
            <div class="pe-hub-crafting"></div>
          </section>
        </div>
        <footer class="pe-hub-foot"><button class="pe-button pe-button-small pe-menu-item pe-hub-back" data-i18n="hub.back"></button></footer>
      </div>
    `;
    this.questList = q(this.root, '.pe-hub-quests');
    this.status = q(this.root, '.pe-hub-status');
    this.inventory = q(this.root, '.pe-hub-inventory');
    this.crafting = q(this.root, '.pe-hub-crafting');
    this.savedLabel = q(this.root, '.pe-hub-saved');
    this.weaponList = q(this.root, '.pe-hub-weapons');
    this.root.querySelector('.pe-hub-save')?.addEventListener('click', () => this.onSave?.());
    this.root.querySelector('.pe-hub-delete')?.addEventListener('click', () => {
      if (window.confirm(t('hub.burnConfirm'))) this.onDeleteSave?.();
    });
    this.root.querySelector('.pe-hub-back')?.addEventListener('click', () => this.onBack?.());
  }

  render(m: HubModel): void {
    this.status.innerHTML = `
      <div>${escapeHtml(m.playerName)}</div>
      <div>${escapeHtml(t('hub.bladeLine', { name: m.weaponName }))}</div>
      <div>${escapeHtml(t('hub.statLine', { power: m.weaponPower, level: m.weaponLevel, sharpness: m.sharpnessLabel }))}</div>
      <div>${escapeHtml(t('hub.hpLine', { hp: m.maxHp }))}</div>
      <div>${escapeHtml(t('hub.clearsLine', { n: m.questClears }))}</div>
    `;
    this.savedLabel.textContent = m.savedAtLabel ? t('hub.savedAt', { date: m.savedAtLabel }) : t('hub.unsaved');
    this.inventory.replaceChildren(...(m.inventoryLines.length ? m.inventoryLines : [t('hub.none')]).map((t) => line(t)));

    this.weaponList.replaceChildren(
      ...m.weapons.map((w) => {
        const button = document.createElement('button');
        button.className = `pe-button pe-button-small pe-menu-item pe-weapon-option${w.equipped ? ' is-equipped' : ''}`;
        button.textContent = `${w.equipped ? '◆ ' : ''}${t('hub.weaponOption', { name: w.name, power: w.weaponPower, level: w.level })}`;
        button.disabled = w.equipped;
        button.addEventListener('click', () => this.onEquip?.(w.id));
        return button;
      }),
    );

    this.crafting.replaceChildren();
    if (!m.craft) {
      this.crafting.appendChild(line(t('hub.maxed')));
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
      button.className = 'pe-button pe-button-primary pe-menu-item';
      button.textContent = t('hub.forgeButton');
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
          <h3>${escapeHtml(m.questNames[quest.id] ?? quest.name)}</h3>
          <p>${escapeHtml(m.questDescriptions[quest.id] ?? quest.description)}</p>
          <dl>
            <dt>${t('hub.timeLimit')}</dt><dd>${t('hub.timeValue', { minutes: Math.round(quest.timeLimitSeconds / 60) })}</dd>
            <dt>${t('hub.knees')}</dt><dd>${t('hub.kneesValue', { n: quest.maxDowns })}</dd>
          </dl>
        `;
        const button = document.createElement('button');
        button.className = 'pe-button pe-button-primary pe-menu-item is-default';
        button.textContent = t('hub.start');
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
  return t(`hub.questType.${type}`);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
