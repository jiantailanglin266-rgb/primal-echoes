import { HudView, createHudModel } from './HudView';
import { DamageNumberView } from './DamageNumberView';
import { Vec3 } from '@shared/math/Vec3';

/**
 * `?hud=1`: ゲームを起動せず HUD の全状態を確認する。
 * 右上のボタンで状態を切り替え、方位帯は自動で回る。
 */
export class HudDebug {
  private readonly hud: HudView;
  private readonly model = createHudModel();
  private readonly numbers: DamageNumberView;
  private heading = 0;
  private last = performance.now();
  private hpDrain = false;

  constructor(root: HTMLElement) {
    root.style.background = 'linear-gradient(180deg, #5d6b58 0%, #3a4536 60%, #26301f 100%)';
    this.hud = new HudView(root);
    this.numbers = new DamageNumberView(root, (world, out) => {
      out.x = world.x;
      out.y = world.y;
      out.visible = true;
    });
    const m = this.model;
    m.weaponName = '巨断刀・壱';
    m.sharpnessLabel = '斬れ味: 鋭';
    m.objective = 'ヴァルガロン を討伐せよ';
    m.timeRemaining = 1490;
    m.maxDowns = 3;
    m.itemName = '蘇生薬';
    m.itemCount = 5;
    m.monsterName = 'ヴァルガロン';
    m.monsterTitle = '峡谷の岩王';
    m.outpostBearingRad = 2.4;

    const panel = document.createElement('div');
    panel.className = 'pe-hud-debug';
    const states: [string, () => void][] = [
      ['通常', () => this.normal()],
      ['低体力', () => { this.normal(); m.hpRatio = 0.18; }],
      ['体力減少', () => { this.normal(); this.hpDrain = true; }],
      ['気力切れ', () => { this.normal(); m.staminaRatio = 0; }],
      ['獣 登場', () => { this.normal(); m.monsterVisible = true; m.beastBearingRad = 0.4; this.hud.reset(); this.hud.beastIntro(m.monsterName, m.monsterTitle); }],
      ['獣 怒り', () => { this.normal(); m.monsterVisible = true; m.beastBearingRad = -0.8; m.lockOn = true; m.monsterHpRatio = 0.42; m.monsterBadges = ['怒り', '角 破壊']; }],
      ['剥ぎ取り', () => { this.normal(); m.prompt = '剥いでいる'; m.promptProgress = 0.55; }],
      ['案内', () => { this.normal(); m.prompt = 'E  剥ぐ（残り 3）'; }],
      ['膝をつく', () => { this.normal(); m.respawnCountdown = 4.2; m.downs = 1; m.hpRatio = 0; }],
      ['通知', () => { this.normal(); m.notices = ['ヴァルガロンの岩鱗 ×2 を得た']; }],
      ['バナー', () => { this.normal(); this.hud.banner('角を砕いた'); window.setTimeout(() => this.hud.banner('苔の谷底', 'strong'), 500); }],
      ['ダメージ', () => { this.normal(); this.burst(); }],
      ['雨・刻限', () => { this.normal(); m.raining = true; m.timeRemaining = 240; m.timeWarning = true; }],
      ['手引き', () => { this.normal(); this.hud.showTutorial(['W A S D　歩く', 'Shift　駆ける', 'Space　躱す', 'J / K　斬る / 振り下ろす', 'Tab　獣を見据える'], 12); }],
    ];
    for (const [label, apply] of states) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', apply);
      panel.appendChild(b);
    }
    root.appendChild(panel);
    this.normal();
    requestAnimationFrame(this.tick);
  }

  private normal(): void {
    const m = this.model;
    this.hpDrain = false;
    m.hpRatio = 0.82;
    m.staminaRatio = 0.7;
    m.monsterVisible = false;
    m.beastBearingRad = null;
    m.lockOn = false;
    m.monsterHpRatio = 1;
    m.monsterBadges = [];
    m.prompt = '';
    m.promptProgress = 0;
    m.respawnCountdown = 0;
    m.downs = 0;
    m.notices = [];
    m.raining = false;
    m.timeWarning = false;
    m.timeRemaining = 1490;
  }

  private burst(): void {
    const center = new Vec3(window.innerWidth * 0.55, window.innerHeight * 0.45, 0);
    let n = 0;
    const timer = window.setInterval(() => {
      const crit = n % 3 === 2;
      this.numbers.spawn(new Vec3(center.x + (Math.random() - 0.5) * 30, center.y + (Math.random() - 0.5) * 20, 0), crit ? 186 : 64 + n * 3, { critical: crit });
      if (++n >= 8) window.clearInterval(timer);
    }, 120);
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.heading += dt * 0.35;
    this.model.headingRad = this.heading;
    if (this.hpDrain) this.model.hpRatio = Math.max(0.1, this.model.hpRatio - dt * 0.35);
    this.hud.render(this.model, dt);
    this.numbers.update(dt);
    requestAnimationFrame(this.tick);
  };
}
