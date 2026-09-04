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
}

export interface BalanceData {
  player: PlayerBalance;
  camera: CameraBalance;
}

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
  },
} as const satisfies Schema;
