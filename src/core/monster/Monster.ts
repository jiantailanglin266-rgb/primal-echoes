import type { MonsterDefinition } from '@data/schemas/monster';
import type { CombatBalance } from '@data/schemas/balance';
import type { DamageResult } from '@core/combat/DamageSystem';
import { createWorldShape, transformShape, type WorldShape } from '@core/combat/shapes';
import { Vec3 } from '@shared/math/Vec3';
import { MonsterStats } from './MonsterStats';
import { MonsterPart, type PartHitOutcome } from './MonsterPart';

export interface MonsterHitOutcome extends PartHitOutcome {
  died: boolean;
  stunned: boolean;
}

/** 部位形状のワールド座標版。HitDetection が参照する。 */
export interface PartWorldShape {
  part: MonsterPart;
  shape: WorldShape;
}

/**
 * 大型モンスター 1 体の集約。位置・向き・Stats・部位を持つ。
 * AI（T08〜T10）はこのクラスの状態を読んで position/yaw を動かす。
 */
export class Monster {
  readonly position = new Vec3();
  readonly previousPosition = new Vec3();
  yaw = 0;
  readonly stats: MonsterStats;
  readonly parts: MonsterPart[];
  private readonly partsById = new Map<string, MonsterPart>();
  private readonly worldShapes: PartWorldShape[];

  constructor(
    readonly id: string,
    readonly def: MonsterDefinition,
    balance: CombatBalance,
  ) {
    this.stats = new MonsterStats(def.stats);
    this.parts = def.parts.map((p) => new MonsterPart(p, balance));
    for (const part of this.parts) this.partsById.set(part.id, part);
    this.worldShapes = this.parts.map((part) => ({ part, shape: createWorldShape() }));
  }

  get isAlive(): boolean {
    return this.stats.isAlive;
  }

  getPart(id: string): MonsterPart {
    const part = this.partsById.get(id);
    if (!part) throw new Error(`[Monster ${this.id}] unknown part "${id}"`);
    return part;
  }

  /** 切断済みでない部位のワールド形状。毎回変換し直す（モンスターは動く）。 */
  getWorldShapes(): readonly PartWorldShape[] {
    for (const entry of this.worldShapes) {
      transformShape(entry.part.def.shape, this.position, this.yaw, entry.shape);
    }
    return this.worldShapes;
  }

  applyHit(partId: string, result: DamageResult, outcome: MonsterHitOutcome): MonsterHitOutcome {
    const part = this.getPart(partId);
    part.applyDamage(result, outcome);
    outcome.died = this.stats.takeDamage(result.total);
    outcome.stunned = !outcome.died && this.stats.accumulateStun(result.stunDamage);
    return outcome;
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw): void {
    this.position.set(x, y, z);
    this.previousPosition.copy(this.position);
    this.yaw = yaw;
  }

  update(dt: number): void {
    this.previousPosition.copy(this.position);
    for (const part of this.parts) part.update(dt);
  }

  /** デバッグ用: 全回復して部位も元に戻す。 */
  reset(): void {
    this.stats.reset();
    for (const part of this.parts) part.reset();
  }
}
