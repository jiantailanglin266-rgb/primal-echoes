import { assetUrl } from '@presentation/render/assetUrl';

export type BusName = 'music' | 'sfx' | 'ambience';

/**
 * AudioContext とバス（music / sfx / ambience → master）。
 * ブラウザはユーザー操作後にしか音を出せないので、最初のクリック／キーで unlock() する。
 * 素材ファイル（assets/audio/**）は有れば読み、無ければ null を返して合成音に任せる。
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<BusName, GainNode>();
  private readonly volumes: Record<'master' | BusName, number> = { master: 0.6, music: 0.8, sfx: 1, ambience: 0.7 };
  private noiseBuffer: AudioBuffer | null = null;
  private readonly samples = new Map<string, Promise<AudioBuffer | null>>();

  get ctx(): AudioContext | null {
    return this.context;
  }

  get isRunning(): boolean {
    return this.context?.state === 'running';
  }

  get now(): number {
    return this.context?.currentTime ?? 0;
  }

  unlock(): void {
    if (!this.context) {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.volumes.master;
      this.master.connect(this.context.destination);
      for (const name of ['music', 'sfx', 'ambience'] as const) {
        const bus = this.context.createGain();
        bus.gain.value = this.volumes[name];
        bus.connect(this.master);
        this.buses.set(name, bus);
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  bus(name: BusName): GainNode | null {
    return this.buses.get(name) ?? null;
  }

  getVolume(name: 'master' | BusName): number {
    return this.volumes[name];
  }

  setVolume(name: 'master' | BusName, value: number): void {
    const v = Math.min(1, Math.max(0, value));
    this.volumes[name] = v;
    const node = name === 'master' ? this.master : this.buses.get(name);
    if (node && this.context) node.gain.setTargetAtTime(v, this.context.currentTime, 0.03);
  }

  /** 0.5 秒の白色ノイズ（ループ再生で使い回す）。 */
  noise(): AudioBuffer {
    const ctx = this.context;
    if (!ctx) throw new Error('[audio] context not ready');
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * `assets/audio/<path>` を読む。無ければ null（合成音にフォールバック）。結果はキャッシュ。
   * 例: sample('sfx/hit_heavy.ogg'), sample('bgm/explore.ogg')
   */
  sample(path: string): Promise<AudioBuffer | null> {
    const cached = this.samples.get(path);
    if (cached) return cached;
    const promise = this.loadSample(path);
    this.samples.set(path, promise);
    return promise;
  }

  private async loadSample(path: string): Promise<AudioBuffer | null> {
    const ctx = this.context;
    if (!ctx) return null;
    const url = assetUrl(`assets/audio/${path}`);
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) return null;
      const type = head.headers.get('content-type') ?? '';
      if (type.includes('text/html')) return null; // SPA フォールバックで index.html が返る環境
      const res = await fetch(url);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
}
