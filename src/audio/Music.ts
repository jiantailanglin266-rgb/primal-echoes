import type { AudioEngine } from './AudioEngine';
import { fadeTo, startBufferLoop, startDrone, startNoiseLoop, type LoopHandle } from './synth';

export type MusicState = 'none' | 'title' | 'explore' | 'combat' | 'resolve';
export type MusicLayer = 'bed' | 'pulse' | 'strings' | 'drums';

/**
 * 曲を切り替えず、レイヤーの音量で場面を渡る。
 *   bed     … 環境音主体のドローン（常に薄く）
 *   pulse   … 低音の脈（探索でわずかに、戦闘で前へ）
 *   strings … 低音弦の持続（戦闘で重なる）
 *   drums   … 打楽器（戦闘のみ。層は徐々に）
 * 純関数なのでテストできる。
 */
export function layerTargets(state: MusicState, combatHeat = 1): Record<MusicLayer, number> {
  const heat = Math.min(1, Math.max(0, combatHeat));
  switch (state) {
    case 'title':
      return { bed: 0.9, pulse: 0.15, strings: 0.25, drums: 0 };
    case 'explore':
      return { bed: 0.7, pulse: 0.2, strings: 0, drums: 0 };
    case 'combat':
      return { bed: 0.45, pulse: 0.6, strings: 0.4 + 0.3 * heat, drums: 0.35 + 0.45 * heat };
    case 'resolve':
      return { bed: 0.8, pulse: 0, strings: 0.5, drums: 0 };
    default:
      return { bed: 0, pulse: 0, strings: 0, drums: 0 };
  }
}

/** 場面ごとのフェード秒（切替は急がない。討伐だけは早く静める）。 */
export function fadeSeconds(from: MusicState, to: MusicState): number {
  if (to === 'none') return 1.2;
  if (to === 'resolve') return 0.6;
  if (from === 'combat' && to === 'explore') return 5;
  if (to === 'combat') return 2.5;
  return 3;
}

const SAMPLE_FILES: Record<MusicLayer, string> = { bed: 'bgm/bed.ogg', pulse: 'bgm/pulse.ogg', strings: 'bgm/strings.ogg', drums: 'bgm/drums.ogg' };
/** 合成の打楽器パターン（拍位置と強さ）。4 拍 × 2 小節、BPM 72。 */
const DRUM_PATTERN: readonly { beat: number; gain: number; low: boolean }[] = [
  { beat: 0, gain: 1, low: true },
  { beat: 1.5, gain: 0.5, low: false },
  { beat: 2, gain: 0.8, low: true },
  { beat: 3, gain: 0.35, low: false },
  { beat: 4, gain: 1, low: true },
  { beat: 5.5, gain: 0.5, low: false },
  { beat: 6, gain: 0.7, low: true },
  { beat: 6.75, gain: 0.4, low: false },
  { beat: 7.5, gain: 0.6, low: true },
];
const BPM = 72;

/**
 * BGM プレイヤー。素材（assets/audio/bgm/*.ogg）があればループ再生、無ければ合成のドローンと打楽器。
 * update() を毎フレーム呼ぶと、合成の打楽器を先読みで予約する。
 */
export class Music {
  private state: MusicState = 'none';
  private heat = 0;
  private readonly handles = new Map<MusicLayer, LoopHandle>();
  private drumsGain: GainNode | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private started = false;

  constructor(private readonly engine: AudioEngine) {}

  get current(): MusicState {
    return this.state;
  }

