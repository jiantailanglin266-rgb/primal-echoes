import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CharacterRig, MONSTER_CLIP_MAP, PLAYER_CLIP_MAP, resolveClip } from '@presentation/render/CharacterRig';

function clip(name: string, seconds = 1): THREE.AnimationClip {
  const track = new THREE.NumberKeyframeTrack('.position[x]', [0, seconds], [0, 1]);
  return new THREE.AnimationClip(name, seconds, [track]);
}

describe('resolveClip', () => {
  const clips = [clip('Armature|Walking'), clip('Idle'), clip('mixamo.com|Roll'), clip('attack_heavy')];

  it('prefers exact matches, then partial matches, in candidate order', () => {
    expect(resolveClip(clips, PLAYER_CLIP_MAP['walk']!)?.name).toBe('Armature|Walking');
    expect(resolveClip(clips, PLAYER_CLIP_MAP['dodge']!)?.name).toBe('mixamo.com|Roll');
    expect(resolveClip(clips, PLAYER_CLIP_MAP['attack_heavy']!)?.name).toBe('attack_heavy');
    expect(resolveClip(clips, PLAYER_CLIP_MAP['run']!)).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(resolveClip(clips, ['IDLE'])?.name).toBe('Idle');
  });
});

describe('CharacterRig', () => {
  it('switches states with crossfade and tracks missing states', () => {
    const root = new THREE.Object3D();
    const rig = new CharacterRig(root, [clip('idle'), clip('walk'), clip('attack')], PLAYER_CLIP_MAP);
    rig.setState('idle');
    expect(rig.currentState).toBe('idle');
    rig.update(0.1);
    rig.setState('walk');
    expect(rig.currentState).toBe('walk');
    rig.update(0.3);
    rig.setState('run'); // 未定義
    expect(rig.currentState).toBe('walk');
    expect(rig.missingStates.has('run')).toBe(true);
    rig.setState('attack_light', { once: true });
    expect(rig.currentState).toBe('attack_light');
  });

  it('merges clips from additional files, later clips winning by name', () => {
    const root = new THREE.Object3D();
    const rig = new CharacterRig(root, [clip('idle', 1)], MONSTER_CLIP_MAP);
    expect(rig.hasState('roar')).toBe(false);
    rig.addClips([clip('Roar', 2), clip('idle', 3)]);
    expect(rig.hasState('roar')).toBe(true);
    rig.setState('idle');
    expect(rig.mixer.clipAction(clip('idle', 3))).toBeDefined();
  });
});
