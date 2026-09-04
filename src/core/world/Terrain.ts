import type { ProceduralTerrainData } from '@data/schemas/terrain';
import { clamp01 } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';

/** 地形の高さを問い合わせるインターフェース。core 層はこれだけに依存する。 */
export interface HeightProvider {
  getHeight(x: number, z: number): number;
}

/**
 * 正弦波の重ね合わせによる手続き地形。
 * 本番地形（高さマップ/メッシュ）が来るまでの開発用だが、
 * HeightProvider 経由で使うので差し替え時にプレイヤー側は変更不要。
 */
export class ProceduralTerrain implements HeightProvider {
  constructor(readonly data: ProceduralTerrainData) {}

  get halfSize(): number {
    return this.data.size / 2;
  }

  getHeight(x: number, z: number): number {
    let h = 0;
    for (const hill of this.data.hills) {
      h += hill.amplitude * Math.sin(x * hill.frequencyX + hill.phase) * Math.cos(z * hill.frequencyZ - hill.phase);
    }
    // 原点付近（ベースキャンプ）を平坦にし、境界で段差が出ないよう滑らかに混ぜる
    const r = Math.sqrt(x * x + z * z);
    const t = clamp01((r - this.data.flatRadius) / Math.max(this.data.flatBlendWidth, 1e-3));
    const blend = t * t * (3 - 2 * t);
    return h * blend;
  }

  /** 有限差分による法線。カメラや設置物の傾き合わせに使う。 */
  getNormal(x: number, z: number, out = new Vec3()): Vec3 {
    const e = 0.25;
    const hx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const hz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  /** フィールド外へ出ないよう位置を内側へ丸める。 */
  clampToBounds(position: Vec3, margin = 1): void {
    const limit = this.halfSize - margin;
    if (position.x > limit) position.x = limit;
    if (position.x < -limit) position.x = -limit;
    if (position.z > limit) position.z = limit;
    if (position.z < -limit) position.z = -limit;
  }
}
