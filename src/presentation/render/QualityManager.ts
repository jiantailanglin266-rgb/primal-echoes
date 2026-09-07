import { QUALITY_PRESETS, type RenderQuality } from './Renderer';

export const QUALITY_ORDER: readonly RenderQuality[] = ['low', 'mid', 'high'];

/** 端末の特徴。判定ロジックはこの値だけを見るのでテストできる。 */
export interface DeviceProfile {
  /** WEBGL_debug_renderer_info の文字列。取れなければ空。 */
  gpu: string;
  mobile: boolean;
  devicePixelRatio: number;
  /** 画面の物理ピクセル数（幅×高さ×DPR²）。 */
  screenPixels: number;
  cores: number;
}

const HIGH_END_GPU = /rtx|gtx ?1[6-9]\d0|gtx ?[23]0\d0|radeon rx ?[5-7]\d{3}|radeon rx ?[6-9]\d{2}|arc a\d|apple m[1-9]/i;
const LOW_END_GPU = /mali|adreno|powervr|videocore|swiftshader|llvmpipe|software/i;
const INTEGRATED_GPU = /intel|iris|uhd graphics|hd graphics|vega ?[3-8]\b|radeon(?: \(tm\))? graphics/i; // 「AMD Radeon (TM) Graphics」は Ryzen 内蔵 GPU

/** 端末情報から初期品質を決める。迷ったら mid（実測 FPS で下げる前提）。 */
export function recommendQuality(p: DeviceProfile): RenderQuality {
  if (p.mobile || LOW_END_GPU.test(p.gpu)) return 'low';
  if (HIGH_END_GPU.test(p.gpu)) return p.screenPixels > 3840 * 2160 ? 'mid' : 'high';
  if (INTEGRATED_GPU.test(p.gpu)) return p.screenPixels > 1920 * 1080 * 1.5 ? 'low' : 'mid';
  // 不明な GPU: 高解像度なら控えめに
  if (p.screenPixels > 2560 * 1440) return 'mid';
  return p.cores >= 8 ? 'high' : 'mid';
}

export function detectDeviceProfile(gl: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceProfile {
  let gpu = '';
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    else gpu = String(gl.getParameter(gl.RENDERER) ?? '');
  }
  const ua = navigator.userAgent;
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua) === false && /windows/i.test(ua) === false);
  const dpr = window.devicePixelRatio || 1;
  return {
    gpu,
    mobile,
    devicePixelRatio: dpr,
    screenPixels: window.screen.width * window.screen.height * dpr * dpr,
    cores: navigator.hardwareConcurrency || 4,
  };
}

/**
 * 実測 FPS の監視。直近 windowSeconds の平均が閾値を下回ったら 1 段階下げる提案を返す。
 * 上げる方向には動かない（上げ下げを繰り返して見た目が揺れるのを避ける）。
 */
export class FpsGovernor {
  private frames = 0;
  private elapsed = 0;
  private cooldown = 0;
  private lastAverage = 0;

  constructor(
    private readonly windowSeconds = 3,
    private readonly thresholdFps = 55,
    private readonly cooldownSeconds = 10,
  ) {}

  /** 直近ウィンドウの平均 FPS（未確定なら 0）。 */
  get averageFps(): number {
    return this.lastAverage;
  }

  /** 実時間の frameDt を与える。'downgrade' を返したら 1 段階落とす。 */
  sample(frameDt: number): 'downgrade' | null {
    // タブ切替などの巨大な dt は捨てて計測をやり直す
    if (frameDt <= 0 || frameDt > 0.25) {
      this.frames = 0;
      this.elapsed = 0;
      return null;
    }
    if (this.cooldown > 0) this.cooldown -= frameDt;
    this.frames++;
    this.elapsed += frameDt;
    if (this.elapsed < this.windowSeconds) return null;
    this.lastAverage = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    if (this.cooldown > 0 || this.lastAverage >= this.thresholdFps) return null;
    this.cooldown = this.cooldownSeconds;
    return 'downgrade';
  }
}

export function lowerQuality(q: RenderQuality): RenderQuality | null {
  const i = QUALITY_ORDER.indexOf(q);
  return i > 0 ? (QUALITY_ORDER[i - 1] as RenderQuality) : null;
}

export interface QualityTargets {
  setPixelRatio(ratio: number): void;
  setShadowMapSize(size: number): void;
  applyPostFxPreset(q: RenderQuality): void;
  setGrassDensity(ratio: number, viewDistance: number): void;
}

const STORAGE_KEY = 'pe.quality';

export interface QualityDetection {
  profile: DeviceProfile;
  quality: RenderQuality;
  /** URL で固定されている（自動調整しない）。 */
  locked: boolean;
}

/** URL `?quality=low|mid|high`（固定・自動調整なし）> localStorage > 端末判定。 */
export function resolveInitialQuality(profile: DeviceProfile, search: string, stored: string | null): { quality: RenderQuality; locked: boolean } {
  const param = new URLSearchParams(search).get('quality');
  if (param && (QUALITY_ORDER as readonly string[]).includes(param)) return { quality: param as RenderQuality, locked: true };
  if (stored && (QUALITY_ORDER as readonly string[]).includes(stored)) return { quality: stored as RenderQuality, locked: false };
  return { quality: recommendQuality(profile), locked: false };
}

/**
 * 品質段階を各サブシステムへ配る。段階の決定（端末判定・FPS 監視）と適用を一箇所にまとめ、
 * デバッグ UI からも同じ経路で切り替える。
 */
export class QualityManager {
  current: RenderQuality;
  readonly locked: boolean;
  readonly profile: DeviceProfile;
  private readonly governor = new FpsGovernor();
  private readonly listeners: ((q: RenderQuality, reason: 'manual' | 'auto') => void)[] = [];

  constructor(
    private readonly targets: QualityTargets,
    detection: QualityDetection,
  ) {
    this.profile = detection.profile;
    this.current = detection.quality;
    this.locked = detection.locked;
  }

  /** レンダラ生成前に呼ぶ（初期品質でレンダラ・CSM を作るため）。使い捨ての WebGL コンテキストで GPU 名を読む。 */
  static detect(): QualityDetection {
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      const probe = document.createElement('canvas');
      gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    } catch {
      gl = null;
    }
    const profile = detectDeviceProfile(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    const initial = resolveInitialQuality(profile, window.location.search, safeStorageGet(STORAGE_KEY));
    return { profile, ...initial };
  }

  get averageFps(): number {
    return this.governor.averageFps;
  }

  onChange(listener: (q: RenderQuality, reason: 'manual' | 'auto') => void): void {
    this.listeners.push(listener);
  }

  apply(q: RenderQuality, reason: 'manual' | 'auto' = 'manual'): void {
    this.current = q;
    const preset = QUALITY_PRESETS[q];
    this.targets.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio));
    this.targets.setShadowMapSize(preset.shadowMapSize);
    this.targets.applyPostFxPreset(q);
    this.targets.setGrassDensity(preset.grassDensity, preset.grassViewDistance);
    if (reason === 'manual') safeStorageSet(STORAGE_KEY, q);
    for (const l of this.listeners) l(q, reason);
  }

  /** 毎フレーム呼ぶ。固定指定（URL）のときは何もしない。 */
  update(frameDt: number): void {
    if (this.locked) return;
    if (this.governor.sample(frameDt) !== 'downgrade') return;
    const lower = lowerQuality(this.current);
    if (lower) this.apply(lower, 'auto');
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* プライベートモード等では保存しない */
  }
}
