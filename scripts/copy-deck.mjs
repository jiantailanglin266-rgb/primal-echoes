// src/i18n/ja.json と en.json から docs/brand/COPY_DECK.md を生成する。
// 使い方: node scripts/copy-deck.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ja = JSON.parse(readFileSync(join(root, 'src/i18n/ja.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'src/i18n/en.json'), 'utf8'));

const SECTION_TITLES = {
  brand: 'ブランド',
  title: 'タイトル画面',
  menu: 'メインメニュー',
  loading: 'ローディング',
  hub: '前哨（拠点）',
  settings: '設定',
  codex: '図鑑（画面）',
  credits: '語り部',
  pause: '静止',
  result: '討伐・帰還',
  hud: '戦闘 HUD',
  data: 'データ名・世界のテキスト',
};

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) v.forEach((item, i) => out.push([`${key}[${i + 1}]`, item]));
    else if (typeof v === 'object' && v !== null) flatten(v, key, out);
    else out.push([key, v]);
  }
  return out;
}

function lookup(obj, key) {
  const m = key.match(/^(.*)\[(\d+)\]$/);
  const path = (m ? m[1] : key).split('.');
  let node = obj;
  for (const p of path) node = node?.[p];
  if (m && Array.isArray(node)) return node[Number(m[2]) - 1] ?? '';
  return typeof node === 'string' ? node : '';
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = ['# COPY DECK — ゲーム内全テキスト', '', `生成: ${new Date().toISOString().slice(0, 10)}（\`node scripts/copy-deck.mjs\`）。原本は \`src/i18n/ja.json\` / \`en.json\`。ここで直し、JSON へ反映する。`, '', '規約: BRAND_BIBLE §4（常体、一文 40 字以内、感嘆符なし、世界の外の言葉を出さない、ボタンは動詞で終える）。', ''];
let total = 0;
for (const section of Object.keys(ja)) {
  lines.push(`## ${SECTION_TITLES[section] ?? section}（\`${section}\`）`, '', '| キー | 日本語 | English |', '|---|---|---|');
  for (const [key, value] of flatten(ja[section], section)) {
    lines.push(`| \`${key}\` | ${esc(value)} | ${esc(lookup(en, key))} |`);
    total++;
  }
  lines.push('');
}
lines.push(`合計 ${total} 項目。`, '');
writeFileSync(join(root, 'docs/brand/COPY_DECK.md'), lines.join('\n'), 'utf8');
console.log(`COPY_DECK.md: ${total} entries`);
