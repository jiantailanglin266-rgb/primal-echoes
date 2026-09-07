import type { AudioEngine } from './AudioEngine';
import { playBuffer, playLayer, type SynthLayer } from './synth';

export type SoundId =
  | 'hitLight'
  | 'hitHeavy'
  | 'playerHurt'
  | 'partBreak'
  | 'roar'
  | 'carve'
  | 'itemGet'
  | 'uiClick'
  | 'uiHover'
  | 'staminaOut'
  | 'questClear'
  | 'questFail'
  | 'telegraph'
  | 'footstep'
  | 'dodge'
  | 'drink'
  | 'logo';

interface SfxDef {
  /** 素材があれば `assets/audio/sfx/<sample>.ogg` を使う。 */
  sample: string;
  layers: SynthLayer[];
  /** ピッチの揺らぎ幅（±）。同じ音の連続感を消す。 */
  pitchVar: number;
  /** 同じ音を間引く最短間隔（秒）。 */
  minInterval: number;
  gain?: number;
}

/**
 * 効果音の定義。質感の指針: ヒットは重く短く（低い正弦波の「どん」＋ローパスのノイズ）、
 * 石・骨・革（バンドパスの短いノイズ）、UI は乾いた小さな「こつ」。
 */
export const SFX: Record<SoundId, SfxDef> = {
  hitLight: {
    sample: 'hit_light',
    pitchVar: 0.06,
    minInterval: 0.03,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 1800, to: 500, q: 0.9, seconds: 0.07, gain: 0.35 },
      { kind: 'tone', type: 'sine', from: 160, to: 70, seconds: 0.09, gain: 0.3 },
    ],
  },
  hitHeavy: {
    sample: 'hit_heavy',
    pitchVar: 0.05,
    minInterval: 0.05,
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 900, to: 120, q: 0.7, seconds: 0.16, gain: 0.5 },
      { kind: 'tone', type: 'sine', from: 90, to: 32, seconds: 0.28, gain: 0.6 },
      { kind: 'noise', filter: 'bandpass', from: 2600, to: 900, q: 2, seconds: 0.05, gain: 0.18 },
    ],
  },
  playerHurt: {
    sample: 'player_hurt',
    pitchVar: 0.05,
    minInterval: 0.1,
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 700, to: 150, seconds: 0.18, gain: 0.4 },
      { kind: 'tone', type: 'triangle', from: 220, to: 110, seconds: 0.2, gain: 0.18 },
    ],
  },
  partBreak: {
    sample: 'part_break',
    pitchVar: 0.04,
    minInterval: 0.1,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 1400, to: 300, q: 1.2, seconds: 0.22, gain: 0.5 },
      { kind: 'tone', type: 'sine', from: 110, to: 40, seconds: 0.4, gain: 0.55 },
      { kind: 'noise', filter: 'highpass', from: 3000, to: 1500, seconds: 0.12, gain: 0.15, attack: 0.02 },
    ],
  },
  roar: {
    sample: 'roar',
    pitchVar: 0.03,
    minInterval: 0.5,
    layers: [
      { kind: 'tone', type: 'sawtooth', from: 62, to: 84, seconds: 1.1, gain: 0.32, attack: 0.08 },
      { kind: 'tone', type: 'triangle', from: 124, to: 150, seconds: 1.0, gain: 0.14, attack: 0.1 },
      { kind: 'noise', filter: 'lowpass', from: 500, to: 260, q: 0.5, seconds: 1.2, gain: 0.35, attack: 0.05 },
      { kind: 'noise', filter: 'bandpass', from: 900, to: 400, q: 1.4, seconds: 0.9, gain: 0.2, attack: 0.15 },
    ],
  },
  carve: {
    sample: 'carve',
    pitchVar: 0.08,
    minInterval: 0.08,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 1200, to: 400, q: 1.5, seconds: 0.14, gain: 0.3, attack: 0.02 },
      { kind: 'tone', type: 'sine', from: 140, to: 90, seconds: 0.1, gain: 0.12 },
    ],
  },
  itemGet: {
    sample: 'item_get',
    pitchVar: 0.02,
    minInterval: 0.1,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 2400, to: 2000, q: 8, seconds: 0.08, gain: 0.12 },
      { kind: 'tone', type: 'sine', from: 520, to: 520, seconds: 0.12, gain: 0.1 },
      { kind: 'tone', type: 'sine', from: 780, to: 780, seconds: 0.2, gain: 0.08, delay: 0.09 },
    ],
  },
  uiClick: {
    sample: 'ui_click',
    pitchVar: 0.03,
    minInterval: 0.03,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 2200, to: 1400, q: 6, seconds: 0.04, gain: 0.16 },
      { kind: 'tone', type: 'sine', from: 420, to: 380, seconds: 0.05, gain: 0.06 },
    ],
  },
  uiHover: {
    sample: 'ui_hover',
    pitchVar: 0.03,
    minInterval: 0.04,
    layers: [{ kind: 'noise', filter: 'bandpass', from: 3200, to: 2600, q: 8, seconds: 0.025, gain: 0.05 }],
  },
  staminaOut: {
    sample: 'stamina_out',
    pitchVar: 0.03,
    minInterval: 0.3,
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 600, to: 300, seconds: 0.18, gain: 0.14, attack: 0.03 },
      { kind: 'tone', type: 'triangle', from: 300, to: 220, seconds: 0.14, gain: 0.08 },
    ],
  },
  questClear: {
    sample: 'quest_clear',
    pitchVar: 0,
    minInterval: 1,
    layers: [
      { kind: 'tone', type: 'sine', from: 55, to: 55, seconds: 1.6, gain: 0.35, attack: 0.02 },
      { kind: 'noise', filter: 'lowpass', from: 400, to: 120, seconds: 0.5, gain: 0.25 },
      { kind: 'tone', type: 'sine', from: 220, to: 220, seconds: 1.2, gain: 0.12, attack: 0.3, delay: 0.3 },
      { kind: 'tone', type: 'sine', from: 330, to: 330, seconds: 1.4, gain: 0.1, attack: 0.4, delay: 0.6 },
    ],
  },
  questFail: {
    sample: 'quest_fail',
    pitchVar: 0,
    minInterval: 1,
    layers: [
      { kind: 'tone', type: 'sine', from: 70, to: 45, seconds: 1.4, gain: 0.3, attack: 0.05 },
      { kind: 'noise', filter: 'lowpass', from: 300, to: 100, seconds: 1.2, gain: 0.2, attack: 0.2 },
    ],
  },
  telegraph: {
    sample: 'telegraph',
    pitchVar: 0.05,
    minInterval: 0.1,
    layers: [
      { kind: 'noise', filter: 'lowpass', from: 320, to: 200, seconds: 0.14, gain: 0.16, attack: 0.02 },
      { kind: 'tone', type: 'sine', from: 80, to: 60, seconds: 0.12, gain: 0.12 },
    ],
  },
  footstep: {
    sample: 'footstep',
    pitchVar: 0.12,
    minInterval: 0.12,
    layers: [{ kind: 'noise', filter: 'lowpass', from: 500, to: 180, q: 0.6, seconds: 0.07, gain: 0.08 }],
  },
  dodge: {
    sample: 'dodge',
    pitchVar: 0.06,
    minInterval: 0.1,
    layers: [{ kind: 'noise', filter: 'bandpass', from: 700, to: 300, q: 0.6, seconds: 0.2, gain: 0.14, attack: 0.03 }],
  },
  drink: {
    sample: 'drink',
    pitchVar: 0.04,
    minInterval: 0.3,
    layers: [
      { kind: 'noise', filter: 'bandpass', from: 900, to: 600, q: 2, seconds: 0.25, gain: 0.1, attack: 0.05 },
      { kind: 'tone', type: 'sine', from: 260, to: 300, seconds: 0.3, gain: 0.05, attack: 0.1 },
    ],
  },
  /** サウンドロゴ（2 秒）: 低い「どん」→ 残響の環のように上へ薄れる 3 音。 */
  logo: {
    sample: 'logo',
    pitchVar: 0,
    minInterval: 2,
    layers: [
      { kind: 'tone', type: 'sine', from: 48, to: 44, seconds: 2.0, gain: 0.4, attack: 0.03 },
      { kind: 'noise', filter: 'lowpass', from: 300, to: 90, seconds: 0.7, gain: 0.25 },
      { kind: 'tone', type: 'sine', from: 196, to: 196, seconds: 1.6, gain: 0.1, attack: 0.25, delay: 0.25 },
      { kind: 'tone', type: 'sine', from: 294, to: 294, seconds: 1.4, gain: 0.07, attack: 0.3, delay: 0.55 },
      { kind: 'tone', type: 'sine', from: 392, to: 392, seconds: 1.2, gain: 0.05, attack: 0.35, delay: 0.85 },
    ],
  },
};

