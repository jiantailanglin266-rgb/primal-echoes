import { oneOf, type Schema } from '../validate';
import type { HitZoneModifiers } from '@core/combat/elements';
import type { ShapeData } from '@core/combat/shapes';
import { PHYSICAL_DAMAGE_TYPES, type PhysicalDamageType } from '@core/combat/AttackData';

/**
 * 部位破壊の効果。T11 で戦闘へ反映する。データ構造だけ先に固定しておく。
 */
export type PartBreakEffect =
  | { kind: 'attackDamageMultiplier'; attackId: string; multiplier: number }
  | { kind: 'attackReachMultiplier'; attackId: string; multiplier: number }
  | { kind: 'disableAttack'; attackId: string }
  | { kind: 'toppleThresholdMultiplier'; multiplier: number };

export interface MonsterPartDefinition {
  id: string;
  name: string;
  hitZone: HitZoneModifiers;
  /** 0 以下なら破壊不可（partHp は怯み計算のみに使う）。 */
  partHp: number;
  breakable: boolean;
  /** 切断可能。切断は severDamageType の攻撃で partHp を 0 にしたときのみ。 */
  severable: boolean;
  severDamageType: PhysicalDamageType;
  /** 気絶蓄積倍率。頭部以外は通常 0。 */
  stunMultiplier: number;
  /** この部位への怯み蓄積がこの値に達すると怯む。 */
  flinchThreshold: number;
  shape: ShapeData;
  breakEffects: PartBreakEffect[];
}

export interface MonsterDefinition {
  id: string;
  name: string;
  stats: {
    maxHp: number;
    maxStamina: number;
    /** 気絶するまでの蓄積閾値。 */
    stunThreshold: number;
    stunDurationSeconds: number;
    walkSpeed: number;
    runSpeed: number;
    turnSpeedRadPerSecond: number;
    /** 胴体の代表半径。押し出しや距離判定の基準。 */
    bodyRadius: number;
  };
  parts: MonsterPartDefinition[];
}

const hitZoneSchema = {
  slash: 'number',
  impact: 'number',
  projectile: 'number',
  fire: 'number',
  water: 'number',
  thunder: 'number',
  ice: 'number',
  aether: 'number',
} as const satisfies Schema;

const offsetSchema = { x: 'number', y: 'number', z: 'number' } as const satisfies Schema;

/**
 * shape / breakEffects は判別共用体なので型検証は 'type'/'kind' の存在だけ見て、
 * 詳細は assertMonsterConsistency で個別に検査する。
 */
export const monsterSchema = {
  id: 'string',
  name: 'string',
  stats: {
    maxHp: 'number',
    maxStamina: 'number',
    stunThreshold: 'number',
    stunDurationSeconds: 'number',
    walkSpeed: 'number',
    runSpeed: 'number',
    turnSpeedRadPerSecond: 'number',
    bodyRadius: 'number',
  },
  parts: [
    {
      id: 'string',
      name: 'string',
      hitZone: hitZoneSchema,
      partHp: 'number',
      breakable: 'boolean',
      severable: 'boolean',
      severDamageType: oneOf(PHYSICAL_DAMAGE_TYPES),
      stunMultiplier: 'number',
      flinchThreshold: 'number',
      shape: { type: oneOf(['sphere', 'capsule']), radius: 'number' },
      breakEffects: [{ kind: oneOf(['attackDamageMultiplier', 'attackReachMultiplier', 'disableAttack', 'toppleThresholdMultiplier']) }],
    },
  ],
} as const satisfies Schema;

export function assertMonsterConsistency(monster: MonsterDefinition): void {
  const ids = new Set<string>();
  for (const part of monster.parts) {
    if (ids.has(part.id)) throw new Error(`[monster ${monster.id}] duplicate part id "${part.id}"`);
    ids.add(part.id);
    const shape = part.shape as unknown as { type: string } & Record<string, unknown>;
    if (shape.type === 'sphere') {
      requireOffset(shape['offset'], `${part.id}.shape.offset`);
    } else if (shape.type === 'capsule') {
      requireOffset(shape['start'], `${part.id}.shape.start`);
      requireOffset(shape['end'], `${part.id}.shape.end`);
    }
    if (part.breakable && part.partHp <= 0) {
      throw new Error(`[monster ${monster.id}] ${part.id}: breakable part needs partHp > 0`);
    }
    if (part.severable && !part.breakable) {
      throw new Error(`[monster ${monster.id}] ${part.id}: severable part must also be breakable`);
    }
    for (const effect of part.breakEffects) {
      const e = effect as Record<string, unknown>;
      if (e['kind'] !== 'toppleThresholdMultiplier' && typeof e['attackId'] !== 'string') {
        throw new Error(`[monster ${monster.id}] ${part.id}: breakEffect ${String(e['kind'])} requires attackId`);
      }
      if (e['kind'] !== 'disableAttack' && typeof e['multiplier'] !== 'number') {
        throw new Error(`[monster ${monster.id}] ${part.id}: breakEffect ${String(e['kind'])} requires multiplier`);
      }
    }
  }
  if (!ids.has('head')) throw new Error(`[monster ${monster.id}] a "head" part is required for stun logic`);

  function requireOffset(value: unknown, where: string): void {
    const v = value as Record<string, unknown> | undefined;
    for (const key of Object.keys(offsetSchema)) {
      if (typeof v?.[key] !== 'number') throw new Error(`[monster ${monster.id}] ${where}.${key} must be a number`);
    }
  }
}
