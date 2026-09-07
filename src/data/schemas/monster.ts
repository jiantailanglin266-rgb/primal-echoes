import { oneOf, optional, type Schema } from '../validate';
import type { HitZoneModifiers, ElementType } from '@core/combat/elements';
import { ELEMENT_TYPES } from '@core/combat/elements';
import type { ShapeData } from '@core/combat/shapes';
import { PHYSICAL_DAMAGE_TYPES, type LocalOffset, type PhysicalDamageType, type SphereHitbox } from '@core/combat/AttackData';
import { carveEntrySchema, partBreakRewardSchema, type CarveEntry, type PartBreakReward } from './item';

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
  /** 蓄積が閾値に達したときの反応。脚は転倒（長い隙）。 */
  reaction: PartReaction;
  shape: ShapeData;
  breakEffects: PartBreakEffect[];
}

export const PART_REACTIONS = ['flinch', 'topple'] as const;
export type PartReaction = (typeof PART_REACTIONS)[number];

export const RANGE_BANDS = ['near', 'middle', 'far'] as const;
export type RangeBand = (typeof RANGE_BANDS)[number];

export const MONSTER_MOTION_KINDS = ['none', 'charge', 'lunge', 'projectile'] as const;
export type MonsterMotionKind = (typeof MONSTER_MOTION_KINDS)[number];

export interface MonsterAttackMotion {
  kind: MonsterMotionKind;
  /** charge: active 中の前進速度（m/s）。 */
  speed?: number;
  /** lunge: 着地点までの最大距離（m）。 */
  maxDistance?: number;
  /** projectile: 水平速度・半径・重力・発射位置。 */
  projectileSpeed?: number;
  projectileRadius?: number;
  projectileGravity?: number;
  spawnOffset?: LocalOffset;
}

export interface MonsterAttackDefinition {
  id: string;
  name: string;
  damage: number;
  damageType: PhysicalDamageType;
  element: { type: ElementType; power: number };
  /** 予備動作。判定はまだ無く、プレイヤーが「見て」対応するための時間。 */
  telegraphSeconds: number;
  startupSeconds: number;
  activeSeconds: number;
  recoverySeconds: number;
  staminaCost: number;
  ranges: RangeBand[];
  /** 抽選の重み。 */
  weight: number;
  cooldownSeconds: number;
  /** ターゲットとの相対角（絶対値, rad）がこの範囲のとき使用可能。尾攻撃は背後（π 付近）だけ。 */
  facingArc: { minRad: number; maxRad: number };
  /** テレグラフ中にターゲットへ向き直る速度の倍率。0 で向き固定。 */
  telegraphTurnMultiplier: number;
  hitboxes: SphereHitbox[];
  motion: MonsterAttackMotion;
  knockback: { distance: number; durationSeconds: number };
}

export interface MonsterCombatConfig {
  nearRangeMeters: number;
  middleRangeMeters: number;
  flinchSeconds: number;
  toppleSeconds: number;
  attackIntervalMinSeconds: number;
  attackIntervalMaxSeconds: number;
  /** これより近ければ接近をやめる。 */
  approachStopDistance: number;
}

export interface EnrageConfig {
  /** 直近の怒り解除以降に受けたダメージがこの値に達すると怒る。 */
  damageToTrigger: number;
  durationSeconds: number;
  /** 怒り開始時の咆哮（無防備な硬直）。 */
  roarSeconds: number;
  damageMultiplier: number;
  /** 攻撃タイムライン（telegraph/startup/recovery）と移動の速度倍率。 */
  speedMultiplier: number;
  /** 怒り中の攻撃スタミナ消費倍率（怒るほど疲れやすい）。 */
  staminaCostMultiplier: number;
  attackIntervalMultiplier: number;
  /** 怒り中に弱点化する部位（エーテル活性部）とその肉質倍率。 */
  weakPartIds: string[];
  weakPartHitZoneMultiplier: number;
  /** 怒り解除後、再び怒れるまでの時間。 */
  cooldownSeconds: number;
}

export interface ExhaustionConfig {
  /** スタミナがこの値以下で疲労。 */
  staminaThreshold: number;
  /** スタミナがここまで戻ると疲労解除。 */
  recoverToStamina: number;
  speedMultiplier: number;
  attackIntervalMultiplier: number;
  /** 通常時 / 疲労時のスタミナ自然回復（毎秒）。攻撃中は回復しない。 */
  staminaRegenPerSecond: number;
  exhaustedRegenPerSecond: number;
  /** 疲労中は使えない攻撃（突進が不発になる等）。 */
  disabledAttackIds: string[];
}

export interface PerceptionConfig {
  sightRange: number;
  /** 正面からの半角（rad）。 */
  sightAngleRad: number;
  hearingRange: number;
  /** 睡眠中の視覚・聴覚の倍率。 */
  sleepingSenseMultiplier: number;
  /** ターゲットがこれより遠い状態が loseTargetSeconds 続くと見失う。 */
  loseTargetRange: number;
  loseTargetSeconds: number;
}

