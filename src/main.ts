import { GameManager, nextFrame } from '@app/GameManager';
import { LoadingView } from '@ui/LoadingView';

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

const loading = new LoadingView(uiRoot);

// ローディング画面を 1 フレーム描かせてから重い初期化に入る
void nextFrame().then(() => {
  loading.set(0.02, '世界を生成');
  const game = new GameManager(canvas, uiRoot, debugRoot);
  // 開発中にコンソールから触れるように公開する（本番ビルドでは無効化予定）
  if (import.meta.env.DEV) {
    (window as unknown as { __game: GameManager }).__game = game;
  }
  game
    .preload((ratio, label) => loading.set(ratio, label))
    .then((report) => {
      console.info(`[preload] ${report.seconds.toFixed(2)}s quality=${game.quality.current}`);
    })
    .catch((err: unknown) => console.error('[preload] failed, starting anyway', err))
    .finally(() => {
      loading.finish();
      game.start();
    });
});
