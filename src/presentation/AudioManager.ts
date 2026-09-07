/**
 * 仮 SE。外部アセットを使わず WebAudio のオシレータ/ノイズで合成する。
 * 本番の音源が来たら play() の中身をサンプル再生に差し替える（ID は維持）。
 * AudioContext はユーザー操作後にしか鳴らせないため、初回の操作で resume する。
 */
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
  | 'questClear'
  | 'questFail'
  | 'telegraph';

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  seconds: number;
  gain: number;
  noise?: boolean;
}

const TONES: Record<SoundId, Tone[]> = {
  hitLight: [{ type: 'square', from: 220, to: 90, seconds: 0.08, gain: 0.5, noise: true }],
  hitHeavy: [
    { type: 'sawtooth', from: 120, to: 40, seconds: 0.18, gain: 0.7, noise: true },
    { type: 'sine', from: 60, to: 30, seconds: 0.25, gain: 0.5 },
  ],
  playerHurt: [{ type: 'sawtooth', from: 400, to: 120, seconds: 0.22, gain: 0.5 }],
  partBreak: [
    { type: 'square', from: 800, to: 200, seconds: 0.12, gain: 0.5, noise: true },
    { type: 'triangle', from: 300, to: 600, seconds: 0.3, gain: 0.4 },
  ],
  roar: [
    { type: 'sawtooth', from: 70, to: 110, seconds: 0.9, gain: 0.6, noise: true },
    { type: 'square', from: 45, to: 55, seconds: 1.1, gain: 0.3 },
  ],
  carve: [{ type: 'triangle', from: 500, to: 250, seconds: 0.15, gain: 0.3, noise: true }],
  itemGet: [
    { type: 'sine', from: 660, to: 660, seconds: 0.08, gain: 0.3 },
    { type: 'sine', from: 990, to: 990, seconds: 0.14, gain: 0.3 },
  ],
  uiClick: [{ type: 'sine', from: 900, to: 700, seconds: 0.05, gain: 0.2 }],
  uiHover: [{ type: 'sine', from: 1400, to: 1200, seconds: 0.025, gain: 0.05 }],
  questClear: [
    { type: 'triangle', from: 523, to: 523, seconds: 0.15, gain: 0.3 },
    { type: 'triangle', from: 659, to: 659, seconds: 0.15, gain: 0.3 },
    { type: 'triangle', from: 784, to: 1046, seconds: 0.5, gain: 0.35 },
  ],
  questFail: [{ type: 'sawtooth', from: 300, to: 80, seconds: 0.8, gain: 0.35 }],
  telegraph: [{ type: 'square', from: 180, to: 220, seconds: 0.1, gain: 0.15 }],
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.6;
  private readonly lastPlayed = new Map<SoundId, number>();

  get masterVolume(): number {
    return this.volume;
  }

  setMasterVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  /** ユーザー操作のハンドラから呼ぶ。以降 play() が鳴る。 */
  unlock(): void {
    if (!this.context) {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  play(id: SoundId): void {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || ctx.state !== 'running') return;
    // 同じ音の連打は 30ms 以内なら間引く（多段ヒットで音が割れるのを防ぐ）
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlayed.set(id, now);

    let offset = 0;
    for (const tone of TONES[id]) {
      this.playTone(ctx, master, tone, now + offset);
      // クエスト成否のように順番に鳴らす音は連結、それ以外は同時
      if (id === 'questClear' || id === 'itemGet') offset += tone.seconds * 0.9;
    }
  }

  private playTone(ctx: AudioContext, master: GainNode, tone: Tone, startAt: number): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.gain, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + tone.seconds);
    gain.connect(master);

    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to), startAt + tone.seconds);
    osc.connect(gain);
    osc.start(startAt);
    osc.stop(startAt + tone.seconds + 0.02);

    if (tone.noise) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(tone.gain * 0.6, startAt);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startAt + tone.seconds * 0.7);
      noise.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(startAt);
      noise.stop(startAt + tone.seconds);
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }
}
