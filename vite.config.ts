import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = (dir: string) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

/** 実行時に読むアセット URL に付けるビルド ID。git の短い SHA、取れなければ時刻。 */
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || Date.now().toString(36);
  } catch {
    return Date.now().toString(36);
  }
}

export default defineConfig({
  define: {
    __PE_BUILD_ID__: JSON.stringify(buildId()),
  },
  // GitHub Pages はリポジトリ名のサブパスで配信されるため、アセット参照を相対にする
  base: './',
  resolve: {
    alias: {
      '@app': alias('app'),
      '@core': alias('core'),
      '@data': alias('data'),
      '@input': alias('input'),
      '@presentation': alias('presentation'),
      '@ui': alias('ui'),
      '@i18n': alias('i18n'),
      '@audio': alias('audio'),
      '@shared': alias('shared'),
      '@debug': alias('debug'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
