import { oneOf, type Schema } from '../validate';

export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic'] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export const ITEM_CATEGORIES = ['material', 'consumable'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
}

export interface ItemCatalog {
  items: ItemDefinition[];
}

export const itemCatalogSchema = {
  items: [
    {
      id: 'string',
      name: 'string',
      category: oneOf(ITEM_CATEGORIES),
      rarity: oneOf(ITEM_RARITIES),
      description: 'string',
    },
  ],
} as const satisfies Schema;

/** 剥ぎ取り 1 回の抽選エントリ。weight の比で選ばれる。 */
export interface CarveEntry {
  itemId: string;
  weight: number;
  count: number;
}

/** 部位破壊のクエスト報酬。 */
export interface PartBreakReward {
  partId: string;
  itemId: string;
  count: number;
  chance: number;
}

export const carveEntrySchema = { itemId: 'string', weight: 'number', count: 'number' } as const satisfies Schema;
export const partBreakRewardSchema = { partId: 'string', itemId: 'string', count: 'number', chance: 'number' } as const satisfies Schema;
