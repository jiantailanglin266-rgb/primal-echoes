import ja from './ja.json';
import en from './en.json';

export type Language = 'ja' | 'en';

/** 文字列辞書。ネストしたオブジェクトをドット区切りのキーで引く。配列は「複数パターン」。 */
type Dict = { [key: string]: string | string[] | Dict };

const DICTS: Record<Language, Dict> = { ja: ja as Dict, en: en as Dict };
const STORAGE_KEY = 'pe.lang';
const listeners = new Set<(language: Language) => void>();
let current: Language = readStored();

function readStored(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ja';
  } catch {
    return 'ja';
  }
}

export function getLanguage(): Language {
  return current;
}

/** 言語を切り替え、保存し、購読者と `data-i18n` 要素へ反映する。 */
export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* 保存できない環境では無視 */
  }
  document.documentElement.lang = language;
  applyTranslations(document.body);
  for (const l of listeners) l(language);
}

export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(dict: Dict, key: string): string | string[] | undefined {
  let node: string | string[] | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' || Array.isArray(node) ? node : undefined;
}

/**
 * 文字列を引く。`{name}` のプレースホルダを params で置換する。
 * 見つからなければ英語 → キーそのものの順で返す（開発中に穴が見えるように）。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let value = lookup(DICTS[current], key) ?? lookup(DICTS.en, key);
  if (value === undefined) return key;
  if (Array.isArray(value)) value = value[0] ?? key;
  return params ? interpolate(value, params) : value;
}

/** 複数パターンから 1 つ選ぶ（討伐・帰還の一言など）。index を省くと乱択。 */
export function tPick(key: string, index?: number, params?: Record<string, string | number>): string {
  const value = lookup(DICTS[current], key) ?? lookup(DICTS.en, key);
  if (value === undefined) return key;
  const list = Array.isArray(value) ? value : [value];
  const i = index === undefined ? Math.floor(Math.random() * list.length) : Math.abs(index) % list.length;
  const chosen = list[i] ?? key;
  return params ? interpolate(chosen, params) : chosen;
}

/** 配列をそのまま返す（ローディングの断片など）。 */
export function tList(key: string): readonly string[] {
  const value = lookup(DICTS[current], key) ?? lookup(DICTS.en, key);
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** キーが存在するか（データ名の翻訳があるかの判定）。 */
export function has(key: string): boolean {
  return lookup(DICTS[current], key) !== undefined || lookup(DICTS.en, key) !== undefined;
}

function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/**
 * `data-i18n="key"` を持つ要素の文字列を差し替える。静的なラベルはこれで言語切替に追従する。
 * `data-i18n-attr="placeholder"` のように属性名を添えると属性へ入れる。
 */
export function applyTranslations(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset['i18n'];
    if (!key) return;
    const attr = el.dataset['i18nAttr'];
    const value = t(key);
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  });
}

/** データ定義の表示名。辞書に訳があればそれを、無ければ定義の name を返す。 */
export function dataName(kind: 'items' | 'weapons' | 'monsters' | 'parts' | 'creatures' | 'areas' | 'quests' | 'recipes' | 'fields' | 'gimmicks', id: string, fallback: string): string {
  const key = `data.${kind}.${id}`;
  return has(key) ? t(key) : fallback;
}
