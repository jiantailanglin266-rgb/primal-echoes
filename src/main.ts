import { GameManager, nextFrame } from '@app/GameManager';
import { LoadingScreen } from '@ui/screens/LoadingScreen';

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
const params = new URLSearchParams(window.location.search);

if (params.get('hud') === '1') {
  // HUD の全状態を確認するモード（ゲームは起動しない）
  void import('@ui/hud/HudDebug').then(({ HudDebug }) => new HudDebug(uiRoot));
} else {
  boot();
}

function boot(): void {
  const loading = new LoadingScreen();
  loading.root.classList.add('pe-screen-anim');
  uiRoot.appendChild(loading.root);

  // ローディング画面を 1 フレーム描かせてから重い初期化に入る
  void nextFrame().then(() => {
    loading.set(0.02, '大陸を起こす');
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
        // 環が満ちてから、少し置いて消す
        window.setTimeout(() => {
          loading.root.classList.add('is-leaving');
          window.setTimeout(() => loading.root.remove(), 400);
          void game.showOpening({ skip: params.get('bot') === '1' || params.get('skipIntro') === '1' });
        }, 350);
      });
  });
}
