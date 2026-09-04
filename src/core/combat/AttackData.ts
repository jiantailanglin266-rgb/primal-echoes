/**
 * 攻撃 1 つ分の定義。武器 JSON から読み込まれ、PlayerCombat / MonsterCombat の両方で使う。
 * 数値はすべてデータ側で決め、コードは「タイムラインをどう解釈するか」だけを持つ。
 */
export const PHYSICAL_DAMAGE_TYPES = ['slash', 'impact', 'projectile'] as const;
export type PhysicalDamageType = (typeof PHYSICAL_DAMAGE_TYPES)[number];

export interface LocalOffset {
  x: number;
  y: number;
  z: number;
}

/** 攻撃者のローカル座標（+Z 前方、+Y 上）で定義する球ヒットボックス。 */
export interface SphereHitbox {
  offset: LocalOffset;
  radius: number;
}

export interface AttackData {
  id: string;
  name: string;
  damageType: PhysicalDamageType;
  /** 武器倍率に掛けるモーション値（1.0 = 武器攻撃力そのまま）。 */
  motionValue: number;
  elementMotionValue: number;
  startupSeconds: number;
  activeSeconds: number;
  recoverySeconds: number;
  staminaCost: number;
  /** 部位耐久へ与えるダメージの倍率。 */
  partDamageMultiplier: number;
  /** 頭部などへの気絶蓄積値。 */
  stunDamage: number;
  /** 怯み蓄積値。 */
  flinchDamage: number;
  hitStopSeconds: number;
  /** startup 中に前進する距離（踏み込み）。 */
  forwardStep: number;
  /** 攻撃開始からこの秒数以降、次の攻撃へ派生できる。 */
  chainFromSeconds: number;
  /** 攻撃開始からこの秒数以降、回避でキャンセルできる。 */
  dodgeCancelFromSeconds: number;
  hitboxes: SphereHitbox[];
}

export type AttackPhase = 'startup' | 'active' | 'recovery';

export function attackTotalSeconds(attack: AttackData): number {
  return attack.startupSeconds + attack.activeSeconds + attack.recoverySeconds;
}

export interface PhaseInfo {
  phase: AttackPhase | 'done';
  /** 現在フェーズ内の進捗 0〜1。 */
  progress: number;
}

export function attackPhaseAt(attack: AttackData, elapsed: number, out: PhaseInfo): PhaseInfo {
  if (elapsed < attack.startupSeconds) {
    out.phase = 'startup';
    out.progress = safeRatio(elapsed, attack.startupSeconds);
    return out;
  }
  const afterStartup = elapsed - attack.startupSeconds;
  if (afterStartup < attack.activeSeconds) {
    out.phase = 'active';
    out.progress = safeRatio(afterStartup, attack.activeSeconds);
    return out;
  }
  const afterActive = afterStartup - attack.activeSeconds;
  if (afterActive < attack.recoverySeconds) {
    out.phase = 'recovery';
    out.progress = safeRatio(afterActive, attack.recoverySeconds);
    return out;
  }
  out.phase = 'done';
  out.progress = 1;
  return out;
}

function safeRatio(a: number, b: number): number {
  return b <= 0 ? 1 : Math.min(a / b, 1);
}
