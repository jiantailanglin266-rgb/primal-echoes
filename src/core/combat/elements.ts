/** 属性の種類。'none' は無属性武器。 */
export const ELEMENT_TYPES = ['none', 'fire', 'water', 'thunder', 'ice', 'aether'] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** 部位ごとの耐性（肉質）。値は「通るダメージの割合」。1.0 で素通し、0.3 で 30%。 */
export interface HitZoneModifiers {
  slash: number;
  impact: number;
  projectile: number;
  fire: number;
  water: number;
  thunder: number;
  ice: number;
  aether: number;
}
