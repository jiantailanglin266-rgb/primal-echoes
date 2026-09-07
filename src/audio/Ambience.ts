import type { AudioEngine } from './AudioEngine';
import { fadeTo, startBufferLoop, startNoiseLoop, type LoopHandle } from './synth';

export type AmbienceLayer = 'wind' | 'insects' | 'water' | 'rain' | 'cave';

/**
 * エリアと天候から環境音の層の音量を決める（純関数）。
 * 苔の谷底 = 風＋虫、白瀬 = 水、獣の寝床 = 洞の反響、前哨 = 風少なめ。雨は虫を黙らせ、雨音を足す。
 */
export function ambienceTargets(areaId: string | null, raining: boolean, indoors = false): Record<AmbienceLayer, number> {
  const base: Record<AmbienceLayer, number> = { wind: 0.5, insects: 0.25, water: 0, rain: 0, cave: 0 };
  switch (areaId) {
    case 'forest':
      base.wind = 0.45;
      base.insects = 0.5;
      break;
    case 'river':
      base.wind = 0.3;
      base.insects = 0.15;
      base.water = 0.7;
      break;
    case 'cave':
      base.wind = 0.12;
      base.insects = 0;
      base.cave = 0.6;
      break;
    case 'base_camp':
      base.wind = 0.35;
      base.insects = 0.2;
      break;
    default:
      break;
  }
  if (raining) {
    base.insects = 0;
    base.rain = indoors || areaId === 'cave' ? 0.25 : 0.8;
    base.wind *= 1.3;
  }
  return base;
}

const SAMPLE_FILES: Record<AmbienceLayer, string> = { wind: 'amb/wind.ogg', insects: 'amb/insects.ogg', water: 'amb/water.ogg', rain: 'amb/rain.ogg', cave: 'amb/cave.ogg' };

/** 環境音。素材があればループ、無ければフィルタしたノイズ。虫は短い高音を乱数で鳴らす。 */
export class Ambience {
  private readonly handles = new Map<AmbienceLayer, LoopHandle>();
  private started = false;
  private targets: Record<AmbienceLayer, number> = ambienceTargets(null, false);
  private insectTimer = 0;
  private insectsGain: GainNode | null = null;

  constructor(private readonly engine: AudioEngine) {}

  private async start(): Promise<void> {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('ambience');
    if (!ctx || !bus || this.started) return;
    this.started = true;
    const noise = this.engine.noise();
    for (const layer of ['wind', 'water', 'rain', 'cave'] as const) {
      const sample = await this.engine.sample(SAMPLE_FILES[layer]);
      if (sample) {
        this.handles.set(layer, startBufferLoop(ctx, bus, sample));
        continue;
      }
      const options = {
        wind: { filter: 'lowpass' as BiquadFilterType, frequency: 260, q: 0.4, gain: 0, lfoHz: 0.09, lfoDepth: 0.7 },
        water: { filter: 'bandpass' as BiquadFilterType, frequency: 1400, q: 0.5, gain: 0, lfoHz: 0.4, lfoDepth: 0.15 },
        rain: { filter: 'highpass' as BiquadFilterType, frequency: 2400, q: 0.3, gain: 0, lfoHz: 0.25, lfoDepth: 0.2 },
        cave: { filter: 'bandpass' as BiquadFilterType, frequency: 140, q: 3, gain: 0, lfoHz: 0.05, lfoDepth: 0.3 },
      }[layer];
      this.handles.set(layer, startNoiseLoop(ctx, bus, noise, options));
    }
    const insects = await this.engine.sample(SAMPLE_FILES.insects);
    if (insects) this.handles.set('insects', startBufferLoop(ctx, bus, insects));
    else {
      this.insectsGain = ctx.createGain();
      this.insectsGain.gain.value = 0;
      this.insectsGain.connect(bus);
      this.handles.set('insects', { gain: this.insectsGain, stop: () => {} });
    }
    this.apply(1);
  }

  set(areaId: string | null, raining: boolean): void {
    this.targets = ambienceTargets(areaId, raining);
    if (!this.started) {
      if (this.engine.isRunning) void this.start();
      return;
    }
    this.apply(2.5);
  }

  /** すべて静かに（拠点画面やタイトル）。 */
  silence(seconds = 1.5): void {
    this.targets = { wind: 0, insects: 0, water: 0, rain: 0, cave: 0 };
    if (this.started) this.apply(seconds);
  }

  private apply(seconds: number): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    const scale: Record<AmbienceLayer, number> = { wind: 0.5, insects: 1, water: 0.35, rain: 0.3, cave: 0.5 };
    for (const [layer, handle] of this.handles) fadeTo(handle.gain, ctx, this.targets[layer] * scale[layer], seconds);
  }

  /** 合成の虫の声（実時間 dt）。 */
  update(dt: number): void {
    const ctx = this.engine.ctx;
    const gain = this.insectsGain;
    if (!ctx || !gain || gain.gain.value < 0.02) return;
    this.insectTimer -= dt;
    if (this.insectTimer > 0) return;
    this.insectTimer = 0.12 + Math.random() * 0.5;
    const at = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 3800 + Math.random() * 2200;
    osc.frequency.setValueAtTime(f, at);
    osc.frequency.exponentialRampToValueAtTime(f * 1.05, at + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    osc.connect(g);
    g.connect(gain);
    osc.start(at);
    osc.stop(at + 0.1);
  }
}
