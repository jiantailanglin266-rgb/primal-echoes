import * as THREE from 'three';
import type { Player } from '@core/player/Player';
import type { PhaseInfo } from '@core/combat/AttackData';
import { Vec3 } from '@shared/math/Vec3';
import { lerp } from '@shared/math/scalar';
import { createRangerModel, createWeaponModel, type RangerModel } from './RangerModel';
import { CharacterRig, PLAYER_CLIP_MAP } from './render/CharacterRig';
import { fitToHeight, tuneMaterials, type AssetLoader } from './render/AssetLoader';

/**
 * 武器ピボットの姿勢（オイラー角）。本番アニメが来るまでの手続きアニメ用キーポーズ。
 * 攻撃の「予備動作が見える」ことが戦闘設計の要なので、startup で大きく振りかぶる。
 * rotation.x が負なら刃は「後ろ上」（振りかぶり）、正なら「前下」（振り下ろし）になる。
 */
const WEAPON_POSES = {
  rest: { x: 0.1, y: 0, z: 0.35 },
  windup: { x: -1.15, y: 0.2, z: 0.4 },
  strike: { x: 1.9, y: -0.1, z: 0.1 },
  chargeHold: { x: -1.35, y: 0.3, z: 0.5 },
} as const;

type Pose = { x: number; y: number; z: number };

const WALK_CYCLE_SPEED = 9;

/**
 * Player の状態を Three.js オブジェクトへ反映する。
 * 位置は前ステップと現ステップの間を alpha で補間し、60Hz シミュレーションでも
 * 高リフレッシュレートで滑らかに見せる。四肢は移動速度から手続き的に振る。
 */
export class PlayerView {
  readonly object: THREE.Group;
  private model: RangerModel;
  private readonly interpolated = new Vec3();
  private readonly lastRenderPosition = new Vec3();
  private readonly phaseInfo: PhaseInfo = { phase: 'done', progress: 0 };
  private readonly pose: Pose = { ...WEAPON_POSES.rest };
  private weaponId: string;
  private walkPhase = 0;
  private elapsed = 0;
  /** glTF が読めたときのアニメーション制御。null ならプリミティブの手続きアニメ。 */
  private rig: CharacterRig | null = null;
  private lastAttackInstance = -1;

  /** 描画に使った補間済み位置。カメラ追従などで再利用する。 */
  get renderPosition(): Vec3 {
    return this.interpolated;
  }

  /** モデル読み込み試行の完了（モデルが無ければ即解決）。ローディング画面が待つ。 */
  readonly ready: Promise<void>;

  constructor(
    private readonly player: Player,
    loader: AssetLoader | null = null,
  ) {
    this.weaponId = player.combat.weapon.id;
    this.model = createRangerModel(player.combat.weapon.weight);
    this.object = new THREE.Group();
    this.object.add(this.model.group);
    this.model.weaponPivot.clear();
    this.model.weaponPivot.add(createWeaponModel(player.combat.weapon.weight, weaponKind(this.weaponId)));
    this.applyPose(WEAPON_POSES.rest);
    this.ready = loader ? this.tryLoadModel(loader) : Promise.resolve();
  }

  /** `assets/models/ranger.glb` があればプリミティブを隠して差し替える。無ければ何もしない。 */
  private async tryLoadModel(loader: AssetLoader): Promise<void> {
    const gltf = await loader.loadModel('ranger');
    if (!gltf) return;
    this.attachModel(gltf.scene, gltf.animations);
  }

  /** 読み込み済みモデルを組み込む（テストや差し替え UI からも使う）。 */
  attachModel(root: THREE.Object3D, animations: readonly THREE.AnimationClip[]): void {
    tuneMaterials(root, { envMapIntensity: 1.0 });
    fitToHeight(root, 1.8);
    this.rig = new CharacterRig(root, animations, PLAYER_CLIP_MAP);
    this.model.group.visible = false;
    this.object.add(root);
    // 右手のボーンがあれば武器をそこへ、無ければ肩ピボットのまま
    const hand = findBone(root, ['righthand', 'hand_r', 'hand.r']);
    if (hand) {
      hand.add(this.model.weaponPivot);
      this.model.weaponPivot.position.set(0, 0, 0);
      this.model.weaponPivot.visible = true;
    }
    this.rig.setState('idle');
  }

  get usesModel(): boolean {
    return this.rig !== null;
  }

  /** 武器を持ち替えたらモデルの武器を差し替える。 */
  private syncWeaponMesh(): void {
    const weapon = this.player.combat.weapon;
    if (weapon.id === this.weaponId) return;
    this.weaponId = weapon.id;
    this.model.weaponPivot.clear();
    this.model.weaponPivot.add(createWeaponModel(weapon.weight, weaponKind(weapon.id)));
  }

  sync(alpha: number, frameDt = 1 / 60): void {
    this.syncWeaponMesh();
    this.elapsed += frameDt;
    const controller = this.player.controller;
    this.interpolated.copy(controller.previousPosition).lerp(controller.position, alpha);
    const moved = this.interpolated.horizontalDistanceTo(this.lastRenderPosition);
    this.lastRenderPosition.copy(this.interpolated);
    this.object.position.set(this.interpolated.x, this.interpolated.y, this.interpolated.z);
    this.object.rotation.y = controller.yaw;

    const speed = frameDt > 0 ? moved / frameDt : 0;
    if (this.rig) {
      this.driveRig(speed, frameDt);
    } else {
      this.animateBody(speed, frameDt);
      this.updateWeaponPose();
    }
  }

