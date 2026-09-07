import type { GameManager } from '@app/GameManager';
import { FreeCamera } from './FreeCamera';
import { assetUrl } from '@presentation/render/assetUrl';

interface Pose {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export interface TrailerCut {
  /** カットの長さ（秒）。 */
  seconds: number;
  from: Pose;
  to: Pose;
  /** 画面に出す一行（無ければ出さない）。 */
  text?: string;
  /** 獣をこの位置に置く（AI 停止）。 */
  beast?: { x: number; z: number; yaw: number };
  /** 最後のロゴカード。 */
  logo?: boolean;
  /** カット頭のフェードイン秒。 */
  fadeIn?: number;
}

/**
 * docs/brand/TRAILER_STORYBOARD.md の 60 秒構成。位置は翠嵐峡谷の座標（前哨 0,0 / 苔の谷底 -48,42 / 白瀬 52,38 / 獣の寝床 22,-66）。
 */
export const TRAILER_CUTS: readonly TrailerCut[] = [
  { seconds: 6, fadeIn: 2, from: { x: -20, y: 26, z: 10, lookX: -48, lookY: 4, lookZ: 42 }, to: { x: -30, y: 14, z: 22, lookX: -48, lookY: 2, lookZ: 42 }, text: 'ヴァルディア。海図の外の大陸。' },
  { seconds: 6, fadeIn: 0.6, from: { x: 40, y: 2.2, z: 26, lookX: 52, lookY: 1, lookZ: 38 }, to: { x: 46, y: 1.8, z: 30, lookX: 56, lookY: 1, lookZ: 42 }, text: '痕跡は嘘をつかない。' },
  { seconds: 6, fadeIn: 0.6, from: { x: 8, y: 2.6, z: -8, lookX: 0, lookY: 1.6, lookZ: 0 }, to: { x: -8, y: 2.2, z: -7, lookX: 0, lookY: 1.4, lookZ: 0 }, text: '狩人は、聴く者だ。' },
  { seconds: 8, fadeIn: 0.8, from: { x: -30, y: 6, z: 18, lookX: -48, lookY: 3, lookZ: 42 }, to: { x: -40, y: 3.5, z: 30, lookX: -48, lookY: 3, lookZ: 42 }, beast: { x: -48, z: 42, yaw: 2.4 }, text: '原獣。原初の残響を、最も濃く宿す獣。' },
  { seconds: 8, fadeIn: 0.4, from: { x: -42, y: 2.4, z: 36, lookX: -48, lookY: 3.2, lookZ: 42 }, to: { x: -54, y: 2.0, z: 36, lookX: -48, lookY: 3.0, lookZ: 42 }, beast: { x: -48, z: 42, yaw: 2.4 } },
  { seconds: 8, fadeIn: 0.2, from: { x: -46, y: 1.6, z: 33, lookX: -48, lookY: 2.4, lookZ: 42 }, to: { x: -44, y: 1.2, z: 38, lookX: -48, lookY: 2.6, lookZ: 42 }, beast: { x: -48, z: 42, yaw: 2.4 }, text: '重く。短く。' },
  { seconds: 8, fadeIn: 0.8, from: { x: 30, y: 6, z: -50, lookX: 22, lookY: 2, lookZ: -66 }, to: { x: 24, y: 2.4, z: -58, lookX: 22, lookY: 1.5, lookZ: -66 }, text: '深く傷ついた獣は、寝床へ帰る。' },
  { seconds: 6, fadeIn: 0.8, from: { x: 0, y: 40, z: -30, lookX: -10, lookY: 0, lookZ: 30 }, to: { x: 6, y: 52, z: -44, lookX: -10, lookY: 0, lookZ: 30 }, text: '原初は、まだ鳴っている。' },
  { seconds: 4, fadeIn: 1.0, from: { x: 0, y: 2, z: -6, lookX: 0, lookY: 1, lookZ: 0 }, to: { x: 0, y: 2, z: -6, lookX: 0, lookY: 1, lookZ: 0 }, logo: true },
];

/** `?trailer=1`: 60 秒のカメラパスを再生する。Space で一時停止、R で最初から、数字キーでカットへ。 */
export class TrailerCam {
  readonly camera = new FreeCamera();
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;
  private readonly fade: HTMLElement;
  private readonly logo: HTMLElement;
  private index = 0;
  private elapsed = 0;
  private playing = true;

  constructor(private readonly game: GameManager) {
    game.enterToolMode(this.camera);
    this.root = document.createElement('div');
    this.root.className = 'pe-trailer';
    this.root.innerHTML = `
      <div class="pe-trailer__bars"></div>
      <div class="pe-trailer__text"></div>
      <div class="pe-trailer__logo" hidden><img src="${assetUrl('assets/brand/logo-vertical.svg')}" alt="PRIMAL ECHOES" /><div class="pe-trailer__tag">原初は、まだ鳴っている。</div></div>
      <div class="pe-trailer__fade"></div>`;
    document.body.appendChild(this.root);
    this.text = this.root.querySelector('.pe-trailer__text') as HTMLElement;
    this.fade = this.root.querySelector('.pe-trailer__fade') as HTMLElement;
    this.logo = this.root.querySelector('.pe-trailer__logo') as HTMLElement;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') this.playing = !this.playing;
      if (e.code === 'KeyR') this.goto(0);
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= TRAILER_CUTS.length) this.goto(n - 1);
    });
    this.goto(0);
    game.audio.setMusic('title');
  }

  private goto(index: number): void {
    this.index = Math.min(TRAILER_CUTS.length - 1, Math.max(0, index));
    this.elapsed = 0;
    const cut = TRAILER_CUTS[this.index] as TrailerCut;
    const w = this.game.world;
    if (cut.beast) {
      w.monster.teleport(cut.beast.x, cut.beast.z, cut.beast.yaw);
      w.monsterAI.paused = true;
      this.game.setBeastVisible(true);
    } else this.game.setBeastVisible(false);
    this.logo.hidden = !cut.logo;
    this.text.textContent = cut.text ?? '';
    this.text.classList.toggle('is-on', Boolean(cut.text));
    // 音楽の山: 獣の登場から戦闘の層、寝床で静める
    if (this.index === 3) this.game.audio.setMusic('combat', 0.5);
    else if (this.index === 5) this.game.audio.setMusicHeat(1);
    else if (this.index >= 6) this.game.audio.setMusic('resolve');
  }

  update(dt: number): void {
    if (!this.playing) return;
    const cut = TRAILER_CUTS[this.index] as TrailerCut;
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / cut.seconds);
    const e = t * t * (3 - 2 * t);
    const p = (a: number, b: number): number => a + (b - a) * e;
    this.camera.set(p(cut.from.x, cut.to.x), p(cut.from.y, cut.to.y), p(cut.from.z, cut.to.z), p(cut.from.lookX, cut.to.lookX), p(cut.from.lookY, cut.to.lookY), p(cut.from.lookZ, cut.to.lookZ));
    const fadeIn = cut.fadeIn ?? 0.5;
    const fadeOut = 0.5;
    const dark = this.elapsed < fadeIn ? 1 - this.elapsed / fadeIn : this.elapsed > cut.seconds - fadeOut ? (this.elapsed - (cut.seconds - fadeOut)) / fadeOut : 0;
    this.fade.style.opacity = String(Math.max(0, Math.min(1, cut.logo ? Math.max(dark, 0.92) : dark)));
    if (t >= 1) {
      if (this.index < TRAILER_CUTS.length - 1) this.goto(this.index + 1);
      else this.playing = false;
    }
  }
}
