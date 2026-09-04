import { oneOf, optional, record, type Schema } from '../validate';
import { PHYSICAL_DAMAGE_TYPES, attackTotalSeconds, type AttackData } from '@core/combat/AttackData';

export const WEAPON_WEIGHTS = ['light', 'medium', 'heavy'] as const;
export type WeaponWeight = (typeof WEAPON_WEIGHTS)[number];

export interface ChargeLevel {
  /** このレベルに到達するホールド秒。昇順で並べる。 */
  holdSeconds: number;
  motionValueMultiplier: number;
  partDamageMultiplier: number;
  hitStopSeconds: number;
}

export interface ComboLinks {
  light?: string;
  heavy?: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  weaponPower: number;
  weight: WeaponWeight;
  /** 攻撃の startup 中に入力方向へ向き直れる速度。0 で旋回不可。 */
  startupTurnSpeedRadPerSecond: number;
  /** 先行入力を保持する秒数。 */
  inputBufferSeconds: number;
  /** 回避終了からこの秒数以内の Light 入力は回避攻撃になる。 */
  dodgeAttackWindowSeconds: number;
  /** Heavy をこの秒数未満で離すと通常 Heavy、以上でチャージ攻撃。 */
  heavyTapThresholdSeconds: number;
  /** チャージ中に毎秒消費するスタミナ。尽きると自動で放つ。 */
  chargeStaminaPerSecond: number;
  attacks: AttackData[];
  charge: {
    attackId: string;
    levels: ChargeLevel[];
  };
  dodgeAttackId: string;
  /** key は 'idle' または攻撃 id。value はそこから派生できる攻撃。 */
  combo: Record<string, ComboLinks>;
}

const offsetSchema = { x: 'number', y: 'number', z: 'number' } as const satisfies Schema;

export const attackSchema = {
  id: 'string',
  name: 'string',
  damageType: oneOf(PHYSICAL_DAMAGE_TYPES),
  motionValue: 'number',
  elementMotionValue: 'number',
  startupSeconds: 'number',
  activeSeconds: 'number',
  recoverySeconds: 'number',
  staminaCost: 'number',
  partDamageMultiplier: 'number',
  stunDamage: 'number',
  flinchDamage: 'number',
  hitStopSeconds: 'number',
  forwardStep: 'number',
  chainFromSeconds: 'number',
  dodgeCancelFromSeconds: 'number',
  hitboxes: [{ offset: offsetSchema, radius: 'number' }],
} as const satisfies Schema;

export const weaponSchema = {
  id: 'string',
  name: 'string',
  weaponPower: 'number',
  weight: oneOf(WEAPON_WEIGHTS),
  startupTurnSpeedRadPerSecond: 'number',
  inputBufferSeconds: 'number',
  dodgeAttackWindowSeconds: 'number',
  heavyTapThresholdSeconds: 'number',
  chargeStaminaPerSecond: 'number',
  attacks: [attackSchema],
  charge: {
    attackId: 'string',
    levels: [
      {
        holdSeconds: 'number',
        motionValueMultiplier: 'number',
        partDamageMultiplier: 'number',
        hitStopSeconds: 'number',
      },
    ],
  },
  dodgeAttackId: 'string',
  combo: record({ light: optional('string'), heavy: optional('string') }),
} as const satisfies Schema;

/**
 * 型検証では拾えない意味的な整合性（id の参照切れ、タイムラインの矛盾）を検査する。
 * 起動時に落とすことで、データ編集ミスをプレイ中の「攻撃が出ない」で気付く事態を防ぐ。
 */
export function assertWeaponConsistency(weapon: WeaponDefinition): void {
  const ids = new Set<string>();
  for (const attack of weapon.attacks) {
    if (ids.has(attack.id)) throw new Error(`[weapon ${weapon.id}] duplicate attack id "${attack.id}"`);
    ids.add(attack.id);
    const total = attackTotalSeconds(attack);
    if (attack.chainFromSeconds > total) {
      throw new Error(`[weapon ${weapon.id}] ${attack.id}: chainFromSeconds exceeds total duration`);
    }
    if (attack.dodgeCancelFromSeconds > total) {
      throw new Error(`[weapon ${weapon.id}] ${attack.id}: dodgeCancelFromSeconds exceeds total duration`);
    }
    if (attack.chainFromSeconds < attack.startupSeconds + attack.activeSeconds) {
      throw new Error(`[weapon ${weapon.id}] ${attack.id}: chain window must not open before active phase ends`);
    }
  }
  const requireId = (id: string, where: string): void => {
    if (!ids.has(id)) throw new Error(`[weapon ${weapon.id}] ${where} references unknown attack "${id}"`);
  };
  requireId(weapon.charge.attackId, 'charge.attackId');
  requireId(weapon.dodgeAttackId, 'dodgeAttackId');
  for (const [from, links] of Object.entries(weapon.combo)) {
    if (from !== 'idle') requireId(from, 'combo key');
    if (links.light) requireId(links.light, `combo.${from}.light`);
    if (links.heavy) requireId(links.heavy, `combo.${from}.heavy`);
  }
  if (!weapon.combo['idle']) throw new Error(`[weapon ${weapon.id}] combo must define "idle"`);
  const levels = weapon.charge.levels;
  if (levels.length === 0) throw new Error(`[weapon ${weapon.id}] charge.levels must not be empty`);
  for (let i = 1; i < levels.length; i++) {
    if ((levels[i] as ChargeLevel).holdSeconds <= (levels[i - 1] as ChargeLevel).holdSeconds) {
      throw new Error(`[weapon ${weapon.id}] charge.levels must be sorted by holdSeconds`);
    }
  }
  if ((levels[0] as ChargeLevel).holdSeconds > weapon.heavyTapThresholdSeconds) {
    throw new Error(`[weapon ${weapon.id}] charge.levels[0].holdSeconds must be <= heavyTapThresholdSeconds`);
  }
}