export interface NeedsConfig {
  hungerPerSecond: number;
  thirstPerSecond: number;
  fatiguePerSecond: number;
  /** 戦闘中の疲れやすさ倍率。 */
  combatFatigueMultiplier: number;
  eatThreshold: number;
  drinkThreshold: number;
  sleepThreshold: number;
  eatSeconds: number;
  drinkSeconds: number;
  sleepSeconds: number;
  /** 食事で回復する内部スタミナ量。 */
  eatRestoresStamina: number;
  /** 睡眠中の HP 回復（最大 HP 比 / 秒）。 */
  sleepHpRegenRatioPerSecond: number;
  /** 初期値（クエスト開始時点でどれくらい腹が減っているか）。 */
  initialHunger: number;
  initialThirst: number;
  initialFatigue: number;
}

export interface BehaviorConfig {
  perception: PerceptionConfig;
  needs: NeedsConfig;
  /** HP がこの割合以下で巣へ逃げる（1 戦闘 1 回）。 */
  fleeHpRatio: number;
  /** 逃走後に巣で眠る時間。 */
  fleeSleepSeconds: number;
  /** 発見から戦闘開始までの警戒時間（振り向き・威嚇）。 */
  alertSeconds: number;
  /** 見失った地点を調べる時間。 */
  investigateSeconds: number;
  /** 巡回点での待機時間。 */
  patrolWaitMinSeconds: number;
  patrolWaitMaxSeconds: number;
  /** 目的地に「着いた」とみなす距離。 */
  arriveDistance: number;
  /** 餌場に着いたとき、この範囲の獲物を追う。 */
  hunt: {
    range: number;
    maxSeconds: number;
    catchDistance: number;
  };
}

export interface MonsterDefinition {
  id: string;
  name: string;
  enrage: EnrageConfig;
  exhaustion: ExhaustionConfig;
  behavior: BehaviorConfig;
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
  combat: MonsterCombatConfig;
  parts: MonsterPartDefinition[];
  attacks: MonsterAttackDefinition[];
  /** 死骸からの剥ぎ取り抽選表。 */
  carves: CarveEntry[];
  /** 部位破壊・切断のクエスト報酬。 */
  partBreakRewards: PartBreakReward[];
}

const hitZoneSchema = {
  slash: 'number',
  impact: 'number',
  projectile: 'number',
  fire: 'number',
  water: 'number',
  thunder: 'number',
  ice: 'number',
  echo: 'number',
} as const satisfies Schema;

const offsetSchema = { x: 'number', y: 'number', z: 'number' } as const satisfies Schema;

const attackSchema = {
  id: 'string',
  name: 'string',
  damage: 'number',
  damageType: oneOf(PHYSICAL_DAMAGE_TYPES),
  element: { type: oneOf(ELEMENT_TYPES), power: 'number' },
  telegraphSeconds: 'number',
  startupSeconds: 'number',
  activeSeconds: 'number',
  recoverySeconds: 'number',
  staminaCost: 'number',
  ranges: [oneOf(RANGE_BANDS)],
  weight: 'number',
  cooldownSeconds: 'number',
  facingArc: { minRad: 'number', maxRad: 'number' },
  telegraphTurnMultiplier: 'number',
  hitboxes: [{ offset: offsetSchema, radius: 'number' }],
  motion: {
    kind: oneOf(MONSTER_MOTION_KINDS),
    speed: optional('number'),
    maxDistance: optional('number'),
    projectileSpeed: optional('number'),
    projectileRadius: optional('number'),
    projectileGravity: optional('number'),
    spawnOffset: optional(offsetSchema),
  },
  knockback: { distance: 'number', durationSeconds: 'number' },
} as const satisfies Schema;

/**
 * shape / breakEffects は判別共用体なので型検証は 'type'/'kind' の存在だけ見て、
 * 詳細は assertMonsterConsistency で個別に検査する。
 */
