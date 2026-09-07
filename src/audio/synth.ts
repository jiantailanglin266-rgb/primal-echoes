/**
 * 合成音の部品。方向性は docs/brand/SOUND_DIRECTION.md：
 * 金属ではなく「石・骨・革」。矩形波は使わない。ノイズをフィルタで削り、低い正弦波で重みを足す。
 */
export interface NoiseLayer {
  kind: 'noise';
  filter: BiquadFilterType;
  /** フィルタの中心周波数（from → to へスイープ）。 */
  from: number;
  to: number;
  q?: number;
  seconds: number;
  gain: number;
  /** 立ち上がり（秒）。0 で打撃、長くすると風。 */
  attack?: number;
}

export interface ToneLayer {
  kind: 'tone';
  type: OscillatorType;
  from: number;
  to: number;
  seconds: number;
  gain: number;
  attack?: number;
  /** 開始のずれ（秒）。順番に鳴らすとき。 */
  delay?: number;
}

export type SynthLayer = NoiseLayer | ToneLayer;

export function playLayer(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer, layer: SynthLayer, startAt: number, pitch = 1): number {
  const attack = layer.attack ?? 0.004;
  const delay = layer.kind === 'tone' ? (layer.delay ?? 0) : 0;
  const t0 = startAt + delay;
  const end = t0 + layer.seconds;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.gain), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(destination);

  if (layer.kind === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = layer.filter;
    filter.Q.value = layer.q ?? 1;
    filter.frequency.setValueAtTime(layer.from * pitch, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, layer.to * pitch), end);
    src.connect(filter);
    filter.connect(gain);
    src.start(t0);
    src.stop(end + 0.02);
  } else {
    const osc = ctx.createOscillator();
    osc.type = layer.type;
    osc.frequency.setValueAtTime(layer.from * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * pitch), end);
    osc.connect(gain);
    osc.start(t0);
    osc.stop(end + 0.02);
  }
  return end;
}

/** 素材のサンプルを 1 回鳴らす。 */
export function playBuffer(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer, startAt: number, gain = 1, pitch = 1): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = pitch;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(destination);
  src.start(startAt);
}

/** ループするノイズ層（風・水・雨）。戻り値の gain で音量を動かす。 */
export interface LoopHandle {
  gain: GainNode;
  stop: () => void;
}

export function startNoiseLoop(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer, options: { filter: BiquadFilterType; frequency: number; q?: number; gain: number; lfoHz?: number; lfoDepth?: number }): LoopHandle {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q ?? 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start();
  let lfo: OscillatorNode | null = null;
  if (options.lfoHz && options.lfoDepth) {
    // ゆっくりした揺らぎ（風のうねり）
    lfo = ctx.createOscillator();
    lfo.frequency.value = options.lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = options.frequency * options.lfoDepth;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    lfo.start();
  }
  return {
    gain,
    stop: () => {
      src.stop();
      lfo?.stop();
    },
  };
}

/** ループするドローン（2 つの正弦波をわずかにずらす）。 */
export function startDrone(ctx: AudioContext, destination: AudioNode, frequency: number, detune = 3, type: OscillatorType = 'sine'): LoopHandle {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(destination);
  const oscs = [0, detune].map((d) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = d;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    osc.connect(g);
    g.connect(gain);
    osc.start();
    return osc;
  });
  return { gain, stop: () => oscs.forEach((o) => o.stop()) };
}

/** 素材のループ再生。 */
export function startBufferLoop(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer): LoopHandle {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain);
  gain.connect(destination);
  src.start();
  return { gain, stop: () => src.stop() };
}

/** 音量を目標へ滑らかに寄せる。 */
export function fadeTo(gain: GainNode, ctx: AudioContext, target: number, seconds: number): void {
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(Math.max(0, target), ctx.currentTime, Math.max(0.01, seconds / 3));
}
