import balanceJson from './balance.json';
import devTerrainJson from './fields/dev_terrain.json';
import titanBladeJson from './weapons/titan_blade.json';
import { validate } from './validate';
import { balanceSchema, type BalanceData } from './schemas/balance';
import { terrainSchema, type ProceduralTerrainData } from './schemas/terrain';
import { assertWeaponConsistency, weaponSchema, type WeaponDefinition } from './schemas/weapon';

/**
 * ゲームデータの読み込み口。
 * JSON は Vite が静的に取り込む。ここで検証してから型付きで返すことで、
 * 以降のコードは「データは正しい」前提で書ける。
 */
export function loadBalance(): BalanceData {
  validate(balanceJson, balanceSchema, 'balance');
  return balanceJson as BalanceData;
}

export function loadDevTerrain(): ProceduralTerrainData {
  validate(devTerrainJson, terrainSchema, 'fields/dev_terrain');
  return devTerrainJson as ProceduralTerrainData;
}

export function loadTitanBlade(): WeaponDefinition {
  validate(titanBladeJson, weaponSchema, 'weapons/titan_blade');
  const weapon = titanBladeJson as WeaponDefinition;
  assertWeaponConsistency(weapon);
  return weapon;
}
