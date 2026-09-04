import balanceJson from './balance.json';
import verdantTempestJson from './fields/verdant_tempest.json';
import titanBladeJson from './weapons/titan_blade.json';
import riftSaberJson from './weapons/rift_saber.json';
import valgaronJson from './monsters/valgaron.json';
import grastJson from './creatures/grast.json';
import skarvJson from './creatures/skarv.json';
import huntValgaronJson from './quests/vs01_hunt_valgaron.json';
import itemsJson from './items.json';
import recipesJson from './recipes.json';
import { validate } from './validate';
import { itemCatalogSchema, type ItemCatalog, type ItemDefinition } from './schemas/item';
import { assertRecipeConsistency, recipeCatalogSchema, type RecipeCatalog, type WeaponUpgradeRecipe } from './schemas/recipe';
import { creatureSchema, type CreatureDefinition } from './schemas/creature';
import { questSchema, type QuestDefinition } from './schemas/quest';
import { balanceSchema, type BalanceData } from './schemas/balance';
import { assertFieldConsistency, fieldSchema, type FieldDefinition } from './schemas/field';
import { assertWeaponConsistency, weaponSchema, type WeaponDefinition } from './schemas/weapon';
import { assertMonsterConsistency, monsterSchema, type MonsterDefinition } from './schemas/monster';

/**
 * ゲームデータの読み込み口。
 * JSON は Vite が静的に取り込む。ここで検証してから型付きで返すことで、
 * 以降のコードは「データは正しい」前提で書ける。
 */
export function loadBalance(): BalanceData {
  validate(balanceJson, balanceSchema, 'balance');
  return balanceJson as BalanceData;
}

export function loadVerdantTempest(): FieldDefinition {
  validate(verdantTempestJson, fieldSchema, 'fields/verdant_tempest');
  const field = verdantTempestJson as unknown as FieldDefinition;
  assertFieldConsistency(field);
  return field;
}

export function loadTitanBlade(): WeaponDefinition {
  validate(titanBladeJson, weaponSchema, 'weapons/titan_blade');
  const weapon = titanBladeJson as WeaponDefinition;
  assertWeaponConsistency(weapon);
  return weapon;
}

/** 全武器を id -> 定義 の Map で返す。順序は拠点の表示順。 */
export function loadWeapons(): Map<string, WeaponDefinition> {
  const map = new Map<string, WeaponDefinition>();
  for (const [json, name] of [
    [titanBladeJson, 'weapons/titan_blade'],
    [riftSaberJson, 'weapons/rift_saber'],
  ] as const) {
    validate(json, weaponSchema, name);
    const weapon = json as WeaponDefinition;
    assertWeaponConsistency(weapon);
    map.set(weapon.id, weapon);
  }
  return map;
}

/** 小型生物定義を id -> 定義 の Map で返す。 */
export function loadCreatures(): Map<string, CreatureDefinition> {
  const map = new Map<string, CreatureDefinition>();
  for (const [json, name] of [
    [grastJson, 'creatures/grast'],
    [skarvJson, 'creatures/skarv'],
  ] as const) {
    validate(json, creatureSchema, name);
    const def = json as CreatureDefinition;
    map.set(def.id, def);
  }
  return map;
}

export function loadItems(): Map<string, ItemDefinition> {
  validate(itemsJson, itemCatalogSchema, 'items');
  const map = new Map<string, ItemDefinition>();
  for (const item of (itemsJson as ItemCatalog).items) {
    if (map.has(item.id)) throw new Error(`[items] duplicate item id "${item.id}"`);
    map.set(item.id, item);
  }
  return map;
}

/** 素材参照（剥ぎ取り表・報酬・レシピ）が items.json に存在することを検査する。 */
export function assertItemReferences(items: Map<string, ItemDefinition>, ids: Iterable<string>, where: string): void {
  for (const id of ids) {
    if (!items.has(id)) throw new Error(`[${where}] references unknown item "${id}"`);
  }
}

export function loadRecipes(): WeaponUpgradeRecipe[] {
  validate(recipesJson, recipeCatalogSchema, 'recipes');
  const catalog = recipesJson as RecipeCatalog;
  assertRecipeConsistency(catalog);
  return catalog.recipes;
}

export function loadQuests(): QuestDefinition[] {
  const list: QuestDefinition[] = [];
  for (const [json, name] of [[huntValgaronJson, 'quests/vs01_hunt_valgaron']] as const) {
    validate(json, questSchema, name);
    list.push(json as QuestDefinition);
  }
  return list;
}

export function loadValgaron(): MonsterDefinition {
  validate(valgaronJson, monsterSchema, 'monsters/valgaron');
  const monster = valgaronJson as unknown as MonsterDefinition;
  assertMonsterConsistency(monster);
  return monster;
}
