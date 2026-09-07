import { AudioEngine } from './AudioEngine';
import { Sfx, type SoundId } from './Sfx';
import { Music, type MusicState } from './Music';
import { Ambience } from './Ambience';

export type { SoundId, MusicState };

/**
 * 音の窓口。GameManager はこれだけを触る。
 * - play(id): 効果音（素材があれば素材、無ければ合成）
 * - setMusic(state, heat): 場面（title / explore / combat / resolve）。曲は切り替えずレイヤー音量で渡る
 * - setAmbience(areaId, raining): エリア別の環境音
 * - 音量: master / music / sfx / ambience
 * 素材ファイルが 1 つも無くても全部鳴る（合成音）。無音でもプレイに支障が無いよう、視覚の手応えは HUD 側が持つ。
 */
export class AudioManager {
  private readonly engine = new AudioEngine();
  private readonly sfx = new Sfx(this.engine);
  private readonly music = new Music(this.engine);
  private readonly ambience = new Ambience(this.engine);
  private pendingMusic: MusicState = 'none';
  private pendingHeat = 0;
  private pendingAmbience: { areaId: string | null; raining: boolean } | null = null;
  private unlocked = false;

  get masterVolume(): number {
    return this.engine.getVolume('master');
  }

  get musicVolume(): number {
    return this.engine.getVolume('music');
  }

  get sfxVolume(): number {
    return this.engine.getVolume('sfx');
  }

  setMasterVolume(value: number): void {
    this.engine.setVolume('master', value);
  }

  setMusicVolume(value: number): void {
    this.engine.setVolume('music', value);
  }

  setSfxVolume(value: number): void {
    this.engine.setVolume('sfx', value);
    this.engine.setVolume('ambience', value * 0.7);
  }

  /** ユーザー操作のハンドラから呼ぶ。以降、音が鳴る。保留していた場面と環境音も反映する。 */
  unlock(): void {
    this.engine.unlock();
    if (this.unlocked || !this.engine.isRunning) {
      if (!this.unlocked && this.engine.ctx) {
        // resume が非同期のことがあるので少し待って再試行
        window.setTimeout(() => this.unlock(), 120);
      }
      return;
    }
    this.unlocked = true;
    void this.sfx.preload();
    this.music.setState(this.pendingMusic, this.pendingHeat);
    if (this.pendingAmbience) this.ambience.set(this.pendingAmbience.areaId, this.pendingAmbience.raining);
  }

  play(id: SoundId): void {
    this.sfx.play(id);
  }

  /** タイトル表示のサウンドロゴ（2 秒）。 */
  playLogo(): void {
    this.sfx.play('logo');
  }

  setMusic(state: MusicState, heat = 0): void {
    this.pendingMusic = state;
    this.pendingHeat = heat;
    if (this.unlocked) this.music.setState(state, heat);
  }

  setMusicHeat(heat: number): void {
    this.pendingHeat = heat;
    if (this.unlocked) this.music.setHeat(heat);
  }

  setAmbience(areaId: string | null, raining: boolean): void {
    this.pendingAmbience = { areaId, raining };
    if (this.unlocked) this.ambience.set(areaId, raining);
  }

  silenceAmbience(): void {
    this.pendingAmbience = { areaId: null, raining: false };
    if (this.unlocked) this.ambience.silence();
  }

  /** 毎フレーム（実時間）。合成の打楽器と虫の声を先読みで予約する。 */
  update(frameDt: number): void {
    if (!this.unlocked) return;
    this.music.update();
    this.ambience.update(frameDt);
  }
}
