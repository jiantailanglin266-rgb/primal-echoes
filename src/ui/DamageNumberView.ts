import { Vec3 } from '@shared/math/Vec3';

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export type WorldProjector = (world: Vec3, out: ScreenPoint) => void;

interface FloatingNumber {
  element: HTMLElement;
  world: Vec3;
  age: number;
}

const LIFETIME_SECONDS = 0.85;
const RISE_PX = 48;

/**
 * 命中位置に浮かぶダメージ数字（DOM）。
 * 「敵の動きが見えなくなる過剰演出」を避けるため、小さく・短く・数を絞る。
 */
export class DamageNumberView {
  private readonly active: FloatingNumber[] = [];
  private readonly point: ScreenPoint = { x: 0, y: 0, visible: false };

  constructor(
    private readonly root: HTMLElement,
    private readonly project: WorldProjector,
  ) {}

  spawn(world: Vec3, amount: number, options: { critical?: boolean; partBroken?: boolean; player?: boolean } = {}): void {
    const element = document.createElement('div');
    element.className = 'pe-damage-number';
    if (options.critical) element.classList.add('is-critical');
    if (options.partBroken) element.classList.add('is-break');
    if (options.player) element.classList.add('is-player');
    element.textContent = String(Math.round(amount));
    this.root.appendChild(element);
    this.active.push({ element, world: world.clone(), age: 0 });
  }

  update(frameDt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i] as FloatingNumber;
      entry.age += frameDt;
      const t = entry.age / LIFETIME_SECONDS;
      if (t >= 1) {
        entry.element.remove();
        this.active.splice(i, 1);
        continue;
      }
      this.project(entry.world, this.point);
      entry.element.hidden = !this.point.visible;
      entry.element.style.transform = `translate(-50%, -50%) translate(${this.point.x.toFixed(1)}px, ${(this.point.y - RISE_PX * easeOut(t)).toFixed(1)}px)`;
      entry.element.style.opacity = String(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
