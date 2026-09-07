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
  /** 重なり回避のための横ずれ（px）と縦の段。 */
  offsetX: number;
  lane: number;
}

const LIFETIME_SECONDS = 0.85;
const RISE_PX = 44;
const LANE_PX = 18;
/** この距離（px）以内に出た直後の数字とは段をずらす。 */
const CROWD_PX = 40;

/**
 * 命中位置に浮かぶダメージ数字（DOM）。
 * 小さく・短く・数を絞る。同じ場所に続けて出るときは段と横位置をずらして重ねない。
 */
export class DamageNumberView {
  private readonly active: FloatingNumber[] = [];
  private readonly point: ScreenPoint = { x: 0, y: 0, visible: false };
  private spawnCounter = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly project: WorldProjector,
  ) {}

  spawn(world: Vec3, amount: number, options: { critical?: boolean; partBroken?: boolean; player?: boolean } = {}): void {
    const element = document.createElement('div');
    element.className = 'pe-damage';
    if (options.critical) element.classList.add('is-critical');
    if (options.partBroken) element.classList.add('is-break');
    if (options.player) element.classList.add('is-player');
    element.textContent = String(Math.round(amount));
    this.root.appendChild(element);

    // 直近の数字と近ければ段を上げ、左右へ交互にずらす
    this.project(world, this.point);
    let lane = 0;
    for (const other of this.active) {
      if (other.age > LIFETIME_SECONDS * 0.6) continue;
      this.project(other.world, this.point);
      const ox = this.point.x;
      const oy = this.point.y;
      this.project(world, this.point);
      if (Math.abs(ox - this.point.x) < CROWD_PX && Math.abs(oy - this.point.y) < CROWD_PX) lane = Math.max(lane, other.lane + 1);
    }
    this.spawnCounter++;
    const offsetX = lane === 0 ? 0 : (this.spawnCounter % 2 === 0 ? 1 : -1) * 14 * Math.min(2, lane);
    this.active.push({ element, world: world.clone(), age: 0, offsetX, lane: Math.min(lane, 3) });
    while (this.active.length > 12) {
      const old = this.active.shift();
      old?.element.remove();
    }
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
      const y = this.point.y - entry.lane * LANE_PX - RISE_PX * easeOut(t);
      entry.element.style.transform = `translate(-50%, -50%) translate(${(this.point.x + entry.offsetX).toFixed(1)}px, ${y.toFixed(1)}px)`;
      entry.element.style.opacity = String(t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    }
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
