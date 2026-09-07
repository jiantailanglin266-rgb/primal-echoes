import { assetUrl } from '@presentation/render/assetUrl';

/**
 * 戦闘中 HUD（docs/brand/VISUAL_IDENTITY.md、BRAND_BIBLE §4）。
 * 配置: 左上 = 自分（刃・体力・気力・膝）、右上 = 方位と刻限、上中央 = 獣（登場演出 → 小さな体力）、
 * 下中央 = 薬の枠と手元の案内、下中央の少し上 = 一行のバナー。同時に見せる要素は最大 5 つ。
 * ゲーム状態は GameManager が毎フレーム組む HudModel（値のみ）で受け取り、ロジックへの参照は持たない。
 */
export interface HudModel {
  hpRatio: number;
  staminaRatio: number;
  weaponName: string;
  weaponKind: 'blade' | 'saber' | 'hammer' | 'bow';
  sharpnessLabel: string;
  objective: string;
  timeRemaining: number;
  timeWarning: boolean;
  raining: boolean;
  monsterName: string;
  monsterTitle: string;
  monsterVisible: boolean;
  monsterHpRatio: number;
  monsterBadges: string[];
  lockOn: boolean;
  downs: number;
  maxDowns: number;
  /** 戦闘不能中の復帰カウント（0 で非表示）。 */
  respawnCountdown: number;
  /** 操作案内（空で非表示）。 */
  prompt: string;
  /** 剥ぎ取りなどの進捗 0〜1（0 で非表示）。 */
  promptProgress: number;
  /** 直近に入手したものなどの小さな通知。 */
  notices: string[];
  itemName: string;
  itemCount: number;
  itemKey: string;
  /** カメラの向き（rad）。方位帯の基準。 */
  headingRad: number;
  /** 獣の方位（rad、見えていないときは null）。 */
  beastBearingRad: number | null;
  /** 前哨の方位（rad）。 */
  outpostBearingRad: number;
}

export function createHudModel(): HudModel {
  return {
    hpRatio: 1,
    staminaRatio: 1,
    weaponName: '',
    weaponKind: 'blade',
    sharpnessLabel: '',
    objective: '',
    timeRemaining: 0,
    timeWarning: false,
    raining: false,
    monsterName: '',
    monsterTitle: '',
    monsterVisible: false,
    monsterHpRatio: 1,
    monsterBadges: [],
    lockOn: false,
    downs: 0,
    maxDowns: 0,
    respawnCountdown: 0,
    prompt: '',
    promptProgress: 0,
    notices: [],
    itemName: '',
    itemCount: 0,
    itemKey: 'H',
    headingRad: 0,
    beastBearingRad: null,
    outpostBearingRad: 0,
  };
}

const ICONS = assetUrl('assets/brand/icons.svg');
/** 方位帯が映す範囲（左右それぞれ）。 */
const COMPASS_HALF_RAD = Math.PI * 0.42;
const BANNER_SECONDS = 1.5;
const INTRO_SECONDS = 3.0;
const LOW_HP = 0.3;
/** 遅延バーが実際の値へ追いつく速さ（1/秒）。 */
const GHOST_SPEED = 0.6;

interface Banner {
  element: HTMLElement;
  remaining: number;
}

export class HudView {
  readonly root: HTMLElement;
  /** 気力が尽きた瞬間（小さな警告音のため）。 */
  onStaminaEmpty: (() => void) | null = null;

  private readonly hpFill: HTMLElement;
  private readonly hpGhost: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly weaponIcon: SVGUseElement;
  private readonly knees: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly compassTrack: HTMLElement;
  private readonly compassBeast: HTMLElement;
  private readonly compassOutpost: HTMLElement;
  private readonly rain: HTMLElement;
  private readonly beast: HTMLElement;
  private readonly beastName: HTMLElement;
  private readonly beastFill: HTMLElement;
  private readonly badges: HTMLElement;
  private readonly intro: HTMLElement;
  private readonly introName: HTMLElement;
  private readonly introTitle: HTMLElement;
  private readonly respawn: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly promptFill: HTMLElement;
  private readonly notices: HTMLElement;
  private readonly item: HTMLElement;
  private readonly itemCount: HTMLElement;
  private readonly itemName: HTMLElement;
  private readonly itemKey: HTMLElement;
  private readonly bannerHost: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly tutorial: HTMLElement;

