import { oneOf, type Schema } from '../validate';
import { terrainSchema, type ProceduralTerrainData } from './terrain';

export const POI_KINDS = ['nest', 'water', 'feeding', 'patrol'] as const;
export type PoiKind = (typeof POI_KINDS)[number];

export interface FieldPoint {
  x: number;
  z: number;
}

export interface FieldArea {
  id: string;
  name: string;
  center: FieldPoint;
  radius: number;
}

export interface PointOfInterest {
  id: string;
  kind: PoiKind;
  areaId: string;
  position: FieldPoint;
}

export interface MonsterSpawn {
  monsterId: string;
  poiId: string;
  yaw: number;
}

export interface CreatureSpawn {
  creatureId: string;
  poiId: string;
  /** 群れの数（群れの頭数は生物定義側）。 */
  groups: number;
}

export interface FieldDefinition {
  id: string;
  name: string;
  terrain: ProceduralTerrainData;
  playerSpawn: { x: number; z: number; yaw: number };
  areas: FieldArea[];
  pointsOfInterest: PointOfInterest[];
  monsterSpawns: MonsterSpawn[];
  creatureSpawns: CreatureSpawn[];
}

const pointSchema = { x: 'number', z: 'number' } as const satisfies Schema;

export const fieldSchema = {
  id: 'string',
  name: 'string',
  terrain: terrainSchema,
  playerSpawn: { x: 'number', z: 'number', yaw: 'number' },
  areas: [{ id: 'string', name: 'string', center: pointSchema, radius: 'number' }],
  pointsOfInterest: [{ id: 'string', kind: oneOf(POI_KINDS), areaId: 'string', position: pointSchema }],
  monsterSpawns: [{ monsterId: 'string', poiId: 'string', yaw: 'number' }],
  creatureSpawns: [{ creatureId: 'string', poiId: 'string', groups: 'number' }],
} as const satisfies Schema;

export function assertFieldConsistency(field: FieldDefinition): void {
  const areaIds = new Set(field.areas.map((a) => a.id));
  const poiIds = new Set<string>();
  for (const poi of field.pointsOfInterest) {
    if (poiIds.has(poi.id)) throw new Error(`[field ${field.id}] duplicate poi id "${poi.id}"`);
    poiIds.add(poi.id);
    if (!areaIds.has(poi.areaId)) throw new Error(`[field ${field.id}] poi ${poi.id} references unknown area "${poi.areaId}"`);
  }
  for (const spawn of field.monsterSpawns) {
    if (!poiIds.has(spawn.poiId)) throw new Error(`[field ${field.id}] monster spawn references unknown poi "${spawn.poiId}"`);
  }
  for (const spawn of field.creatureSpawns) {
    if (!poiIds.has(spawn.poiId)) throw new Error(`[field ${field.id}] creature spawn references unknown poi "${spawn.poiId}"`);
    if (spawn.groups <= 0) throw new Error(`[field ${field.id}] creature spawn ${spawn.creatureId} needs groups > 0`);
  }
  for (const kind of ['nest', 'water', 'feeding'] as const) {
    if (!field.pointsOfInterest.some((p) => p.kind === kind)) {
      throw new Error(`[field ${field.id}] at least one "${kind}" point of interest is required for monster ecology`);
    }
  }
  const half = field.terrain.size / 2;
  for (const poi of field.pointsOfInterest) {
    if (Math.abs(poi.position.x) > half || Math.abs(poi.position.z) > half) {
      throw new Error(`[field ${field.id}] poi ${poi.id} is outside the terrain`);
    }
  }
}
