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
  groundMargin: number;
  collisionSamples: number;
  /** ロックオン時にターゲット方向へ向く速さ（指数追従の鋭さ）。 */
  lockOnSharpness: number;
  /** ロックオン時の固定ピッチ。 */
  lockOnPitchRad: number;
  /** これより遠いとロックオンできない / 外れる。 */
  lockOnMaxDistance: number;
  /** ソフトロック: この距離・角度内の対象へ、マウス操作していない間だけ緩く向く。 */
  softLockRange: number;
  softLockAngleRad: number;
  softLockSharpness: number;
  /** マウスを動かしてからこの秒数はソフトロックを止める。 */
  softLockSuppressSeconds: number;
  /** 肩越し: 注視点を右へずらす量（m）。 */
  shoulderOffset: number;
  fovDeg: number;
  /** ダッシュ時に FOV を広げる量（度）。 */
  dashFovBoostDeg: number;
  /** バネ追従（位置 / 注視点）。剛性が高いほど速く、減衰が高いほど揺り戻しが少ない。 */
  springStiffness: number;
  springDamping: number;
  lookSpringStiffness: number;
  lookSpringDamping: number;
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

export interface QuestBalance {
  /** 戦闘不能からキャンプで復帰するまでの秒数。 */
  respawnDelaySeconds: number;
  /** 残り時間がこれを切ったら HUD で警告する。 */
  timeWarningSeconds: number;
}

export interface CarveBalance {
  durationSeconds: number;
  rangeMeters: number;
}

export interface FeedbackBalance {
  /** 揺れ幅（m）= hitStop 秒 × この値。武器が重いほど Hit Stop が長く、揺れも大きくなる。 */
  shakePerHitStopSecond: number;
  shakeMaxSeconds: number;
  shakeOnPlayerHit: number;
  shakeOnRoar: number;
  shakeOnPartBreak: number;
  /** これ以上の Hit Stop は「重い一撃」として重い音を鳴らす。 */
  heavyHitStopThresholdSeconds: number;
  slowMoOnKillScale: number;
  slowMoOnKillSeconds: number;
  slowMoOnHeavyHitScale: number;
  slowMoOnHeavyHitSeconds: number;
  /** スロー中に DoF の絞りへ掛ける倍率。 */
  slowMoDofMultiplier: number;
  roarChromaticPulse: number;
  hitLightIntensity: number;
  hitLightSeconds: number;
}

export interface BalanceData {
  player: PlayerBalance;
  camera: CameraBalance;
  combat: CombatBalance;
  quest: QuestBalance;
  carve: CarveBalance;
  feedback: FeedbackBalance;
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
    groundMargin: 'number',
    collisionSamples: 'number',
    lockOnSharpness: 'number',
    lockOnPitchRad: 'number',
    lockOnMaxDistance: 'number',
    softLockRange: 'number',
    softLockAngleRad: 'number',
    softLockSharpness: 'number',
    softLockSuppressSeconds: 'number',
    shoulderOffset: 'number',
    fovDeg: 'number',
    dashFovBoostDeg: 'number',
    springStiffness: 'number',
    springDamping: 'number',
    lookSpringStiffness: 'number',
    lookSpringDamping: 'number',
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
  quest: {
    respawnDelaySeconds: 'number',
    timeWarningSeconds: 'number',
  },
  carve: {
    durationSeconds: 'number',
    rangeMeters: 'number',
  },
  feedback: {
    shakePerHitStopSecond: 'number',
    shakeMaxSeconds: 'number',
    shakeOnPlayerHit: 'number',
    shakeOnRoar: 'number',
    shakeOnPartBreak: 'number',
    heavyHitStopThresholdSeconds: 'number',
    slowMoOnKillScale: 'number',
    slowMoOnKillSeconds: 'number',
    slowMoOnHeavyHitScale: 'number',
    slowMoOnHeavyHitSeconds: 'number',
    slowMoDofMultiplier: 'number',
    roarChromaticPulse: 'number',
    hitLightIntensity: 'number',
    hitLightSeconds: 'number',
  },
} as const satisfies Schema;
