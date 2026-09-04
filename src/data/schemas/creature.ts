import { oneOf, type Schema } from '../validate';
import { carveEntrySchema, type CarveEntry } from './item';

export const CREATURE_KINDS = ['herbivore', 'scavenger'] as const;
export type CreatureKind = (typeof CREATURE_KINDS)[number];

/**
 * 小型生物の定義。大型モンスターと違い部位は持たず、1 つの球で当たり判定する。
 */
export interface CreatureDefinition {
  id: string;
  name: string;
  kind: CreatureKind;
  maxHp: number;
  walkSpeed: number;
  runSpeed: number;
  bodyRadius: number;
  height: number;
  /** プレイヤーの攻撃ダメージに掛ける倍率（肉質の代わり）。 */
  hitZone: number;
  /** プレイヤー / 大型モンスターからこの距離で逃げる（静かなプレイヤーは半分）。 */
  fleeRangePlayer: number;
  fleeRangeMonster: number;
  /** 脅威が消えてから落ち着くまでの秒数。 */
  calmSeconds: number;
  /** ねぐらの周りをうろつく半径と間隔。 */
  wanderRadius: number;
  wanderIntervalMinSeconds: number;
  wanderIntervalMaxSeconds: number;
  /** 群れの頭数（1 で単独）と間隔。 */
  herdSize: number;
  herdSpacing: number;
  /** 腐肉食: 死骸に引き寄せられる距離（0 で無効）と食べる時間。 */
  scavengeAttractRange: number;
  scavengeFeedSeconds: number;
  /** この生物の死骸が餌として持つ秒数。 */
  carcassMeatSeconds: number;
  /** 剥ぎ取り抽選表。 */
  carves: CarveEntry[];
}

export const creatureSchema = {
  id: 'string',
  name: 'string',
  kind: oneOf(CREATURE_KINDS),
  maxHp: 'number',
  walkSpeed: 'number',
  runSpeed: 'number',
  bodyRadius: 'number',
  height: 'number',
  hitZone: 'number',
  fleeRangePlayer: 'number',
  fleeRangeMonster: 'number',
  calmSeconds: 'number',
  wanderRadius: 'number',
  wanderIntervalMinSeconds: 'number',
  wanderIntervalMaxSeconds: 'number',
  herdSize: 'number',
  herdSpacing: 'number',
  scavengeAttractRange: 'number',
  scavengeFeedSeconds: 'number',
  carcassMeatSeconds: 'number',
  carves: [carveEntrySchema],
} as const satisfies Schema;
