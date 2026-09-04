import type { LocalOffset } from './AttackData';
import { Vec3 } from '@shared/math/Vec3';

/**
 * 部位のあたり形状。モンスターのローカル座標（+Z 前方）で定義する。
 * 球とカプセルだけに絞ることで、プレイヤー側の球ヒットボックスとの判定を
 * 「線分と点の距離」ひとつに帰着させる。
 */
export interface SphereShapeData {
  type: 'sphere';
  offset: LocalOffset;
  radius: number;
}

export interface CapsuleShapeData {
  type: 'capsule';
  start: LocalOffset;
  end: LocalOffset;
  radius: number;
}

export type ShapeData = SphereShapeData | CapsuleShapeData;

/** ワールド座標へ変換済みの形状。球は a == b のカプセルとして扱う。 */
export interface WorldShape {
  a: Vec3;
  b: Vec3;
  radius: number;
}

export function createWorldShape(): WorldShape {
  return { a: new Vec3(), b: new Vec3(), radius: 0 };
}

function localToWorld(local: LocalOffset, origin: Vec3, sin: number, cos: number, out: Vec3): Vec3 {
  return out.set(origin.x + local.x * cos + local.z * sin, origin.y + local.y, origin.z - local.x * sin + local.z * cos);
}

/** ローカルオフセット（+Z 前方）を、origin/yaw のワールド座標へ変換する。 */
export function transformPoint(local: LocalOffset, origin: Vec3, yaw: number, out: Vec3): Vec3 {
  return localToWorld(local, origin, Math.sin(yaw), Math.cos(yaw), out);
}

/** 球同士の重なり判定。 */
export function spheresOverlap(aCenter: Vec3, aRadius: number, bCenter: Vec3, bRadius: number): boolean {
  const r = aRadius + bRadius;
  return aCenter.distanceToSq(bCenter) <= r * r;
}

export function transformShape(shape: ShapeData, origin: Vec3, yaw: number, out: WorldShape): WorldShape {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  if (shape.type === 'sphere') {
    localToWorld(shape.offset, origin, sin, cos, out.a);
    out.b.copy(out.a);
  } else {
    localToWorld(shape.start, origin, sin, cos, out.a);
    localToWorld(shape.end, origin, sin, cos, out.b);
  }
  out.radius = shape.radius;
  return out;
}

const scratchAB = new Vec3();
const scratchAP = new Vec3();

/** 点 p から線分 ab への最近点を out に入れて返す。 */
export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3, out: Vec3): Vec3 {
  scratchAB.copy(b).sub(a);
  scratchAP.copy(p).sub(a);
  const lengthSq = scratchAB.lengthSq();
  if (lengthSq <= 1e-9) return out.copy(a);
  const t = Math.max(0, Math.min(1, scratchAP.dot(scratchAB) / lengthSq));
  return out.copy(a).addScaled(scratchAB, t);
}

const scratchClosest = new Vec3();

/**
 * 球（center, radius）と形状の表面間距離。負なら重なっている。
 * 「どの部位に一番深く当たったか」を比較するために距離を返す。
 */
export function sphereToShapeDistance(center: Vec3, radius: number, shape: WorldShape): number {
  closestPointOnSegment(center, shape.a, shape.b, scratchClosest);
  return center.distanceTo(scratchClosest) - radius - shape.radius;
}

/** 接触点の近似（球中心から形状の最近点方向へ、形状表面まで進めた点）。 */
export function contactPoint(center: Vec3, shape: WorldShape, out: Vec3): Vec3 {
  closestPointOnSegment(center, shape.a, shape.b, scratchClosest);
  const dir = out.copy(center).sub(scratchClosest);
  const len = dir.length();
  if (len <= 1e-6) return out.copy(scratchClosest);
  return out.copy(scratchClosest).addScaled(dir.scale(1 / len), shape.radius);
}
