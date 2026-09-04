import type { InputState } from '@input/InputState';
import type { PlayerIntent } from '@core/player/PlayerIntent';
import { Vec3 } from '@shared/math/Vec3';

const forward = new Vec3();
const right = new Vec3();

/**
 * 生入力 + カメラ向き → core 向けの PlayerIntent。
 * 「W はカメラの向いている方向」という変換はここだけで行い、core はカメラを知らない。
 */
export function buildPlayerIntent(
  input: InputState,
  cameraForwardXZ: Vec3,
  cameraRightXZ: Vec3,
  out: PlayerIntent,
): PlayerIntent {
  forward.copy(cameraForwardXZ).scale(input.moveY);
  right.copy(cameraRightXZ).scale(input.moveX);
  out.move.copy(forward).add(right);
  if (out.move.lengthSq() > 1) out.move.normalize();

  out.dash = input.dashHeld;
  out.dodge = input.dodgePressed;
  return out;
}
