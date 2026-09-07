import { createScreenRoot, q, type Screen } from './Screen';
import type { RenderQuality } from '@presentation/render/Renderer';
import { KEY_BINDINGS, type BindingAction } from '@input/bindings';
import { t, type Language } from '@i18n/index';

export type { Language };

export interface SettingsModel {
  quality: RenderQuality;
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  language: Language;
}

export interface SettingsCallbacks {
  onQuality: (q: RenderQuality) => void;
  onVolume: (v: number) => void;
  onMusicVolume: (v: number) => void;
  onSfxVolume: (v: number) => void;
  onLanguage: (l: Language) => void;
}

type VolumeKey = 'volume' | 'musicVolume' | 'sfxVolume';
const LANGUAGE_LABELS: Record<Language, string> = { ja: '日本語', en: 'English' };
const ACTIONS: BindingAction[] = ['moveForward', 'moveBackward', 'moveLeft', 'moveRight', 'dash', 'dodge', 'lightAttack', 'heavyAttack', 'lockOn', 'interact', 'useItem', 'pause'];
const KEY_LABELS: Record<string, string> = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyQ: 'Q', KeyE: 'E', KeyH: 'H', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: 'Space', Tab: 'Tab', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', F9: 'F9' };

/** 設定。画質・音量・操作・言語。左右キー／スティックでも変えられる。 */
export class SettingsScreen implements Screen {
  readonly id = 'settings';
  readonly root: HTMLElement;
  onBack: (() => void) | null = null;
  private readonly model: SettingsModel;

  constructor(initial: SettingsModel, private readonly callbacks: SettingsCallbacks) {
    this.model = { ...initial };
    this.root = createScreenRoot('pe-settings', `
      <div class="pe-sub__inner pe-sub__inner--narrow">
        <header class="pe-sub__header">
          <div class="pe-eyebrow" data-i18n="settings.eyebrow"></div>
          <h1 class="pe-heading" data-i18n="settings.title"></h1>
        </header>
        <div class="pe-settings__rows">
          <div class="pe-settings__row"><span class="pe-settings__label" data-i18n="settings.quality"></span><div class="pe-seg pe-settings__quality"></div></div>
          <div class="pe-settings__row"><span class="pe-settings__label" data-i18n="settings.volume"></span><div class="pe-settings__volume"><input type="range" min="0" max="1" step="0.05" class="pe-range pe-menu-item" data-volume="volume" aria-label="volume" /><span class="pe-settings__value" data-volume-value="volume"></span></div></div>
          <div class="pe-settings__row"><span class="pe-settings__label" data-i18n="settings.music"></span><div class="pe-settings__volume"><input type="range" min="0" max="1" step="0.05" class="pe-range pe-menu-item" data-volume="musicVolume" aria-label="music" /><span class="pe-settings__value" data-volume-value="musicVolume"></span></div></div>
          <div class="pe-settings__row"><span class="pe-settings__label" data-i18n="settings.effects"></span><div class="pe-settings__volume"><input type="range" min="0" max="1" step="0.05" class="pe-range pe-menu-item" data-volume="sfxVolume" aria-label="effects" /><span class="pe-settings__value" data-volume-value="sfxVolume"></span></div></div>
          <div class="pe-settings__row"><span class="pe-settings__label" data-i18n="settings.language"></span><div class="pe-seg pe-settings__language"></div></div>
        </div>
        <h2 class="pe-settings__sub" data-i18n="settings.controls"></h2>
        <table class="pe-settings__keys"></table>
        <p class="pe-text-dim pe-settings__note" data-i18n="settings.note"></p>
        <footer class="pe-sub__foot"><button class="pe-button pe-menu-item pe-sub__back is-default" data-i18n="settings.back"></button></footer>
      </div>`);
    q(this.root, '.pe-sub__back').addEventListener('click', () => this.onBack?.());
    this.buildSegment<RenderQuality>(q(this.root, '.pe-settings__quality'), ['low', 'mid', 'high'], (v) => t(`settings.${v}`), () => this.model.quality, (v) => {
      this.model.quality = v;
      callbacks.onQuality(v);
    });
    this.buildSegment<Language>(q(this.root, '.pe-settings__language'), ['ja', 'en'], (v) => LANGUAGE_LABELS[v], () => this.model.language, (v) => {
      this.model.language = v;
      callbacks.onLanguage(v);
    });
    for (const range of this.root.querySelectorAll<HTMLInputElement>('.pe-range')) {
      const key = range.dataset['volume'] as VolumeKey;
      range.addEventListener('input', () => this.setVolume(key, Number(range.value), true));
      range.addEventListener('pe-nav', (e) => {
        const dir = (e as CustomEvent<string>).detail;
        this.setVolume(key, this.model[key] + (dir === 'left' ? -0.05 : 0.05), true);
      });
    }
    this.renderKeys();
    this.sync();
  }

  /** 外から値が変わったとき（自動画質など）に呼ぶ。 */
  set(model: Partial<SettingsModel>): void {
    Object.assign(this.model, model);
    this.sync();
  }

  private setVolume(key: VolumeKey, value: number, notify: boolean): void {
    const v = Math.max(0, Math.min(1, Math.round(value * 20) / 20));
    this.model[key] = v;
    if (notify) {
      if (key === 'volume') this.callbacks.onVolume(v);
      else if (key === 'musicVolume') this.callbacks.onMusicVolume(v);
      else this.callbacks.onSfxVolume(v);
    }
    this.sync();
  }

  /** 言語切替のあとに呼ぶ（操作表とセグメントの文字）。 */
  relabel(): void {
    this.renderKeys();
    this.root.querySelectorAll<HTMLElement>('.pe-settings__quality .pe-seg__item').forEach((b) => (b.textContent = t(`settings.${b.dataset['value']}`)));
  }

  private renderKeys(): void {
    q(this.root, '.pe-settings__keys').innerHTML = ACTIONS.map((action) => `<tr><th>${t(`settings.actions.${action}`)}</th><td>${KEY_BINDINGS[action].map((k) => KEY_LABELS[k] ?? k).join(' / ')}</td></tr>`).join('');
  }

  private buildSegment<T extends string>(host: HTMLElement, values: T[], label: (v: T) => string, get: () => T, set: (v: T) => void): void {
    for (const v of values) {
      const button = document.createElement('button');
      button.className = 'pe-seg__item pe-menu-item';
      button.dataset['value'] = v;
      button.textContent = label(v);
      button.addEventListener('click', () => {
        set(v);
        this.sync();
      });
      button.addEventListener('pe-nav', (e) => {
        const dir = (e as CustomEvent<string>).detail;
        const i = values.indexOf(get());
        const next = values[(i + (dir === 'left' ? -1 : 1) + values.length) % values.length] as T;
        set(next);
        this.sync();
        host.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus({ preventScroll: true });
      });
      host.appendChild(button);
    }
  }

  private sync(): void {
    this.root.querySelectorAll<HTMLElement>('.pe-settings__quality .pe-seg__item').forEach((b) => b.classList.toggle('is-active', b.dataset['value'] === this.model.quality));
    this.root.querySelectorAll<HTMLElement>('.pe-settings__language .pe-seg__item').forEach((b) => b.classList.toggle('is-active', b.dataset['value'] === this.model.language));
    for (const key of ['volume', 'musicVolume', 'sfxVolume'] as const) {
      q<HTMLInputElement>(this.root, `.pe-range[data-volume="${key}"]`).value = String(this.model[key]);
      q(this.root, `.pe-settings__value[data-volume-value="${key}"]`).textContent = `${Math.round(this.model[key] * 100)}`;
    }
  }
}
