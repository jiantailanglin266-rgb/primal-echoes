import { createScreenRoot, q, type Screen } from './Screen';

/** 語り部（クレジット）。文章は B5 で確定する。 */
export class CreditsScreen implements Screen {
  readonly id = 'credits';
  readonly root: HTMLElement;
  onBack: (() => void) | null = null;

  constructor(studioName: string) {
    this.root = createScreenRoot('pe-credits', `
      <div class="pe-sub__inner pe-sub__inner--narrow">
        <header class="pe-sub__header">
          <div class="pe-eyebrow">Credits</div>
          <h1 class="pe-heading">語り部</h1>
        </header>
        <dl class="pe-credits__list">
          <dt>制作</dt><dd>${studioName}</dd>
          <dt>設計・実装</dt><dd>Kenta</dd>
          <dt>世界と獣</dt><dd>すべてこの作品のために新しく作られた。既存の作品から借りたものは何もない。</dd>
          <dt>技術</dt><dd>TypeScript / Three.js / Vite / Web Audio</dd>
          <dt>書体</dt><dd>Cinzel（Natanael Gama）、Shippori Mincho（FONTDASU）、Cormorant Garamond（Christian Thalmann）— SIL Open Font License</dd>
          <dt>音</dt><dd>合成音（Web Audio）。素材音源が入る場合は README に出典を記す</dd>
        </dl>
        <p class="pe-credits__close">原初は、まだ鳴っている。</p>
        <footer class="pe-sub__foot"><button class="pe-button pe-menu-item pe-sub__back is-default">戻る</button></footer>
      </div>`);
    q(this.root, '.pe-sub__back').addEventListener('click', () => this.onBack?.());
  }
}
