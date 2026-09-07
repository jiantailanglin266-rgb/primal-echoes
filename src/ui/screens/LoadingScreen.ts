import { createScreenRoot, q, type Screen } from './Screen';
import { symbolSvg } from '../brand';

/** B5 で 30 本に増やす。世界の断片を、謎に少しずつ触れる順で。 */
export const FLAVOR_PLACEHOLDER: readonly string[] = [
  '大陸の岩盤には、原初の力が層をなして眠っている。',
  '獣の甲殻の亀裂が光るのは、原初の力が表面に滲むからだ。',
  '足跡は嘘をつかない。深さは重さを、間隔は急ぎを語る。',
  '雨の日、獣は洞へ退く。追うなら、その前に。',
  '前哨の柱は獣の骨で組まれている。折れたことはない。',
];

const RING_LENGTHS = [2 * Math.PI * 14, 2 * Math.PI * 27, 2 * Math.PI * 40];

/**
 * ローディング画面。進捗はバーではなく、シンボルの三重の環が内側から満ちていく。
 * ラベルは世界の言葉（「アセット」「シェーダ」などは出さない）。
 */
export class LoadingScreen implements Screen {
  readonly id = 'loading';
  readonly root: HTMLElement;
  private readonly rings: SVGCircleElement[];
  private finished = false;

  constructor() {
    this.root = createScreenRoot('pe-loading', `
      <div class="pe-loading__inner">
        <div class="pe-loading__symbol">${symbolSvg('pe-loading__rings')}</div>
        <div class="pe-loading__label">耳を澄ませている</div>
        <div class="pe-loading__flavor"></div>
      </div>`);
    this.rings = Array.from(this.root.querySelectorAll<SVGCircleElement>('.pe-sym-ring'));
    this.rings.forEach((ring, i) => {
      const len = RING_LENGTHS[i] ?? 100;
      ring.style.strokeDasharray = `${len}`;
      ring.style.strokeDashoffset = `${len}`;
    });
    this.showFlavor();
  }

  showFlavor(): void {
    const pick = FLAVOR_PLACEHOLDER[Math.floor(Math.random() * FLAVOR_PLACEHOLDER.length)] ?? '';
    q(this.root, '.pe-loading__flavor').textContent = pick;
  }

  /** ratio 0〜1。内側の環から順に満ちる。 */
  set(ratio: number, label: string): void {
    if (this.finished) return;
    const r = Math.max(0, Math.min(1, ratio));
    this.rings.forEach((ring, i) => {
      const len = RING_LENGTHS[i] ?? 100;
      const p = Math.max(0, Math.min(1, r * 3 - i));
      ring.style.strokeDashoffset = `${len * (1 - p)}`;
    });
    q(this.root, '.pe-loading__label').textContent = label;
  }

  finish(): void {
    this.finished = true;
    this.rings.forEach((ring) => (ring.style.strokeDashoffset = '0'));
  }

  reset(): void {
    this.finished = false;
    this.set(0, '耳を澄ませている');
    this.showFlavor();
  }
}