  /** ゲーム状態 → クリップ状態。once のものは新しい攻撃ごとに頭から再生する。 */
  private driveRig(speed: number, frameDt: number): void {
    const rig = this.rig as CharacterRig;
    const c = this.player.controller;
    const combat = this.player.combat;
    if (c.state === 'downed') rig.setState('die', { once: true });
    else if (c.state === 'hurt') rig.setState('hit', { once: true });
    else if (c.state === 'dodge') rig.setState('dodge', { once: true, timeScale: 1.4 });
    else if (c.state === 'interact') rig.setState('interact');
    else if (combat.state === 'charging') rig.setState('charge');
    else if (combat.state === 'attacking' && combat.current) {
      const heavy = combat.current.attack.id.includes('heavy') || combat.current.attack.id.includes('charge');
      const state = heavy ? 'attack_heavy' : 'attack_light';
      if (combat.current.instanceId !== this.lastAttackInstance) {
        this.lastAttackInstance = combat.current.instanceId;
        rig.retrigger(state, { once: true });
      } else rig.setState(state, { once: true });
    } else if (c.state === 'dash') rig.setState('run');
    else if (c.state === 'walk' && speed > 0.3) rig.setState('walk');
    else rig.setState('idle');
    rig.update(frameDt);
  }

  private animateBody(speed: number, frameDt: number): void {
    const { torso, head, armL, armR, legL, legR, cape } = this.model.parts;
    const controller = this.player.controller;
    const state = controller.state;
    const moving = speed > 0.3 && (state === 'walk' || state === 'dash');
    const stride = Math.min(1, speed / 4.5);
    if (moving) this.walkPhase += frameDt * WALK_CYCLE_SPEED * (0.6 + stride * 0.6);

    const swing = moving ? Math.sin(this.walkPhase) * 0.55 * stride : 0;
    const k = Math.min(1, frameDt * 12);
    legL.rotation.x += (swing - legL.rotation.x) * k;
    legR.rotation.x += (-swing - legR.rotation.x) * k;
    // 腕は脚と逆位相。右腕は武器を持つので振りを小さく
    armL.rotation.x += (-swing * 0.8 - armL.rotation.x) * k;
    armR.rotation.x += (swing * 0.3 - armR.rotation.x) * k;

    // 上下動と前傾。ダッシュは前傾を強める
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.04 * stride : Math.sin(this.elapsed * 1.6) * 0.008;
    const lean = state === 'dash' ? 0.22 : moving ? 0.08 : 0;
    let tilt = lean;
    let crouch = 1;
    if (state === 'dodge') {
      tilt = 0.55;
      crouch = 0.72;
    } else if (state === 'hurt') {
      tilt = -0.45;
    } else if (state === 'downed') {
      tilt = -1.45;
    } else if (state === 'interact') {
      tilt = 0.35;
      crouch = 0.85;
    }
    torso.position.y = 0.95 * crouch + bob;
    torso.rotation.x += (tilt - torso.rotation.x) * k;
    head.rotation.x += (-tilt * 0.5 - head.rotation.x) * k;
    // マントは速度と歩行でなびく
    const flutter = Math.sin(this.elapsed * 7 + this.walkPhase) * 0.05;
    cape.rotation.x += (-0.25 - stride * 0.5 + flutter - cape.rotation.x) * k;
    this.object.scale.y = 1;
  }

  private updateWeaponPose(): void {
    const combat = this.player.combat;

    if (combat.state === 'charging') {
      // チャージ中は振りかぶったまま、レベルが上がるほど小刻みに震える
      const shake = Math.sin(performance.now() * 0.05) * 0.03 * (combat.chargeLevel + 1);
      this.pose.x = WEAPON_POSES.chargeHold.x + shake;
      this.pose.y = WEAPON_POSES.chargeHold.y;
      this.pose.z = WEAPON_POSES.chargeHold.z;
      this.applyPose(this.pose);
      return;
    }

    const info = combat.getPhase(this.phaseInfo);
    switch (info.phase) {
      case 'startup':
        blendPose(WEAPON_POSES.rest, WEAPON_POSES.windup, easeOut(info.progress), this.pose);
        break;
      case 'active':
        blendPose(WEAPON_POSES.windup, WEAPON_POSES.strike, info.progress, this.pose);
        break;
      case 'recovery':
        blendPose(WEAPON_POSES.strike, WEAPON_POSES.rest, easeInOut(info.progress), this.pose);
        break;
      default:
        blendPose(this.pose, WEAPON_POSES.rest, 0.25, this.pose);
        break;
    }
    this.applyPose(this.pose);
  }

  private applyPose(pose: Pose): void {
    this.model.weaponPivot.rotation.set(pose.x, pose.y, pose.z);
    // 攻撃中は右腕も武器と一緒に動かす
    this.model.parts.armR.rotation.x = pose.x * 0.6;
  }
}

function findBone(root: THREE.Object3D, names: readonly string[]): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (found) return;
    const n = obj.name.toLowerCase().replace(/[^a-z._]/g, '');
    if (names.some((name) => n.includes(name))) found = obj;
  });
  return found;
}

function weaponKind(weaponId: string): 'blade' | 'hammer' {
  return weaponId.includes('hammer') ? 'hammer' : 'blade';
}

function blendPose(a: Pose, b: Pose, t: number, out: Pose): void {
  out.x = lerp(a.x, b.x, t);
  out.y = lerp(a.y, b.y, t);
  out.z = lerp(a.z, b.z, t);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
