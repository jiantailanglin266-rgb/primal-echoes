// Draco / KTX2(Basis) のデコーダを three から public/libs へコピーする。
// GLTFLoader がブラウザから読む静的ファイルなので、ビルド成果物に含める必要がある。
// git には入れず、predev / prebuild で毎回コピーする（node_modules の three と常に同じ版になる）。
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
const targets = [
  ['draco/gltf', 'public/libs/draco'],
  ['basis', 'public/libs/basis'],
];

for (const [from, to] of targets) {
  const source = join(src, from);
  const dest = join(root, to);
  if (!existsSync(source)) {
    console.warn(`[copy-decoders] missing ${source}`);
    continue;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
  console.log(`[copy-decoders] ${from} -> ${to}`);
}
