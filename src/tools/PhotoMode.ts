import type { GameManager } from '@app/GameManager';
import { FreeCamera } from './FreeCamera';

/**
 * `?photo=1`: HUD と画面を消し、自由カメラで撮る。
 * 右下の小さな道具箱: 2× / 4× で保存、獣を呼ぶ、雨、太陽の高さ、道具箱を隠す（H）。
 */
export class PhotoMode {
  readonly camera = new FreeCamera();
  private readonly root: HTMLElement;
  private beastSummoned = false;

  constructor(private readonly game: GameManager, uiRoot: HTMLElement, canvas: HTMLCanvasElement) {
    const world = game.world;
    this.camera.groundHeight = (x, z) => world.field.terrain.getHeight(x, z);
    const spawn = world.field.def.playerSpawn;
    this.camera.set(spawn.x + 6, 3.2, spawn.z - 9, spawn.x, 1.4, spawn.z);
    this.camera.attach(canvas);
    game.enterToolMode(this.camera);

    this.root = document.createElement('div');
    this.root.className = 'pe-tool';
    this.root.innerHTML = `
      <div class="pe-tool__title">Photo</div>
      <button data-act="shot2">撮る ×2</button>
      <button data-act="shot4">撮る ×4</button>
      <button data-act="beast">獣を呼ぶ</button>
      <button data-act="rain">雨</button>
      <label>太陽 <input type="range" min="5" max="85" value="52" data-act="sun" /></label>
      <label>時刻の色 <input type="range" min="0" max="360" value="35" data-act="azimuth" /></label>
      <div class="pe-tool__hint">ドラッグ 向き / W A S D 移動 / Q E 上下 / Shift 速く / H 道具箱を隠す</div>
      <a class="pe-tool__link" hidden download="primal-echoes.png">保存する</a>`;
    uiRoot.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset['act'];
      if (act === 'shot2') this.capture(2);
      else if (act === 'shot4') this.capture(4);
      else if (act === 'beast') this.summonBeast();
      else if (act === 'rain') world.weather.force(world.weather.isRaining ? 'clear' : 'rain');
    });
    this.root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset['act'] === 'sun') this.setSun(undefined, Number(el.value));
      if (el.dataset['act'] === 'azimuth') this.setSun(Number(el.value), undefined);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') this.root.hidden = !this.root.hidden;
    });
  }

  private setSun(azimuth?: number, elevation?: number): void {
    const { lighting, environment } = this.game.world;
    lighting.setSun(azimuth ?? lighting.sun.azimuthDeg, elevation ?? lighting.sun.elevationDeg);
    environment.onSunChanged();
  }

  /** 獣をカメラの前 12m に置き、AI を止める。 */
  private summonBeast(): void {
    const w = this.game.world;
    const fwd = this.camera.forward();
    const x = this.camera.position.x + fwd.x * 12;
    const z = this.camera.position.z + fwd.z * 12;
    w.monster.teleport(x, z, Math.atan2(-fwd.x, -fwd.z));
    w.monsterAI.paused = true;
    this.beastSummoned = true;
    this.game.setBeastVisible(true);
  }

  private capture(scale: number): void {
    const url = this.game.captureScreenshot(scale);
    const link = this.root.querySelector<HTMLAnchorElement>('.pe-tool__link');
    if (!link) return;
    link.href = url;
    link.hidden = false;
    link.textContent = `保存する（×${scale}）`;
    // 新しいタブでも見られるように
    window.open(url, '_blank');
  }

  get hasBeast(): boolean {
    return this.beastSummoned;
  }
}
