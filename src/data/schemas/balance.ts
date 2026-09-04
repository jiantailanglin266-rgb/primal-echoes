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
  /** 被弾判定用の球（中心高さ・半径）。カプセルより単純で十分。 */
  hurtboxRadius: number;
  hurtboxHeight: number;
  /** のけぞり終了後の無敵時間（連続被弾防止）。 */
  postHurtInvulnSeconds: number;
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
  /** 被ダメージ = 攻撃力 × defenseConstant / (defenseConstant + 防御力)。 */
  defenseConstant: number;
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
    hurtboxRadius: 'number',
    hurtboxHeight: 'number',
    postHurtInvulnSeconds: 'number',
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
    defenseConstant: 'number',
  },
} as const satisfies Schema;
