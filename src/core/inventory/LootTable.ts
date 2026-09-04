import type { CarveEntry, PartBreakReward } from '@data/schemas/item';
import type { QuestRewardMaterial } from '@data/schemas/quest';
import type { Random } from '@shared/rng/Random';

export interface LootDrop {
  itemId: string;
  count: number;
}

/** 重み付き抽選で 1 エントリを選ぶ。表が空なら null。 */
export function rollCarve(table: readonly CarveEntry[], rng: Random): LootDrop | null {
  let total = 0;
  for (const e of table) total += Math.max(0, e.weight);
  if (total <= 0) return null;
  let roll = rng.next() * total;
  for (const e of table) {
    roll -= Math.max(0, e.weight);
    if (roll <= 0) return { itemId: e.itemId, count: e.count };
  }
  const last = table[table.length - 1];
  return last ? { itemId: last.itemId, count: last.count } : null;
}

/** クエスト基本報酬。各エントリを確率で独立に判定する。 */
export function rollQuestRewards(rewards: readonly QuestRewardMaterial[], rng: Random): LootDrop[] {
  const drops: LootDrop[] = [];
  for (const r of rewards) {
    if (rng.chance(r.chance)) drops.push({ itemId: r.itemId, count: r.count });
  }
  return drops;
}

/** 部位破壊報酬。破壊した部位に対応するエントリだけを判定する。 */
export function rollPartBreakRewards(rewards: readonly PartBreakReward[], brokenPartIds: readonly string[], rng: Random): LootDrop[] {
  const drops: LootDrop[] = [];
  for (const r of rewards) {
    if (!brokenPartIds.includes(r.partId)) continue;
    if (rng.chance(r.chance)) drops.push({ itemId: r.itemId, count: r.count });
  }
  return drops;
}

/** 同じアイテムをまとめる（表示用）。 */
export function mergeDrops(drops: readonly LootDrop[]): LootDrop[] {
  const map = new Map<string, number>();
  for (const d of drops) map.set(d.itemId, (map.get(d.itemId) ?? 0) + d.count);
  return [...map.entries()].map(([itemId, count]) => ({ itemId, count }));
}
