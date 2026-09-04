import { oneOf, type Schema } from '../validate';
import { SHARPNESS_LEVELS, type SharpnessLevel } from './balance';

export interface RecipeMaterial {
  itemId: string;
  count: number;
}

/**
 * 武器強化レシピ。fromLevel の武器を toLevel へ上げ、性能を差し替える。
 * 新規武器の製作も「level 0 -> 1」のレシピとして表せる。
 */
export interface WeaponUpgradeRecipe {
  id: string;
  kind: 'weaponUpgrade';
  weaponId: string;
  fromLevel: number;
  toLevel: number;
  displayName: string;
  materials: RecipeMaterial[];
  result: {
    weaponPower: number;
    sharpness: SharpnessLevel;
    critRate: number;
  };
}

export interface RecipeCatalog {
  recipes: WeaponUpgradeRecipe[];
}

export const recipeCatalogSchema = {
  recipes: [
    {
      id: 'string',
      kind: oneOf(['weaponUpgrade']),
      weaponId: 'string',
      fromLevel: 'number',
      toLevel: 'number',
      displayName: 'string',
      materials: [{ itemId: 'string', count: 'number' }],
      result: { weaponPower: 'number', sharpness: oneOf(SHARPNESS_LEVELS), critRate: 'number' },
    },
  ],
} as const satisfies Schema;

export function assertRecipeConsistency(catalog: RecipeCatalog): void {
  const ids = new Set<string>();
  for (const r of catalog.recipes) {
    if (ids.has(r.id)) throw new Error(`[recipes] duplicate recipe id "${r.id}"`);
    ids.add(r.id);
    if (r.toLevel !== r.fromLevel + 1) throw new Error(`[recipes] ${r.id}: toLevel must be fromLevel + 1`);
    if (r.materials.length === 0) throw new Error(`[recipes] ${r.id}: materials must not be empty`);
  }
}
