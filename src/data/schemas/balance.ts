import type { Schema } from '../validate';

export interface DodgeBalance {
  staminaCost: number;
  durationSeconds: number;
  distance: number;
  invulnStartSeconds: number;
  invulnEndSeconds: number;
}

export interface PlayerBalance {
  maxHp: number;
  maxStamina: number;
  staminaRegenPerSecond: number;
  staminaRegenDelaySeconds: number;
  walkSpeed: number;
  dashSpeed: number;
  dashStaminaPerSecond: number;
  dashMinStamina: number;
  turnSpeedRadPerSecond: number;
  gravity: number;
  capsuleRadius: number;
  height: number;
  dodge: DodgeBalance;
}

export interface CameraBalance {
  distance: number;
  minDistance: number;
  targetHeight: number;
  pitchMinRad: number;
  pitchMaxRad: number;
  initialPitchRad: number;
  lookSensitivity: number;
  followSharpness: number;
  groundMargin: number;
  collisionSamples: number;
  /** ロックオン時にターゲット方向へ向く速さ（指数追従の鋭さ）。 */
  lockOnSharpness: number;
  /** ロックオン時の固定ピッチ。 */
  lockOnPitchRad: number;
  /** これより遠いとロックオンできない / 外れる。 */
  lockOnMaxDistance: number;
}

export const SHARPNESS_LEVELS = ['dull', 'normal', 'sharp', 'keen'] as const;
export type SharpnessLevel = (typeof SHARPNESS_LEVELS)[number];

export interface SharpnessModifier {
  physical: number;
  element: number;
}

export interface CombatBalance {
  critMultiplier: number;
  sharpnessModifiers: Record<SharpnessLevel, SharpnessModifier>;
  /** 怯み蓄積値の毎秒減衰。 */
  flinchDecayPerSecond: number;
  /** 怯むたびに閾値へ掛ける倍率（連続怯みハメの抑制）。 */
  flinchThresholdGrowth: number;
  /** 1 ヒットの最低ダメージ。 */
  minimumDamage: number;
}

export interface BalanceData {
  player: PlayerBalance;
  camera: CameraBalance;
  combat: CombatBalance;
}

const sharpnessModifierSchema = { physical: 'number', element: 'number' } as const satisfies Schema;

export const balanceSchema = {
  player: {
    maxHp: 'number',
    maxStamina: 'number',
    staminaRegenPerSecond: 'number',
    staminaRegenDelaySeconds: 'number',
    walkSpeed: 'number',
    dashSpeed: 'number',
    dashStaminaPerSecond: 'number',
    dashMinStamina: 'number',
    turnSpeedRadPerSecond: 'number',
    gravity: 'number',
    capsuleRadius: 'number',
    height: 'number',
    dodge: {
      staminaCost: 'number',
      durationSeconds: 'number',
      distance: 'number',
      invulnStartSeconds: 'number',
      invulnEndSeconds: 'number',
    },
  },
  camera: {
    distance: 'number',
    minDistance: 'number',
    targetHeight: 'number',
    pitchMinRad: 'number',
    pitchMaxRad: 'number',
    initialPitchRad: 'number',
    lookSensitivity: 'number',
    followSharpness: 'number',
    groundMargin: 'number',
    collisionSamples: 'number',
    lockOnSharpness: 'number',
    lockOnPitchRad: 'number',
    lockOnMaxDistance: 'number',
  },
  combat: {
    critMultiplier: 'number',
    sharpnessModifiers: {
      dull: sharpnessModifierSchema,
      normal: sharpnessModifierSchema,
      sharp: sharpnessModifierSchema,
      keen: sharpnessModifierSchema,
    },
    flinchDecayPerSecond: 'number',
    flinchThresholdGrowth: 'number',
    minimumDamage: 'number',
  },
} as const satisfies Schema;
