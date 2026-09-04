import type { CreatureDefinition } from '@data/schemas/creature';
import type { Field } from '@core/world/Field';
import type { PreyProvider, PreyTarget } from '@core/monster/MonsterAI';
import type { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import { Carcass } from './Carcass';
import { Creature } from './Creature';

export interface EcosystemThreat {
  position: Vec3;
  /** この距離以内で生物が逃げる。 */
  radius: number;
}

export interface EcosystemUpdateContext {
  player: { position: Vec3; isNoisy: boolean };
  /** 大型モンスターの位置（生きているものだけ）。 */
  monsters: readonly { position: Vec3; isAlive: boolean }[];
}

export interface EcosystemEventSink {
  creatureKilled: (creature: Creature, cause: 'monster' | 'player') => void;
  carcassSpawned: (carcass: Carcass) => void;
}

const CARCASS_CARVES_SMALL = 1;
const CARCASS_CARVES_LARGE = 3;

/**
 * 小型生物と死骸のシミュレーション。
 * - 草食（群れ）: ねぐら周辺をうろつき、プレイヤー/大型モンスターが近づくと逃げる
 * - 腐肉食: 死骸に引き寄せられ、食べ尽くすまで留まる
 * - 大型モンスターは PreyProvider 経由で獲物を探し、仕留めると死骸が生まれる
 * プレイヤーがいなくても回り続けるよう、判断はすべて位置と時間だけで行う。
 */
export class EcosystemManager implements PreyProvider {
  readonly creatures: Creature[] = [];
  readonly carcasses: Carcass[] = [];
  private nextCarcassId = 1;
  private readonly threats: EcosystemThreat[] = [];
  private readonly scratch = new Vec3();
  private readonly scratch2 = new Vec3();

  constructor(
    private readonly field: Field,
    private readonly defs: Map<string, CreatureDefinition>,
    private readonly rng: Random,
    private readonly sink: EcosystemEventSink,
  ) {}

  spawnAll(): void {
    let herdId = 0;
    for (const spawn of this.field.def.creatureSpawns) {
      const def = this.defs.get(spawn.creatureId);
      if (!def) throw new Error(`[Ecosystem] unknown creature "${spawn.creatureId}"`);
      const poi = this.field.getPoi(spawn.poiId);
      for (let g = 0; g < spawn.groups; g++) {
        herdId++;
        // 群れごとに POI 周辺の少し違う場所をねぐらにする
        const homeX = poi.position.x + this.rng.range(-6, 6);
        const homeZ = poi.position.z + this.rng.range(-6, 6);
        for (let i = 0; i < def.herdSize; i++) {
          const creature = new Creature(`${def.id}_${herdId}_${i}`, def, herdId, i);
          creature.home.set(homeX, 0, homeZ);
          const angle = this.rng.range(0, Math.PI * 2);
          const r = i === 0 ? 0 : def.herdSpacing * (0.6 + 0.6 * this.rng.next());
          this.place(creature, homeX + Math.sin(angle) * r, homeZ + Math.cos(angle) * r);
          creature.yaw = this.rng.range(0, Math.PI * 2);
          creature.wanderTarget.copy(creature.position);
          creature.wanderWait = this.rng.range(0, def.wanderIntervalMaxSeconds);
          this.creatures.push(creature);
        }
      }
    }
  }

  // ---- PreyProvider ----

  findPrey(position: Vec3, range: number): PreyTarget | null {
    let best: Creature | null = null;
    let bestDist = range;
    for (const c of this.creatures) {
      if (!c.isAlive || c.def.kind !== 'herbivore') continue;
      const d = c.position.horizontalDistanceTo(position);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  kill(target: PreyTarget): void {
    const creature = this.creatures.find((c) => c === target);
    if (creature && creature.isAlive) this.killCreature(creature, 'monster');
  }

  // ---- public API ----

  killCreature(creature: Creature, cause: 'monster' | 'player'): Carcass {
    creature.state = 'dead';
    creature.hp = 0;
    this.sink.creatureKilled(creature, cause);
    return this.addCarcass(creature.def.id, creature.position, creature.def.carcassMeatSeconds, CARCASS_CARVES_SMALL, false);
  }

  /** 大型モンスターの死骸など。消えない死骸は剥ぎ取り猶予のために残る。 */
  addCarcass(sourceId: string, position: Vec3, meatSeconds: number, carves = CARCASS_CARVES_LARGE, persistent = false): Carcass {
    const carcass = new Carcass(this.nextCarcassId++, sourceId, position, meatSeconds, carves, persistent);
    this.carcasses.push(carcass);
    this.sink.carcassSpawned(carcass);
    return carcass;
  }

  /** プレイヤーの攻撃ダメージを適用。戻り値: 死んだか。 */
  damageCreature(creature: Creature, amount: number): boolean {
    if (!creature.isAlive) return false;
    creature.hp = Math.max(0, creature.hp - amount);
    if (creature.hp === 0) {
      this.killCreature(creature, 'player');
      return true;
    }
    // 攻撃されたら逃げる
    this.startFlee(creature, creature.position);
    return false;
  }

  update(dt: number, ctx: EcosystemUpdateContext): void {
    this.collectThreats(ctx);

    for (const c of this.creatures) {
      if (!c.isAlive) continue;
      c.previousPosition.copy(c.position);
      c.stateElapsed += dt;
      this.updateCreature(c, dt);
    }

    for (let i = this.carcasses.length - 1; i >= 0; i--) {
      const carcass = this.carcasses[i] as Carcass;
      carcass.age += dt;
      if (carcass.isConsumed) this.carcasses.splice(i, 1);
    }
  }

  // ---- internals ----

  private collectThreats(ctx: EcosystemUpdateContext): void {
    this.threats.length = 0;
    this.threats.push({ position: ctx.player.position, radius: ctx.player.isNoisy ? 1 : 0.5 });
    for (const m of ctx.monsters) {
      if (m.isAlive) this.threats.push({ position: m.position, radius: -1 });
    }
  }

  /** 脅威の距離判定。プレイヤーは radius が倍率、モンスターは -1（専用距離）。 */
  private nearestThreat(c: Creature, out: Vec3): boolean {
    let found = false;
    let bestDist = Infinity;
    for (const t of this.threats) {
      const range = t.radius < 0 ? c.def.fleeRangeMonster : c.def.fleeRangePlayer * t.radius;
      const d = c.position.horizontalDistanceTo(t.position);
      if (d <= range && d < bestDist) {
        bestDist = d;
        out.copy(t.position);
        found = true;
      }
    }
    return found;
  }

  private updateCreature(c: Creature, dt: number): void {
    const def = c.def;

    if (c.state !== 'dead' && c.state !== 'flee' && this.nearestThreat(c, this.scratch)) {
      this.startFlee(c, this.scratch);
    }

    switch (c.state) {
      case 'flee':
        this.updateFlee(c, dt);
        break;
      case 'approachCarcass':
        this.updateApproachCarcass(c, dt);
        break;
      case 'feed':
        this.updateFeed(c, dt);
        break;
      case 'graze':
      case 'wander':
        if (def.scavengeAttractRange > 0 && this.tryAttractToCarcass(c)) break;
        this.updateWander(c, dt);
        break;
      case 'dead':
        break;
    }
  }

  private startFlee(c: Creature, from: Vec3): void {
    c.threatPosition.copy(from);
    c.calmRemaining = c.def.calmSeconds;
    c.state = 'flee';
    c.stateElapsed = 0;
    c.targetCarcassId = null;
    // 群れの仲間も一緒に逃げる（先頭が逃げれば全員）
    if (c.herdIndex === 0) {
      for (const other of this.creatures) {
        if (other !== c && other.herdId === c.herdId && other.isAlive && other.state !== 'flee') {
          other.threatPosition.copy(from);
          other.calmRemaining = other.def.calmSeconds;
          other.state = 'flee';
          other.stateElapsed = 0;
        }
      }
    }
  }

  private updateFlee(c: Creature, dt: number): void {
    // 脅威が近くにいる限り脅威位置を更新し、離れたら calm カウントダウン
    if (this.nearestThreat(c, this.scratch)) {
      c.threatPosition.copy(this.scratch);
      c.calmRemaining = c.def.calmSeconds;
    } else {
      c.calmRemaining -= dt;
      if (c.calmRemaining <= 0) {
        c.state = 'wander';
        c.stateElapsed = 0;
        c.wanderTarget.copy(c.position);
        c.wanderWait = 0;
        return;
      }
    }
    const away = this.scratch2.copy(c.position).sub(c.threatPosition);
    away.y = 0;
    if (away.lengthSq() < 1e-4) away.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    away.normalize();
    c.yaw = Math.atan2(away.x, away.z);
    this.moveBy(c, away.x * c.def.runSpeed * dt, away.z * c.def.runSpeed * dt);
  }

  private updateWander(c: Creature, dt: number): void {
    const def = c.def;
    const leader = c.herdIndex === 0 ? null : this.creatures.find((o) => o.herdId === c.herdId && o.isAlive);
    // 追従: 先頭以外は先頭の近くを目標にする
    if (leader && leader !== c) {
      const d = c.position.horizontalDistanceTo(leader.position);
      if (d > def.herdSpacing * 2) {
        this.moveTowards(c, leader.position, def.walkSpeed * 1.3, dt, def.herdSpacing);
        c.state = 'wander';
        return;
      }
    }

    c.wanderWait -= dt;
    const distToTarget = c.position.horizontalDistanceTo(c.wanderTarget);
    if (distToTarget <= 0.5) {
      c.state = 'graze';
      if (c.wanderWait <= 0) {
        const center = leader && leader !== c ? leader.position : c.home;
        const angle = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(1, def.wanderRadius);
        c.wanderTarget.set(center.x + Math.sin(angle) * r, 0, center.z + Math.cos(angle) * r);
        c.wanderWait = this.rng.range(def.wanderIntervalMinSeconds, def.wanderIntervalMaxSeconds);
      }
      return;
    }
    c.state = 'wander';
    this.moveTowards(c, c.wanderTarget, def.walkSpeed, dt, 0);
  }

  private tryAttractToCarcass(c: Creature): boolean {
    let best: Carcass | null = null;
    let bestDist = c.def.scavengeAttractRange;
    for (const carcass of this.carcasses) {
      if (carcass.meatSeconds <= 0) continue;
      const d = c.position.horizontalDistanceTo(carcass.position);
      if (d < bestDist) {
        bestDist = d;
        best = carcass;
      }
    }
    if (!best) return false;
    c.targetCarcassId = best.id;
    c.state = 'approachCarcass';
    c.stateElapsed = 0;
    return true;
  }

  private updateApproachCarcass(c: Creature, dt: number): void {
    const carcass = this.carcasses.find((k) => k.id === c.targetCarcassId);
    if (!carcass || carcass.meatSeconds <= 0) {
      c.state = 'wander';
      c.targetCarcassId = null;
      return;
    }
    const d = c.position.horizontalDistanceTo(carcass.position);
    if (d <= c.def.bodyRadius + 1.2) {
      c.state = 'feed';
      c.stateElapsed = 0;
      c.feedRemaining = c.def.scavengeFeedSeconds;
      return;
    }
    this.moveTowards(c, carcass.position, c.def.runSpeed * 0.7, dt, c.def.bodyRadius);
  }

  private updateFeed(c: Creature, dt: number): void {
    const carcass = this.carcasses.find((k) => k.id === c.targetCarcassId);
    if (!carcass || carcass.meatSeconds <= 0) {
      c.state = 'wander';
      c.targetCarcassId = null;
      return;
    }
    carcass.feed(dt);
    c.feedRemaining -= dt;
    if (c.feedRemaining <= 0) {
      c.state = 'wander';
      c.targetCarcassId = null;
      c.wanderTarget.copy(c.position);
    }
  }

  private moveTowards(c: Creature, target: Vec3, speed: number, dt: number, stopDistance: number): void {
    const dx = target.x - c.position.x;
    const dz = target.z - c.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= stopDistance + 1e-3) return;
    c.yaw = Math.atan2(dx, dz);
    const step = Math.min(speed * dt, dist - stopDistance);
    this.moveBy(c, (dx / dist) * step, (dz / dist) * step);
  }

  private moveBy(c: Creature, dx: number, dz: number): void {
    this.place(c, c.position.x + dx, c.position.z + dz);
  }

  private place(c: Creature, x: number, z: number): void {
    c.position.set(x, 0, z);
    this.field.terrain.clampToBounds(c.position, c.def.bodyRadius + 1);
    c.position.y = this.field.terrain.getHeight(c.position.x, c.position.z);
  }
}
