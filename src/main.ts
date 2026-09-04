import { GameManager } from '@app/GameManager';

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required element #${id} not found in index.html`);
  }
  return el as T;
}

const canvas = requireElement<HTMLCanvasElement>('game-canvas');
const uiRoot = requireElement<HTMLDivElement>('ui-root');
const debugRoot = requireElement<HTMLDivElement>('debug-root');

const game = new GameManager(canvas, uiRoot, debugRoot);
game.start();

// 開発中にコンソールから触れるように公開する（本番ビルドでは無効化予定）
if (import.meta.env.DEV) {
  (window as unknown as { __game: GameManager }).__game = game;
}
