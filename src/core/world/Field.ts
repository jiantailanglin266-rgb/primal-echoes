import type { FieldArea, FieldDefinition, PoiKind, PointOfInterest } from '@data/schemas/field';
import { Vec3 } from '@shared/math/Vec3';
import { ProceduralTerrain } from './Terrain';

/** POI のワールド座標（地形の高さ込み）。 */
export interface FieldPoi {
  def: PointOfInterest;
  position: Vec3;
}

/**
 * フィールド 1 面。地形・エリア・注目点（巣/水場/餌場/巡回点）を提供する。
 * モンスターの生態 AI はここから「次に行く場所」を引く。
 */
export class Field {
  readonly terrain: ProceduralTerrain;
  readonly pois: FieldPoi[];
  private readonly poisById = new Map<string, FieldPoi>();

  constructor(readonly def: FieldDefinition) {
    this.terrain = new ProceduralTerrain(def.terrain);
    this.pois = def.pointsOfInterest.map((p) => ({
      def: p,
      position: new Vec3(p.position.x, this.terrain.getHeight(p.position.x, p.position.z), p.position.z),
    }));
    for (const poi of this.pois) this.poisById.set(poi.def.id, poi);
  }

  getPoi(id: string): FieldPoi {
    const poi = this.poisById.get(id);
    if (!poi) throw new Error(`[Field ${this.def.id}] unknown poi "${id}"`);
    return poi;
  }

  poisOfKind(kind: PoiKind): FieldPoi[] {
    return this.pois.filter((p) => p.def.kind === kind);
  }

  nearestPoi(kind: PoiKind, from: Vec3): FieldPoi | null {
    let best: FieldPoi | null = null;
    let bestDist = Infinity;
    for (const poi of this.pois) {
      if (poi.def.kind !== kind) continue;
      const d = poi.position.horizontalDistanceTo(from);
      if (d < bestDist) {
        bestDist = d;
        best = poi;
      }
    }
    return best;
  }

  /** 位置が属するエリア。重なる場合は中心に近い方。どこにも属さなければ null。 */
  areaAt(position: Vec3): FieldArea | null {
    let best: FieldArea | null = null;
    let bestRatio = Infinity;
    for (const area of this.def.areas) {
      const dx = position.x - area.center.x;
      const dz = position.z - area.center.z;
      const ratio = Math.sqrt(dx * dx + dz * dz) / area.radius;
      if (ratio <= 1 && ratio < bestRatio) {
        bestRatio = ratio;
        best = area;
      }
    }
    return best;
  }
}