  /** 素材の有無を調べて、層を起動する（unlock 後、初回の場面設定で呼ばれる）。 */
  private async start(): Promise<void> {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('music');
    if (!ctx || !bus || this.started) return;
    this.started = true;
    const noise = this.engine.noise();
    for (const layer of ['bed', 'pulse', 'strings'] as const) {
      const sample = await this.engine.sample(SAMPLE_FILES[layer]);
      if (sample) {
        this.handles.set(layer, startBufferLoop(ctx, bus, sample));
        continue;
      }
      if (layer === 'bed') {
        // 風のようなノイズと、低いドローン
        const wind = startNoiseLoop(ctx, bus, noise, { filter: 'lowpass', frequency: 220, q: 0.5, gain: 0, lfoHz: 0.07, lfoDepth: 0.6 });
        const drone = startDrone(ctx, bus, 55, 4);
        const group = ctx.createGain();
        group.gain.value = 0;
        wind.gain.gain.value = 0.35;
        drone.gain.gain.value = 0.18;
        wind.gain.disconnect();
        drone.gain.disconnect();
        wind.gain.connect(group);
        drone.gain.connect(group);
        group.connect(bus);
        this.handles.set('bed', { gain: group, stop: () => { wind.stop(); drone.stop(); } });
      } else if (layer === 'pulse') {
        const pulse = startDrone(ctx, bus, 41.2, 2, 'triangle');
        // 脈: 0.9 秒周期で膨らむ
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1 / 0.9;
        const depth = ctx.createGain();
        depth.gain.value = 0.5;
        const carrier = ctx.createGain();
        carrier.gain.value = 0.5;
        lfo.connect(depth);
        depth.connect(carrier.gain);
        pulse.gain.disconnect();
        pulse.gain.gain.value = 0.22;
        pulse.gain.connect(carrier);
        const group = ctx.createGain();
        group.gain.value = 0;
        carrier.connect(group);
        group.connect(bus);
        lfo.start();
        this.handles.set('pulse', { gain: group, stop: () => { pulse.stop(); lfo.stop(); } });
      } else {
        // 低音弦: 鋸波を強くローパスした持続音、2 声
        const a = startDrone(ctx, bus, 82.4, 6, 'sawtooth');
        const b = startDrone(ctx, bus, 123.5, 5, 'sawtooth');
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        filter.Q.value = 0.7;
        const group = ctx.createGain();
        group.gain.value = 0;
        a.gain.disconnect();
        b.gain.disconnect();
        a.gain.gain.value = 0.12;
        b.gain.gain.value = 0.07;
        a.gain.connect(filter);
        b.gain.connect(filter);
        filter.connect(group);
        group.connect(bus);
        this.handles.set('strings', { gain: group, stop: () => { a.stop(); b.stop(); } });
      }
    }
    const drumSample = await this.engine.sample(SAMPLE_FILES.drums);
    if (drumSample) this.handles.set('drums', startBufferLoop(ctx, bus, drumSample));
    else {
      this.drumsGain = ctx.createGain();
      this.drumsGain.gain.value = 0;
      this.drumsGain.connect(bus);
      this.handles.set('drums', { gain: this.drumsGain, stop: () => {} });
      this.nextBeatTime = ctx.currentTime + 0.1;
    }
    this.applyTargets(0.5);
  }

  /** 場面を変える。heat は戦闘の激しさ（0〜1、怒りで 1）。 */
  setState(state: MusicState, heat = this.heat): void {
    const changed = state !== this.state;
    const seconds = fadeSeconds(this.state, state);
    this.state = state;
    this.heat = heat;
    if (!this.started && state !== 'none' && this.engine.isRunning) {
      void this.start();
      return;
    }
    if (changed || heat !== this.heat) this.applyTargets(seconds);
  }

  setHeat(heat: number): void {
    if (Math.abs(heat - this.heat) < 0.05) return;
    this.heat = heat;
    this.applyTargets(2);
  }

  private applyTargets(seconds: number): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const targets = layerTargets(this.state, this.heat);
    for (const [layer, handle] of this.handles) fadeTo(handle.gain, ctx, targets[layer], seconds);
  }

  /** 合成の打楽器を 0.3 秒先まで予約する。素材があるときは何もしない。 */
  update(): void {
    const ctx = this.engine.ctx;
    const gain = this.drumsGain;
    if (!ctx || !gain || !this.started) return;
    const beatSeconds = 60 / BPM;
    const patternLength = 8 * beatSeconds;
    while (this.nextBeatTime < ctx.currentTime + 0.3) {
      const cycleStart = this.nextBeatTime;
      for (const hit of DRUM_PATTERN) this.scheduleDrum(ctx, gain, cycleStart + hit.beat * beatSeconds, hit.gain, hit.low);
      this.nextBeatTime = cycleStart + patternLength;
      this.beatIndex++;
    }
  }

  private scheduleDrum(ctx: AudioContext, dest: GainNode, at: number, gain: number, low: boolean): void {
    // 皮を張った太鼓: 低い正弦波の急な落ちと、短いノイズ
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5 * gain, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + (low ? 0.32 : 0.14));
    g.connect(dest);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 96 : 150, at);
    osc.frequency.exponentialRampToValueAtTime(low ? 40 : 90, at + 0.12);
    osc.connect(g);
    osc.start(at);
    osc.stop(at + 0.4);
    const n = ctx.createBufferSource();
    n.buffer = this.engine.noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = low ? 500 : 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * gain, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    n.connect(f);
    f.connect(ng);
    ng.connect(dest);
    n.start(at);
    n.stop(at + 0.08);
  }
}
