import type { WorldHitbox } from './PlayerCombat';
import type { Monster } from '@core/monster/Monster';
import type { MonsterPart } from '@core/monster/MonsterPart';
import { contactPoint, sphereToShapeDistance } from './shapes';
import { Vec3 } from '@shared/math/Vec3';

export interface HitCandidate {
  part: MonsterPart;
  /** 表面間距離（負ほど深く重なっている）。 */
  depth: number;
  contact: Vec3;
}

/**
 * 球ヒットボックスがモンスターのどの部位に当たったかを決める。
 * 複数部位に重なる場合は最も深く重なった部位を採用する（1 攻撃 1 部位）。
 * 切断済み部位は存在しないものとして扱う。
 */
export function findHitPart(hitbox: WorldHitbox, monster: Monster, out: HitCandidate): HitCandidate | null {
  let best: MonsterPart | null = null;
  let bestDistance = Infinity;
  let bestIndex = -1;
  const shapes = monster.getWorldShapes();

  for (let i = 0; i < shapes.length; i++) {
    const entry = shapes[i];
    if (!entry || entry.part.isSevered) continue;
    const distance = sphereToShapeDistance(hitbox.center, hitbox.radius, entry.shape);
    if (distance <= 0 && distance < bestDistance) {
      bestDistance = distance;
      best = entry.part;
      bestIndex = i;
    }
  }

  if (!best || bestIndex < 0) return null;
  const shape = shapes[bestIndex];
  if (!shape) return null;
  out.part = best;
  out.depth = bestDistance;
  contactPoint(hitbox.center, shape.shape, out.contact);
  return out;
}
