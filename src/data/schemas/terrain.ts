import type { Schema } from '../validate';

export interface TerrainHill {
  amplitude: number;
  frequencyX: number;
  frequencyZ: number;
  phase: number;
}

export interface ProceduralTerrainData {
  /** 一辺の長さ（m）。原点中心の正方形。 */
  size: number;
  /** 描画メッシュの分割数。 */
  segments: number;
  /** 原点からこの半径内は平坦（ベースキャンプ用）。 */
  flatRadius: number;
  /** 平坦領域から起伏へ滑らかに遷移させる幅（m）。 */
  flatBlendWidth: number;
  hills: TerrainHill[];
}

export const terrainSchema = {
  size: 'number',
  segments: 'number',
  flatRadius: 'number',
  flatBlendWidth: 'number',
  hills: [
    {
      amplitude: 'number',
      frequencyX: 'number',
      frequencyZ: 'number',
      phase: 'number',
    },
  ],
} as const satisfies Schema;
