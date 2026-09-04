import { beforeEach, describe, expect, it } from 'vitest';
import { CraftingManager } from '@core/crafting/CraftingManager';
import { Inventory } from '@core/inventory/Inventory';
import { assertItemReferences, loadItems, loadRecipes, loadTitanBlade } from '@data/DataRegistry';

const recipes = loadRecipes();
const base = loadTitanBlade();

describe('CraftingManager', () => {
  let inventory: Inventory;
  let crafting: CraftingManager;

  beforeEach(() => {
    inventory = new Inventory();
    crafting = new CraftingManager(recipes, inventory);
  });

  it('recipe materials reference existing items', () => {
    const items = loadItems();
    for (const r of recipes) assertItemReferences(items, r.materials.map((m) => m.itemId), r.id);
  });

  it('offers the level-1 recipe first and refuses without materials', () => {
    const next = crafting.nextRecipe('titan_blade')!;
    expect(next.fromLevel).toBe(0);
    expect(crafting.canCraft(next)).toBe(false);
    expect(crafting.craft(next, base)).toBeNull();
    expect(crafting.materialStatus(next).every((s) => s.owned === 0)).toBe(true);
  });

  it('consumes materials, raises the level and upgrades weapon stats', () => {
    const next = crafting.nextRecipe('titan_blade')!;
    for (const m of next.materials) inventory.add(m.itemId, m.count + 1);
    expect(crafting.canCraft(next)).toBe(true);
    const upgraded = crafting.craft(next, base)!;
    expect(upgraded.weaponPower).toBe(next.result.weaponPower);
    expect(upgraded.sharpness).toBe(next.result.sharpness);
    expect(upgraded.name).toBe(next.displayName);
    expect(upgraded.attacks).toBe(base.attacks); // 攻撃データは共有のまま
    for (const m of next.materials) expect(inventory.count(m.itemId)).toBe(1);
    expect(crafting.weaponLevel('titan_blade')).toBe(1);
    expect(crafting.nextRecipe('titan_blade')?.fromLevel).toBe(1);
    expect(crafting.canCraft(next)).toBe(false); // 同じレシピは二度使えない
  });

  it('restores progress and reapplies stats', () => {
    const restored = crafting.restore({ weaponLevels: { titan_blade: 2 } }, base);
    expect(crafting.weaponLevel('titan_blade')).toBe(2);
    expect(restored.weaponPower).toBe(recipes.find((r) => r.toLevel === 2)!.result.weaponPower);
    expect(crafting.toProgress()).toEqual({ weaponLevels: { titan_blade: 2 } });
  });

  it('returns null after the final level', () => {
    crafting.restore({ weaponLevels: { titan_blade: 3 } }, base);
    expect(crafting.nextRecipe('titan_blade')).toBeNull();
  });
});