  private lastBadges = '';
  private lastNotices = '';
  private ghostRatio = 1;
  private lastStamina = 1;
  private introRemaining = 0;
  private introShown = false;
  private readonly banners: Banner[] = [];
  private tutorialRemaining = 0;
  private lastWeaponKind = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', 'pe-hud');
    this.root.innerHTML = `
      <div class="pe-hud__vignette" aria-hidden="true"></div>
      <div class="pe-hud__player">
        <div class="pe-hud__weapon"><svg class="pe-icon"><use href="${ICONS}#pe-icon-blade"/></svg><span class="pe-hud__weapon-name"></span></div>
        <div class="pe-hud__bar pe-hud__bar--hp"><i class="pe-hud__ghost"></i><i class="pe-hud__fill"></i></div>
        <div class="pe-hud__bar pe-hud__bar--stamina"><i class="pe-hud__fill"></i></div>
        <div class="pe-hud__knees"></div>
      </div>
      <div class="pe-hud__nav">
        <div class="pe-hud__compass">
          <div class="pe-hud__compass-track"></div>
          <div class="pe-hud__compass-mark pe-hud__compass-mark--outpost"><svg class="pe-icon"><use href="${ICONS}#pe-icon-cave"/></svg></div>
          <div class="pe-hud__compass-mark pe-hud__compass-mark--beast"><svg class="pe-icon"><use href="${ICONS}#pe-icon-echo"/></svg></div>
          <div class="pe-hud__compass-needle"></div>
        </div>
        <div class="pe-hud__timer"></div>
        <div class="pe-hud__objective"><svg class="pe-icon pe-hud__rain"><use href="${ICONS}#pe-icon-rain"/></svg><span></span></div>
      </div>
      <div class="pe-hud__intro" hidden>
        <div class="pe-hud__intro-title"></div>
        <div class="pe-hud__intro-name"></div>
      </div>
      <div class="pe-hud__beast" hidden>
        <div class="pe-hud__beast-name"></div>
        <div class="pe-hud__bar pe-hud__bar--beast"><i class="pe-hud__fill"></i></div>
        <div class="pe-hud__badges"></div>
      </div>
      <div class="pe-hud__respawn" hidden></div>
      <div class="pe-hud__banners"></div>
      <div class="pe-hud__bottom">
        <div class="pe-hud__notices"></div>
        <div class="pe-hud__prompt" hidden>
          <div class="pe-hud__prompt-text"></div>
          <div class="pe-hud__bar pe-hud__bar--prompt"><i class="pe-hud__fill"></i></div>
        </div>
        <div class="pe-hud__slots">
          <div class="pe-hud__slot">
            <svg class="pe-icon"><use href="${ICONS}#pe-icon-potion"/></svg>
            <span class="pe-hud__slot-count"></span>
            <span class="pe-hud__slot-key"></span>
            <span class="pe-hud__slot-name"></span>
          </div>
        </div>
      </div>
      <div class="pe-hud__tutorial" hidden></div>
    `;
    parent.appendChild(this.root);
    this.vignette = q(this.root, '.pe-hud__vignette');
    this.hpFill = q(this.root, '.pe-hud__bar--hp .pe-hud__fill');
    this.hpGhost = q(this.root, '.pe-hud__ghost');
    this.staminaFill = q(this.root, '.pe-hud__bar--stamina .pe-hud__fill');
    this.weapon = q(this.root, '.pe-hud__weapon-name');
    this.weaponIcon = q<SVGUseElement>(this.root, '.pe-hud__weapon use');
    this.knees = q(this.root, '.pe-hud__knees');
    this.objective = q(this.root, '.pe-hud__objective span');
    this.rain = q(this.root, '.pe-hud__rain');
    this.timer = q(this.root, '.pe-hud__timer');
    this.compassTrack = q(this.root, '.pe-hud__compass-track');
    this.compassBeast = q(this.root, '.pe-hud__compass-mark--beast');
    this.compassOutpost = q(this.root, '.pe-hud__compass-mark--outpost');
    this.beast = q(this.root, '.pe-hud__beast');
    this.beastName = q(this.root, '.pe-hud__beast-name');
    this.beastFill = q(this.root, '.pe-hud__bar--beast .pe-hud__fill');
    this.badges = q(this.root, '.pe-hud__badges');
    this.intro = q(this.root, '.pe-hud__intro');
    this.introName = q(this.root, '.pe-hud__intro-name');
    this.introTitle = q(this.root, '.pe-hud__intro-title');
    this.respawn = q(this.root, '.pe-hud__respawn');
    this.prompt = q(this.root, '.pe-hud__prompt');
    this.promptText = q(this.root, '.pe-hud__prompt-text');
    this.promptFill = q(this.root, '.pe-hud__bar--prompt .pe-hud__fill');
    this.notices = q(this.root, '.pe-hud__notices');
    this.item = q(this.root, '.pe-hud__slot');
    this.itemCount = q(this.root, '.pe-hud__slot-count');
    this.itemName = q(this.root, '.pe-hud__slot-name');
    this.itemKey = q(this.root, '.pe-hud__slot-key');
    this.bannerHost = q(this.root, '.pe-hud__banners');
    this.tutorial = q(this.root, '.pe-hud__tutorial');
    this.buildCompassTrack();
  }

  set visible(value: boolean) {
    this.root.hidden = !value;
  }

  /** 狩りの開始時に呼ぶ。登場演出とバナーを初期化する。 */
  reset(): void {
    this.introShown = false;
    this.introRemaining = 0;
    this.intro.hidden = true;
    this.ghostRatio = 1;
    for (const b of this.banners) b.element.remove();
    this.banners.length = 0;
  }

  /** 画面中央下の一行バナー（部位破壊・討伐・新しい土地）。1.5 秒でフェード。 */
  banner(text: string, kind: 'plain' | 'strong' = 'plain'): void {
    // 同じ文言の連続は出さない
    if (this.banners.some((b) => b.element.textContent === text)) return;
    const element = el('div', `pe-hud__banner${kind === 'strong' ? ' is-strong' : ''}`, text);
    this.bannerHost.appendChild(element);
    this.banners.push({ element, remaining: BANNER_SECONDS });
    while (this.banners.length > 2) {
      const old = this.banners.shift();
      old?.element.remove();
    }
  }

  /** 獣の登場演出。名前と二つ名を大きく出し、3 秒後に上部の小さな体力表示へ縮む。 */
  beastIntro(name: string, title: string): void {
    if (this.introShown) return;
    this.introShown = true;
    this.introRemaining = INTRO_SECONDS;
    setText(this.introName, name);
    setText(this.introTitle, title);
    this.intro.hidden = false;
    this.intro.classList.remove('is-leaving');
  }

  /** 初回だけ右下に小さく操作を出す（モーダルにしない）。 */
  showTutorial(lines: readonly string[], seconds = 24): void {
    this.tutorial.replaceChildren(...lines.map((l) => el('div', 'pe-hud__tutorial-line', l)));
    this.tutorial.hidden = false;
    this.tutorial.classList.remove('is-leaving');
    this.tutorialRemaining = seconds;
  }

  /** 実時間で演出を進める（バナー・登場・遅延バー）。 */
  update(frameDt: number): void {
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i] as Banner;
      b.remaining -= frameDt;
      if (b.remaining <= BANNER_SECONDS * 0.35) b.element.classList.add('is-leaving');
      if (b.remaining <= 0) {
        b.element.remove();
        this.banners.splice(i, 1);
      }
    }
    if (this.introRemaining > 0) {
      this.introRemaining -= frameDt;
      if (this.introRemaining <= 0.6) this.intro.classList.add('is-leaving');
      if (this.introRemaining <= 0) this.intro.hidden = true;
    }
    if (this.tutorialRemaining > 0) {
      this.tutorialRemaining -= frameDt;
      if (this.tutorialRemaining <= 1) this.tutorial.classList.add('is-leaving');
      if (this.tutorialRemaining <= 0) this.tutorial.hidden = true;
    }
  }

  render(m: HudModel, frameDt = 1 / 60): void {
    this.update(frameDt);

    // 体力: 本体は即時、遅延バーはゆっくり追う（減った分が残像として見える）
    this.hpFill.style.width = `${(m.hpRatio * 100).toFixed(1)}%`;
    if (m.hpRatio > this.ghostRatio) this.ghostRatio = m.hpRatio;
    else this.ghostRatio = Math.max(m.hpRatio, this.ghostRatio - GHOST_SPEED * frameDt);
    this.hpGhost.style.width = `${(this.ghostRatio * 100).toFixed(1)}%`;
    const low = m.hpRatio <= LOW_HP && m.hpRatio > 0;
    this.root.classList.toggle('is-low-hp', low);
    this.vignette.style.opacity = low ? String(0.35 + (1 - m.hpRatio / LOW_HP) * 0.45) : '0';

    this.staminaFill.style.width = `${(m.staminaRatio * 100).toFixed(1)}%`;
    const empty = m.staminaRatio <= 0.02;
    this.root.classList.toggle('is-stamina-empty', empty);
    if (empty && this.lastStamina > 0.02) this.onStaminaEmpty?.();
    this.lastStamina = m.staminaRatio;

    setText(this.weapon, `${m.weaponName}　${m.sharpnessLabel}`);
    if (m.weaponKind !== this.lastWeaponKind) {
      this.lastWeaponKind = m.weaponKind;
      this.weaponIcon.setAttribute('href', `${ICONS}#pe-icon-${m.weaponKind}`);
    }
    this.renderKnees(m.downs, m.maxDowns);

    setText(this.timer, formatTime(m.timeRemaining));
    this.timer.classList.toggle('is-warning', m.timeWarning);
    setText(this.objective, m.objective);
    this.rain.classList.toggle('is-on', m.raining);
    this.renderCompass(m);

    this.beast.hidden = !m.monsterVisible;
    if (m.monsterVisible) {
      setText(this.beastName, m.monsterName);
      this.beast.classList.toggle('is-locked', m.lockOn);
      this.beastFill.style.width = `${(m.monsterHpRatio * 100).toFixed(1)}%`;
      const badgeKey = m.monsterBadges.join('|');
      if (badgeKey !== this.lastBadges) {
        this.lastBadges = badgeKey;
        this.badges.replaceChildren(...m.monsterBadges.map((b) => el('span', 'pe-hud__badge', b)));
      }
    }

    this.respawn.hidden = m.respawnCountdown <= 0;
    if (m.respawnCountdown > 0) setText(this.respawn, `膝をついた。${Math.ceil(m.respawnCountdown)} 秒ののち、前哨で目を覚ます`);

    this.prompt.hidden = m.prompt === '' || m.respawnCountdown > 0;
    if (m.prompt !== '') {
      setText(this.promptText, m.prompt);
      this.promptFill.style.width = `${(m.promptProgress * 100).toFixed(1)}%`;
    }

    const noticeKey = m.notices.join('|');
    if (noticeKey !== this.lastNotices) {
      this.lastNotices = noticeKey;
      this.notices.replaceChildren(...m.notices.map((n) => el('div', 'pe-hud__notice', n)));
    }

    this.item.hidden = m.itemName === '';
    setText(this.itemCount, `×${m.itemCount}`);
    setText(this.itemName, m.itemName);
    setText(this.itemKey, m.itemKey);
    this.item.classList.toggle('is-empty', m.itemCount <= 0);
  }

  private renderKnees(downs: number, maxDowns: number): void {
    const key = `${downs}/${maxDowns}`;
    if (this.knees.dataset['key'] === key) return;
    this.knees.dataset['key'] = key;
    this.knees.replaceChildren();
    if (maxDowns <= 0) return;
    const label = el('span', 'pe-hud__knees-label', '膝');
    this.knees.appendChild(label);
    for (let i = 0; i < maxDowns; i++) this.knees.appendChild(el('i', `pe-hud__knee${i < maxDowns - downs ? ' is-left' : ''}`));
  }

  private buildCompassTrack(): void {
    // 北 = +Z。目盛りは 15° ごと、方位文字は 90° ごと
    const marks: HTMLElement[] = [];
    for (let deg = 0; deg < 360; deg += 15) {
      const cardinal = ['N', 'E', 'S', 'W'][deg / 90];
      const mark = el('i', `pe-hud__tick${deg % 90 === 0 ? ' is-cardinal' : deg % 45 === 0 ? ' is-mid' : ''}`, cardinal && deg % 90 === 0 ? cardinal : '');
      mark.dataset['deg'] = String(deg);
      marks.push(mark);
    }
    this.compassTrack.replaceChildren(...marks);
  }

  private renderCompass(m: HudModel): void {
    const width = this.compassTrack.parentElement?.clientWidth ?? 220;
    const half = width / 2;
    const place = (element: HTMLElement, bearing: number): void => {
      const rel = wrapAngle(bearing - m.headingRad);
      const visible = Math.abs(rel) <= COMPASS_HALF_RAD;
      element.hidden = !visible;
      if (visible) element.style.transform = `translateX(${(half + (rel / COMPASS_HALF_RAD) * half).toFixed(1)}px)`;
    };
    for (const tick of this.compassTrack.children) place(tick as HTMLElement, (Number((tick as HTMLElement).dataset['deg']) * Math.PI) / 180);
    place(this.compassOutpost, m.outpostBearingRad);
    if (m.beastBearingRad === null) this.compassBeast.hidden = true;
    else place(this.compassBeast, m.beastBearingRad);
  }
}

function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function q<T extends Element = HTMLElement>(root: HTMLElement, selector: string): T {
  const e = root.querySelector<T>(selector);
  if (!e) throw new Error(`HUD element not found: ${selector}`);
  return e;
}

function setText(e: Element, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
