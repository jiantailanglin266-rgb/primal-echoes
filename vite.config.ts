import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = (dir: string) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app': alias('app'),
      '@core': alias('core'),
      '@data': alias('data'),
      '@input': alias('input'),
      '@presentation': alias('presentation'),
      '@ui': alias('ui'),
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
