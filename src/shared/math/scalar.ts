/** スカラー演算ユーティリティ。ゲーム全体で共通に使う。 */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/**
 * 角度を [-PI, PI) に正規化する。
 * 向きの補間で 359° -> 1° が逆回りしないようにするため。
 */
export function wrapAngle(radians: number): number {
  const twoPi = Math.PI * 2;
  let a = radians % twoPi;
  if (a >= Math.PI) a -= twoPi;
  if (a < -Math.PI) a += twoPi;
  return a;
}

/** 現在角度から目標角度へ最大 maxDelta だけ回転させる（モンスターの旋回速度制限に使う） */
export function rotateTowards(current: number, target: number, maxDelta: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