export const monsterSchema = {
  id: 'string',
  name: 'string',
  enrage: {
    damageToTrigger: 'number',
    durationSeconds: 'number',
    roarSeconds: 'number',
    damageMultiplier: 'number',
    speedMultiplier: 'number',
    staminaCostMultiplier: 'number',
    attackIntervalMultiplier: 'number',
    weakPartIds: ['string'],
    weakPartHitZoneMultiplier: 'number',
    cooldownSeconds: 'number',
  },
  exhaustion: {
    staminaThreshold: 'number',
    recoverToStamina: 'number',
    speedMultiplier: 'number',
    attackIntervalMultiplier: 'number',
    staminaRegenPerSecond: 'number',
    exhaustedRegenPerSecond: 'number',
    disabledAttackIds: ['string'],
  },
  behavior: {
    perception: {
      sightRange: 'number',
      sightAngleRad: 'number',
      hearingRange: 'number',
      sleepingSenseMultiplier: 'number',
      loseTargetRange: 'number',
      loseTargetSeconds: 'number',
    },
    needs: {
      hungerPerSecond: 'number',
      thirstPerSecond: 'number',
      fatiguePerSecond: 'number',
      combatFatigueMultiplier: 'number',
      eatThreshold: 'number',
      drinkThreshold: 'number',
      sleepThreshold: 'number',
      eatSeconds: 'number',
      drinkSeconds: 'number',
      sleepSeconds: 'number',
      eatRestoresStamina: 'number',
      sleepHpRegenRatioPerSecond: 'number',
      initialHunger: 'number',
      initialThirst: 'number',
      initialFatigue: 'number',
    },
    fleeHpRatio: 'number',
    fleeSleepSeconds: 'number',
    alertSeconds: 'number',
    investigateSeconds: 'number',
    patrolWaitMinSeconds: 'number',
    patrolWaitMaxSeconds: 'number',
    arriveDistance: 'number',
    hunt: { range: 'number', maxSeconds: 'number', catchDistance: 'number' },
  },
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
  combat: {
    nearRangeMeters: 'number',
    middleRangeMeters: 'number',
    flinchSeconds: 'number',
    toppleSeconds: 'number',
    attackIntervalMinSeconds: 'number',
    attackIntervalMaxSeconds: 'number',
    approachStopDistance: 'number',
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
      reaction: oneOf(PART_REACTIONS),
      shape: { type: oneOf(['sphere', 'capsule']), radius: 'number' },
      breakEffects: [{ kind: oneOf(['attackDamageMultiplier', 'attackReachMultiplier', 'disableAttack', 'toppleThresholdMultiplier']) }],
    },
  ],
  attacks: [attackSchema],
  carves: [carveEntrySchema],
  partBreakRewards: [partBreakRewardSchema],
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

  const attackIds = new Set<string>();
  for (const attack of monster.attacks) {
    if (attackIds.has(attack.id)) throw new Error(`[monster ${monster.id}] duplicate attack id "${attack.id}"`);
    attackIds.add(attack.id);
    if (attack.ranges.length === 0) throw new Error(`[monster ${monster.id}] ${attack.id}: ranges must not be empty`);
    if (attack.facingArc.minRad > attack.facingArc.maxRad) {
      throw new Error(`[monster ${monster.id}] ${attack.id}: facingArc.minRad must be <= maxRad`);
    }
    const m = attack.motion;
    if (m.kind === 'charge' && typeof m.speed !== 'number') {
      throw new Error(`[monster ${monster.id}] ${attack.id}: charge motion requires speed`);
    }
    if (m.kind === 'lunge' && typeof m.maxDistance !== 'number') {
      throw new Error(`[monster ${monster.id}] ${attack.id}: lunge motion requires maxDistance`);
    }
    if (m.kind === 'projectile') {
      if (typeof m.projectileSpeed !== 'number' || typeof m.projectileRadius !== 'number' || typeof m.projectileGravity !== 'number' || !m.spawnOffset) {
        throw new Error(`[monster ${monster.id}] ${attack.id}: projectile motion requires speed/radius/gravity/spawnOffset`);
      }
    }
  }
  // 部位破壊効果が参照する攻撃 id の存在確認
  for (const part of monster.parts) {
    for (const effect of part.breakEffects) {
      const e = effect as { attackId?: string };
      if (e.attackId && !attackIds.has(e.attackId)) {
        throw new Error(`[monster ${monster.id}] ${part.id}: breakEffect references unknown attack "${e.attackId}"`);
      }
    }
  }
  if (monster.combat.nearRangeMeters >= monster.combat.middleRangeMeters) {
    throw new Error(`[monster ${monster.id}] combat.nearRangeMeters must be < middleRangeMeters`);
  }
  for (const partId of monster.enrage.weakPartIds) {
    if (!ids.has(partId)) throw new Error(`[monster ${monster.id}] enrage.weakPartIds references unknown part "${partId}"`);
  }
  for (const attackId of monster.exhaustion.disabledAttackIds) {
    if (!attackIds.has(attackId)) throw new Error(`[monster ${monster.id}] exhaustion.disabledAttackIds references unknown attack "${attackId}"`);
  }
  if (monster.exhaustion.recoverToStamina <= monster.exhaustion.staminaThreshold) {
    throw new Error(`[monster ${monster.id}] exhaustion.recoverToStamina must be > staminaThreshold`);
  }
  if (monster.carves.length === 0) throw new Error(`[monster ${monster.id}] carves must not be empty`);
  for (const reward of monster.partBreakRewards) {
    if (!ids.has(reward.partId)) throw new Error(`[monster ${monster.id}] partBreakRewards references unknown part "${reward.partId}"`);
  }

  function requireOffset(value: unknown, where: string): void {
    const v = value as Record<string, unknown> | undefined;
    for (const key of Object.keys(offsetSchema)) {
      if (typeof v?.[key] !== 'number') throw new Error(`[monster ${monster.id}] ${where}.${key} must be a number`);
    }
  }
}
