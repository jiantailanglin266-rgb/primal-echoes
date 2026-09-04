import type { PhysicalDamageType } from './AttackData';
import type { ElementType, HitZoneModifiers } from './elements';

/**
 * ダメージ計算の唯一の実装。
 *
 *   Physical = WeaponPower × MotionValue × HitZone(物理種別) × Sharpness × Crit × その他倍率
 *   Element  = ElementPower × ElementMotionValue × HitZone(属性) × SharpnessElem × その他倍率
 *   Total    = round(Physical + Element)（最低 minimumDamage）
 *
 * 乱数は外から渡す（roll）ので、この関数は純粋関数としてテストできる。
 */
export interface DamageInput {
  weaponPower: number;
  motionValue: number;
  /** チャージ段階などによる追加倍率。 */
  motionValueMultiplier: number;
  damageType: PhysicalDamageType;
  elementType: ElementType;
  elementPower: number;
  elementMotionValue: number;
  sharpnessPhysicalModifier: number;
  sharpnessElementModifier: number;
  critRate: number;
  critMultiplier: number;
  /** 部位の肉質。 */
  hitZone: HitZoneModifiers;
  /** 攻撃側の部位ダメージ倍率（攻撃データ × チャージ段階）。 */
  partDamageMultiplier: number;
  stunDamage: number;
  /** 部位側の気絶蓄積倍率（頭部 1.0、他 0）。 */
  stunMultiplier: number;
  flinchDamage: number;
  minimumDamage: number;
}

export interface DamageResult {
  physical: number;
  element: number;
  total: number;
  partDamage: number;
  stunDamage: number;
  flinchDamage: number;
  isCritical: boolean;
  damageType: PhysicalDamageType;
}

export function createDamageResult(): DamageResult {
  return {
    physical: 0,
    element: 0,
    total: 0,
    partDamage: 0,
    stunDamage: 0,
    flinchDamage: 0,
    isCritical: false,
    damageType: 'slash',
  };
}

export function computeDamage(input: DamageInput, roll: number, out: DamageResult = createDamageResult()): DamageResult {
  const isCritical = roll < input.critRate;
  const critModifier = isCritical ? input.critMultiplier : 1;

  const physical =
    input.weaponPower *
    input.motionValue *
    input.motionValueMultiplier *
    input.hitZone[input.damageType] *
    input.sharpnessPhysicalModifier *
    critModifier;

  let element = 0;
  if (input.elementType !== 'none' && input.elementPower > 0) {
    element =
      input.elementPower *
      input.elementMotionValue *
      input.hitZone[input.elementType] *
      input.sharpnessElementModifier;
  }

  const total = Math.max(input.minimumDamage, Math.round(physical + element));

  out.physical = physical;
  out.element = element;
  out.total = total;
  // 部位ダメージは総ダメージ基準（属性でも部位は削れる）に攻撃側倍率を掛ける
  out.partDamage = total * input.partDamageMultiplier;
  out.stunDamage = input.stunDamage * input.stunMultiplier;
  out.flinchDamage = input.flinchDamage;
  out.isCritical = isCritical;
  out.damageType = input.damageType;
  return out;
}