/** ピッチの揺らぎ（±var）。純関数なのでテストできる。 */
export function randomPitch(variation: number, random = Math.random): number {
  return 1 + (random() * 2 - 1) * variation;
}

/** 効果音の再生。素材があればそれを、無ければ合成音。 */
export class Sfx {
  private readonly lastPlayed = new Map<SoundId, number>();
  private readonly samples = new Map<SoundId, AudioBuffer | null>();

  constructor(private readonly engine: AudioEngine) {}

  /** 素材の有無を先に調べておく（起動時）。 */
  async preload(): Promise<void> {
    await Promise.all(
      (Object.keys(SFX) as SoundId[]).map(async (id) => {
        const buffer = await this.engine.sample(`sfx/${SFX[id].sample}.ogg`);
        this.samples.set(id, buffer);
      }),
    );
  }

  play(id: SoundId): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('sfx');
    if (!ctx || !bus || !this.engine.isRunning) return;
    const def = SFX[id];
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (now - last < def.minInterval) return;
    this.lastPlayed.set(id, now);
    const pitch = randomPitch(def.pitchVar);
    const sample = this.samples.get(id);
    if (sample) {
      playBuffer(ctx, bus, sample, now, def.gain ?? 1, pitch);
      return;
    }
    const noise = this.engine.noise();
    for (const layer of def.layers) playLayer(ctx, bus, noise, layer, now, pitch);
  }
}
