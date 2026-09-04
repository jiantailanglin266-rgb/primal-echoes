import type { MonsterDefinition } from '@data/schemas/monster';
import type { CombatBalance } from '@data/schemas/balance';
import type { DamageResult } from '@core/combat/DamageSystem';
import { createWorldShape, transformShape, type WorldShape } from '@core/combat/shapes';
import type { HeightProvider } from '@core/world/Terrain';
import { rotateTowards } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';
import { MonsterStats } from './MonsterStats';
import { MonsterPart, type PartHitOutcome } from './MonsterPart';
import { MonsterCombat, type MonsterCombatHooks } from './MonsterCombat';

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
 * 大型モンスター 1 体の集約。位置・向き・Stats・部位・攻撃実行を持つ。
 * 「何をするか」の判断は MonsterAI が行い、このクラスは状態と物理的な移動だけを提供する。
 */
export class Monster {
  readonly position = new Vec3();
  readonly previousPosition = new Vec3();
  yaw = 0;
  readonly stats: MonsterStats;
  readonly parts: MonsterPart[];
  readonly combat: MonsterCombat;
  private readonly partsById = new Map<string, MonsterPart>();
  private readonly worldShapes: PartWorldShape[];
  private readonly scratchForward = new Vec3();

  constructor(
    readonly id: string,
    readonly def: MonsterDefinition,
    balance: CombatBalance,
    private readonly terrain: HeightProvider,
    combatHooks: MonsterCombatHooks = { spawnProjectile: () => undefined },
  ) {
    this.stats = new MonsterStats(def.stats);
    this.parts = def.parts.map((p) => new MonsterPart(p, balance));
    for (const part of this.parts) this.partsById.set(part.id, part);
    this.worldShapes = this.parts.map((part) => ({ part, shape: createWorldShape() }));
    this.combat = new MonsterCombat(this, combatHooks);
  }

  get isAlive(): boolean {
    return this.stats.isAlive;
  }

  getPart(id: string): MonsterPart {
    const part = this.partsById.get(id);
    if (!part) throw new Error(`[Monster ${this.id}] unknown part "${id}"`);
    return part;
  }

  getForward(out = new Vec3()): Vec3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
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

    // リアクション: 気絶 > 怯み。部位破壊・切断は必ず怯む（「削り切った」手応えのため）。
    if (outcome.died) {
      this.combat.reset();
    } else if (outcome.stunned) {
      this.combat.interrupt('stunned', this.def.stats.stunDurationSeconds);
    } else if (outcome.flinched || outcome.broke || outcome.severed) {
      this.combat.interrupt('flinch', this.def.combat.flinchSeconds);
    }
    return outcome;
  }

  teleport(x: number, z: number, yaw = this.yaw): void {
    this.position.set(x, this.terrain.getHeight(x, z), z);
    this.previousPosition.copy(this.position);
    this.yaw = yaw;
  }

  moveForward(distance: number): void {
    this.getForward(this.scratchForward);
    this.moveBy(this.scratchForward.x * distance, this.scratchForward.z * distance);
  }

  moveBy(dx: number, dz: number): void {
    this.position.x += dx;
    this.position.z += dz;
    this.position.y = this.terrain.getHeight(this.position.x, this.position.z);
  }

  /** target の方向へ最大 maxDelta ラジアンだけ向き直る。 */
  turnTowards(target: Vec3, maxDelta: number): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    if (dx * dx + dz * dz <= 1e-6) return;
    this.yaw = rotateTowards(this.yaw, Math.atan2(dx, dz), maxDelta);
  }

  /** target へ speed で接近する（向いている方向に関係なく直進）。 */
  moveTowards(target: Vec3, speed: number, dt: number): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= 1e-6) return;
    const step = Math.min(speed * dt, dist);
    this.moveBy((dx / dist) * step, (dz / dist) * step);
  }

  update(dt: number, target: Vec3): void {
    this.previousPosition.copy(this.position);
    for (const part of this.parts) part.update(dt);
    if (this.isAlive) this.combat.update(dt, target);
  }

  /** デバッグ用: 全回復して部位も元に戻す。 */
  reset(): void {
    this.stats.reset();
    for (const part of this.parts) part.reset();
    this.combat.reset();
  }
}
