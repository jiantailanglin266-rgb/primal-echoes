import type { WeaponDefinition } from '@data/schemas/weapon';
import type { WeaponUpgradeRecipe } from '@data/schemas/recipe';
import type { Inventory } from '@core/inventory/Inventory';

export interface CraftingProgress {
  /** 武器 id -> 現在の強化段階。 */
  weaponLevels: Record<string, number>;
}

export interface MaterialStatus {
  itemId: string;
  required: number;
  owned: number;
}

/**
 * 工房。素材を消費して武器を強化する。
 * 武器定義（攻撃データ・コンボ）は変えず、性能値（攻撃力・斬れ味・会心）だけを差し替えた
 * 新しい WeaponDefinition を返す。データ駆動で「レベル N の武器」を表現するための最小構成。
 */
export class CraftingManager {
  private readonly weaponLevels = new Map<string, number>();

  constructor(
    private readonly recipes: readonly WeaponUpgradeRecipe[],
    private readonly inventory: Inventory,
  ) {}

  weaponLevel(weaponId: string): number {
    return this.weaponLevels.get(weaponId) ?? 0;
  }

  /** 次に作れるレシピ（現在段階から +1 のもの）。無ければ null（最終段階）。 */
  nextRecipe(weaponId: string): WeaponUpgradeRecipe | null {
    const level = this.weaponLevel(weaponId);
    return this.recipes.find((r) => r.weaponId === weaponId && r.fromLevel === level) ?? null;
  }

  materialStatus(recipe: WeaponUpgradeRecipe): MaterialStatus[] {
    return recipe.materials.map((m) => ({ itemId: m.itemId, required: m.count, owned: this.inventory.count(m.itemId) }));
  }

  canCraft(recipe: WeaponUpgradeRecipe): boolean {
    if (recipe.fromLevel !== this.weaponLevel(recipe.weaponId)) return false;
    return recipe.materials.every((m) => this.inventory.has(m.itemId, m.count));
  }

  /**
   * 強化を実行し、性能を差し替えた武器定義を返す。作れなければ null。
   * 素材消費は全件揃っていることを確認してから行う（途中で失敗しない）。
   */
  craft(recipe: WeaponUpgradeRecipe, base: WeaponDefinition): WeaponDefinition | null {
    if (!this.canCraft(recipe)) return null;
    for (const m of recipe.materials) this.inventory.remove(m.itemId, m.count);
    this.weaponLevels.set(recipe.weaponId, recipe.toLevel);
    return applyUpgrade(base, recipe);
  }

  /** 保存された段階を復元し、対応する性能を base に適用した武器定義を返す。 */
  restore(progress: CraftingProgress, base: WeaponDefinition): WeaponDefinition {
    this.weaponLevels.clear();
    for (const [id, level] of Object.entries(progress.weaponLevels)) {
      if (Number.isFinite(level) && level > 0) this.weaponLevels.set(id, Math.floor(level));
    }
    return this.weaponAtCurrentLevel(base);
  }

  /** 現在段階の性能を base に適用する（レシピを順に辿る）。 */
  weaponAtCurrentLevel(base: WeaponDefinition): WeaponDefinition {
    const level = this.weaponLevel(base.id);
    let weapon = base;
    for (let l = 0; l < level; l++) {
      const recipe = this.recipes.find((r) => r.weaponId === base.id && r.fromLevel === l);
      if (!recipe) break;
      weapon = applyUpgrade(weapon, recipe);
    }
    return weapon;
  }

  toProgress(): CraftingProgress {
    return { weaponLevels: Object.fromEntries(this.weaponLevels) };
  }
}

/** 攻撃データやコンボはそのまま、性能値と表示名だけを置き換える。 */
export function applyUpgrade(base: WeaponDefinition, recipe: WeaponUpgradeRecipe): WeaponDefinition {
  return {
    ...base,
    name: recipe.displayName,
    weaponPower: recipe.result.weaponPower,
    sharpness: recipe.result.sharpness,
    critRate: recipe.result.critRate,
  };
}
