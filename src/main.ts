import { GameManager, nextFrame } from '@app/GameManager';
import { LoadingScreen } from '@ui/screens/LoadingScreen';
import { getLanguage, t } from '@i18n/index';
import { LandingView } from '@ui/landing/LandingView';

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
document.documentElement.lang = getLanguage();

if (params.get('hud') === '1') {
  // HUD の全状態を確認するモード（ゲームは起動しない）
  void import('@ui/hud/HudDebug').then(({ HudDebug }) => new HudDebug(uiRoot));
} else {
  boot();
}

function boot(): void {
  const tool = params.get('photo') === '1' ? 'photo' : params.get('trailer') === '1' ? 'trailer' : null;
  const skipIntro = params.get('bot') === '1' || params.get('skipIntro') === '1' || tool !== null;
  // ランディング（index.html の最初の画面）。飛ばすときはローディング画面が最初の一幕になる
  const useLanding = !skipIntro && params.get('landing') !== '0';
  const landing = useLanding ? new LandingView(uiRoot) : null;
  const loading = landing ? null : new LoadingScreen();
  if (loading) {
    loading.root.classList.add('pe-screen-anim');
    uiRoot.appendChild(loading.root);
  }
  const progress = (ratio: number, label: string): void => {
    loading?.set(ratio, label);
    landing?.setProgress(label);
  };

  // ローディング画面を 1 フレーム描かせてから重い初期化に入る
  void nextFrame().then(() => {
    progress(0.02, t('loading.steps.world'));
    const game = new GameManager(canvas, uiRoot, debugRoot);
    // 開発中にコンソールから触れるように公開する（本番ビルドでは無効化予定）
    if (import.meta.env.DEV) {
      (window as unknown as { __game: GameManager }).__game = game;
    }
    game
      .preload(progress)
      .then((report) => {
        console.info(`[preload] ${report.seconds.toFixed(2)}s quality=${game.quality.current}`);
      })
      .catch((err: unknown) => console.error('[preload] failed, starting anyway', err))
      .finally(() => {
        game.start();
        if (tool === 'photo') {
          void import('@tools/PhotoMode').then(({ PhotoMode }) => new PhotoMode(game, uiRoot, canvas));
          return;
        }
        if (tool === 'trailer') {
          void import('@tools/TrailerCam').then(({ TrailerCam }) => {
            const trailer = new TrailerCam(game);
            let last = performance.now();
            const tick = (now: number): void => {
              trailer.update(Math.min(0.1, (now - last) / 1000));
              last = now;
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          return;
        }
        if (landing) {
          // ランディングの「狩りに出る」でスタジオ → メニューへ（ランディングがタイトルを兼ねる）
          landing.setReady(true);
          game.enterBackdrop();
          landing.onStart = () => {
            game.audio.unlock();
            game.audio.playLogo();
            landing.hide();
            void game.showOpening({ skipTitle: true });
          };
          return;
        }
        if (loading) {
          loading.finish();
          // 環が満ちてから、少し置いて消す
          window.setTimeout(() => {
            loading.root.classList.add('is-leaving');
            window.setTimeout(() => loading.root.remove(), 400);
            void game.showOpening({ skip: skipIntro });
          }, 350);
        }
      });
  });
}
