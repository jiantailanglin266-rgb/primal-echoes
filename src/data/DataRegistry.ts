import balanceJson from './balance.json';
import verdantTempestJson from './fields/verdant_tempest.json';
import titanBladeJson from './weapons/titan_blade.json';
import valgaronJson from './monsters/valgaron.json';
import { validate } from './validate';
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

export function loadValgaron(): MonsterDefinition {
  validate(valgaronJson, monsterSchema, 'monsters/valgaron');
  const monster = valgaronJson as unknown as MonsterDefinition;
  assertMonsterConsistency(monster);
  return monster;
}
