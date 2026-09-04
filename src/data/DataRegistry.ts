import balanceJson from './balance.json';
import verdantTempestJson from './fields/verdant_tempest.json';
import titanBladeJson from './weapons/titan_blade.json';
import valgaronJson from './monsters/valgaron.json';
import grastJson from './creatures/grast.json';
import skarvJson from './creatures/skarv.json';
import { validate } from './validate';
import { creatureSchema, type CreatureDefinition } from './schemas/creature';
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

export function loadValgaron(): MonsterDefinition {
  validate(valgaronJson, monsterSchema, 'monsters/valgaron');
  const monster = valgaronJson as unknown as MonsterDefinition;
  assertMonsterConsistency(monster);
  return monster;
}
