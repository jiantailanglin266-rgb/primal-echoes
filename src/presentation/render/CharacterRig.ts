import * as THREE from 'three';

/**
 * 状態名 → クリップ名候補の対応表。
 * Mixamo など出典の異なるクリップ名の揺れ（"Walking" / "walk" / "Armature|walk"）を吸収するため、
 * 候補を順に探し、部分一致（大文字小文字無視）で解決する。
 */
export type ClipMap = Record<string, string[]>;

export const PLAYER_CLIP_MAP: ClipMap = {
  idle: ['idle', 'stand'],
  walk: ['walk'],
  run: ['run', 'sprint', 'dash'],
  dodge: ['roll', 'dodge', 'dive'],
  attack_light: ['attack_light', 'slash', 'attack'],
  attack_heavy: ['attack_heavy', 'heavy', 'smash'],
  charge: ['charge', 'windup'],
  hit: ['hit', 'impact', 'hurt'],
  die: ['death', 'die', 'dying'],
  interact: ['gather', 'crouch', 'kneel'],
};

export const MONSTER_CLIP_MAP: ClipMap = {
  idle: ['idle', 'breath'],
  walk: ['walk'],
  run: ['run', 'charge_run', 'gallop'],
  attack: ['attack', 'bite'],
  roar: ['roar', 'scream'],
  flinch: ['flinch', 'hit', 'stagger'],
  stun: ['stun', 'dizzy', 'knockout'],
  topple: ['topple', 'fall', 'trip'],
  sleep: ['sleep', 'rest', 'lie'],
  eat: ['eat', 'feed', 'graze'],
  die: ['death', 'die'],
};

/** 状態ごとの既定クロスフェード秒。 */
const DEFAULT_FADE = 0.25;
const FAST_FADE = 0.12;

export interface RigStateOptions {
  /** ループさせない（攻撃・被弾・死亡）。 */
  once?: boolean;
  /** 再生速度。 */
  timeScale?: number;
  fadeSeconds?: number;
}

/** クリップ名を候補から解決する（純関数。テスト対象）。 */
export function resolveClip(clips: readonly THREE.AnimationClip[], candidates: readonly string[]): THREE.AnimationClip | null {
  const lower = clips.map((c) => ({ clip: c, name: c.name.toLowerCase() }));
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    const exact = lower.find((c) => c.name === key);
    if (exact) return exact.clip;
    const partial = lower.find((c) => c.name.includes(key));
    if (partial) return partial.clip;
  }
  return null;
}

/**
 * AnimationMixer の薄いラッパー。状態名で再生を切り替え、クロスフェードする。
 * 同じスケルトンのクリップを複数ファイルから合成できるよう `addClips` を持つ。
 */
export class CharacterRig {
  readonly mixer: THREE.AnimationMixer;
  private readonly clips: THREE.AnimationClip[] = [];
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: { state: string; action: THREE.AnimationAction } | null = null;
  /** 解決できなかった状態（デバッグ表示用）。 */
  readonly missingStates = new Set<string>();

  constructor(
    readonly root: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
    private readonly clipMap: ClipMap,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.addClips(clips);
  }

  get currentState(): string | null {
    return this.current?.state ?? null;
  }

  /** 別ファイルのクリップを追加する（同一スケルトン前提）。同名は後勝ち。 */
  addClips(clips: readonly THREE.AnimationClip[]): void {
    for (const clip of clips) {
      const index = this.clips.findIndex((c) => c.name === clip.name);
      if (index >= 0) this.clips[index] = clip;
      else this.clips.push(clip);
    }
    this.actions.clear();
  }

  hasState(state: string): boolean {
    return this.resolveAction(state) !== null;
  }

  /** 状態を切り替える。同じ状態なら何もしない（once の再トリガーは retrigger を使う）。 */
  setState(state: string, options: RigStateOptions = {}): void {
    if (this.current?.state === state) return;
    const action = this.resolveAction(state);
    if (!action) {
      this.missingStates.add(state);
      return;
    }
    this.play(state, action, options);
  }

  /** once クリップを頭から再生し直す（連続攻撃など）。 */
  retrigger(state: string, options: RigStateOptions = {}): void {
    const action = this.resolveAction(state);
    if (!action) return;
    action.reset();
    this.play(state, action, options);
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  private play(state: string, action: THREE.AnimationAction, options: RigStateOptions): void {
    const fade = options.fadeSeconds ?? (options.once ? FAST_FADE : DEFAULT_FADE);
    action.setLoop(options.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = options.once === true;
    action.timeScale = options.timeScale ?? 1;
    action.enabled = true;
    if (this.current && this.current.action !== action) {
      action.reset().play();
      this.current.action.crossFadeTo(action, fade, false);
    } else {
      action.reset().fadeIn(fade).play();
    }
    this.current = { state, action };
  }

  private resolveAction(state: string): THREE.AnimationAction | null {
    const cached = this.actions.get(state);
    if (cached) return cached;
    const candidates = this.clipMap[state] ?? [state];
    const clip = resolveClip(this.clips, candidates);
    if (!clip) return null;
    const action = this.mixer.clipAction(clip);
    this.actions.set(state, action);
    return action;
  }
}
