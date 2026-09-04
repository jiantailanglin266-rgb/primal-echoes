import type { MonsterAttackDefinition } from '@data/schemas/monster';
import type { PoiKind } from '@data/schemas/field';
import type { Field } from '@core/world/Field';
import type { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import type { Monster } from './Monster';
import { MonsterNeeds, type NeedsActivity } from './MonsterNeeds';
import { MonsterPerception, type PerceptionSubject } from './MonsterPerception';

export type MonsterAIState =
  | 'idle'
  | 'travel'
  | 'hunt'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'alert'
  | 'combat'
  | 'investigate'
  | 'flee'
  | 'dead';

/** 生態系の状態（プレイヤーを意識していない）。 */
const ECOLOGY_STATES: ReadonlySet<MonsterAIState> = new Set(['idle', 'travel', 'hunt', 'eat', 'drink', 'sleep']);

/** 獲物（小型草食生物）。生態系側が実装する。 */
export interface PreyTarget {
  readonly position: Vec3;
  readonly isAlive: boolean;
}

export interface PreyProvider {
  findPrey(position: Vec3, range: number): PreyTarget | null;
  kill(target: PreyTarget): void;
}

export interface MonsterAIContext {
  field: Field;
  subject: PerceptionSubject;
  prey?: PreyProvider;
  /** 天候。雨なら巣（洞窟）へ避難し、知覚が鈍る。 */
  weather?: { isRaining: boolean; senseMultiplier: number };
}

export interface MonsterAIStateChange {
  from: MonsterAIState;
  to: MonsterAIState;
}

/**
 * モンスター AI。生態層（欲求で動く）と戦闘層（プレイヤーへ反応する）の 2 層。
 *
 *   生態: idle -> travel(目的地) -> [hunt(獲物追跡)] -> eat / drink / sleep -> idle ...
 *   発見: (生態中) -> alert -> combat
 *   見失い: combat -> investigate(最後に見た場所) -> 生態へ戻る
 *   瀕死: combat -> flee(巣へ) -> sleep（回復）-> 起こされれば combat
 *
 * 「プレイヤーがいなくても動いている」ことが目的なので、
 * 生態層はプレイヤーの位置を一切参照しない（知覚だけが橋渡し）。
 */
export class MonsterAI {
  state: MonsterAIState = 'idle';
  stateElapsed = 0;
  /** デバッグ用: true で判断を止める（攻撃も移動もしない）。 */
  paused = false;
  lastChosenAttackId: string | null = null;
  readonly needs: MonsterNeeds;
  readonly perception: MonsterPerception;
  /** 現在の目的地（travel / flee / investigate）。デバッグ表示用。 */
  readonly goal = new Vec3();
  goalLabel = '';

  private travelThen: MonsterAIState = 'idle';
  private waitRemaining = 0;
  private restRemaining = 0;
  private hasFled = false;
  private wakeRequested = false;
  private prey: PreyTarget | null = null;
  private intervalRemaining: number;
  private readonly candidates: MonsterAttackDefinition[] = [];
  private readonly stateChange: MonsterAIStateChange = { from: 'idle', to: 'idle' };
  private pendingChange: MonsterAIStateChange | null = null;

  constructor(
    private readonly monster: Monster,
    private readonly rng: Random,
  ) {
    this.needs = new MonsterNeeds(monster.def.behavior.needs);
    this.perception = new MonsterPerception(monster.def.behavior.perception);
    this.intervalRemaining = this.rollInterval();
  }

  get isInEcology(): boolean {
    return ECOLOGY_STATES.has(this.state);
  }

  get isAsleep(): boolean {
    return this.state === 'sleep';
  }

  /** 攻撃を受けた通知。眠っていれば起き、生態中なら即座に戦闘へ。 */
  notifyAttacked(attackerPosition: Vec3): void {
    if (this.state === 'dead') return;
    this.perception.forceDetect(attackerPosition);
    if (this.state === 'sleep') this.wakeRequested = true;
    if (this.isInEcology || this.state === 'investigate') {
      this.transition('combat');
    }
  }

  /** 戻り値: このステップで状態遷移があればその内容。 */
  update(dt: number, ctx: MonsterAIContext): MonsterAIStateChange | null {
    this.pendingChange = null;
    const m = this.monster;
    if (!m.isAlive) {
      if (this.state !== 'dead') this.transition('dead');
      return this.pendingChange;
    }
    if (this.paused) return null;

    this.stateElapsed += dt;
    this.needs.update(dt, this.activityFor(this.state));
    const seesTarget = this.perception.update(dt, m, ctx.subject, this.isAsleep, ctx.weather?.senseMultiplier ?? 1);

    // 生態中に見つけたら警戒へ。睡眠中は「起こされた」か鋭い知覚でのみ。
    if (this.isInEcology && (seesTarget || this.wakeRequested)) {
      this.wakeRequested = false;
      this.transition('alert');
    }

    switch (this.state) {
      case 'idle':
        this.updateIdle(dt, ctx);
        break;
      case 'travel':
        this.updateTravel(dt, ctx);
        break;
      case 'hunt':
        this.updateHunt(dt, ctx);
        break;
      case 'eat':
      case 'drink':
      case 'sleep':
        this.updateRest(dt);
        break;
      case 'alert':
        this.updateAlert(dt, ctx);
        break;
      case 'combat':
        this.updateCombat(dt, ctx, seesTarget);
        break;
      case 'investigate':
        this.updateInvestigate(dt, ctx, seesTarget);
        break;
      case 'flee':
        this.updateFlee(dt);
        break;
      case 'dead':
        break;
    }
    return this.pendingChange;
  }

  reset(): void {
    this.state = 'idle';
    this.stateElapsed = 0;
    this.needs.reset();
    this.perception.forget();
    this.hasFled = false;
    this.wakeRequested = false;
    this.waitRemaining = 0;
    this.restRemaining = 0;
    this.prey = null;
  }

  // ---------------- ecology ----------------

  private updateIdle(dt: number, ctx: MonsterAIContext): void {
    this.waitRemaining -= dt;
    // 雨宿り中は雨が止むまで巣に留まる（欲求が強ければ出ていく）
    if (ctx.weather?.isRaining && this.isAtShelter(ctx) && !this.needs.wantsToEat && !this.needs.wantsToDrink) {
      this.goalLabel = 'shelter';
      return;
    }
    if (this.waitRemaining > 0) return;
    this.decideNextEcology(ctx);
  }

  private isAtShelter(ctx: MonsterAIContext): boolean {
    const nest = ctx.field.nearestPoi('nest', this.monster.position);
    return nest !== null && this.monster.position.horizontalDistanceTo(nest.position) <= this.monster.def.behavior.arriveDistance * 2;
  }

  /** 欲求の優先順: 疲労回復のための食事 > 空腹 > 渇き > 眠気 > 雨宿り > 巡回。 */
  private decideNextEcology(ctx: MonsterAIContext): void {
    const m = this.monster;
    if (m.condition.isExhausted || this.needs.wantsToEat) {
      if (this.travelToPoi(ctx, 'feeding', 'eat')) return;
    }
    if (this.needs.wantsToDrink) {
      if (this.travelToPoi(ctx, 'water', 'drink')) return;
    }
    if (this.needs.wantsToSleep) {
      if (this.travelToPoi(ctx, 'nest', 'sleep')) return;
    }
    if (ctx.weather?.isRaining) {
      // 雨: 洞窟の巣へ避難して待つ
      if (this.travelToPoi(ctx, 'nest', 'idle')) {
        this.goalLabel = 'shelter';
        return;
      }
    }
    const patrols = ctx.field.poisOfKind('patrol');
    const pick = this.rng.pick(patrols.filter((p) => p.position.horizontalDistanceTo(m.position) > m.def.behavior.arriveDistance));
    if (pick) {
      this.setGoal(pick.position, pick.def.id, 'idle');
      this.transition('travel');
      return;
    }
    this.waitRemaining = this.rollPatrolWait();
  }

  private travelToPoi(ctx: MonsterAIContext, kind: PoiKind, then: MonsterAIState): boolean {
    const poi = ctx.field.nearestPoi(kind, this.monster.position);
    if (!poi) return false;
    this.setGoal(poi.position, poi.def.id, then);
    if (this.isAtGoal()) {
      this.arriveAtGoal(ctx);
    } else {
      this.transition('travel');
    }
    return true;
  }

  private updateTravel(dt: number, ctx: MonsterAIContext): void {
    if (this.isAtGoal()) {
      this.arriveAtGoal(ctx);
      return;
    }
    this.moveAlongGoal(dt, this.travelSpeed());
  }

  /** 目的地到着。餌場なら獲物を探し、いれば狩りへ。 */
  private arriveAtGoal(ctx: MonsterAIContext): void {
    if (this.travelThen === 'idle') {
      this.waitRemaining = this.rollPatrolWait();
      this.transition('idle');
      return;
    }
    if (this.travelThen === 'eat' && ctx.prey) {
      const prey = ctx.prey.findPrey(this.monster.position, this.monster.def.behavior.hunt.range);
      if (prey) {
        this.prey = prey;
        this.goalLabel = 'prey';
        this.transition('hunt');
        return;
      }
    }
    this.beginRest(this.travelThen);
  }

  private updateHunt(dt: number, ctx: MonsterAIContext): void {
    const m = this.monster;
    const hunt = m.def.behavior.hunt;
    const prey = this.prey;
    if (!prey || !prey.isAlive || !ctx.prey || this.stateElapsed > hunt.maxSeconds) {
      // 逃げられた / 獲物がいない: その場の植生を食べる
      this.prey = null;
      this.beginRest('eat');
      return;
    }
    this.goal.copy(prey.position);
    if (m.position.horizontalDistanceTo(prey.position) <= hunt.catchDistance) {
      ctx.prey.kill(prey);
      this.prey = null;
      this.beginRest('eat');
      return;
    }
    m.turnTowards(prey.position, m.def.stats.turnSpeedRadPerSecond * 1.5 * dt);
    if (m.combat.relativeAngleTo(prey.position) < 1.0) {
      m.moveTowards(prey.position, m.def.stats.runSpeed * m.condition.speedMultiplier, dt);
    }
  }

  private beginRest(kind: MonsterAIState): void {
    const n = this.monster.def.behavior.needs;
    this.restRemaining = kind === 'eat' ? n.eatSeconds : kind === 'drink' ? n.drinkSeconds : n.sleepSeconds;
    this.transition(kind);
  }

  private updateRest(dt: number): void {
    const m = this.monster;
    const n = m.def.behavior.needs;
    this.restRemaining -= dt;

    if (this.state === 'eat') {
      // 食事は内部スタミナを戻す = 疲労状態からの復帰手段
      m.stats.stamina = Math.min(m.stats.maxStamina, m.stats.stamina + (n.eatRestoresStamina / n.eatSeconds) * dt);
    } else if (this.state === 'sleep') {
      m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + m.stats.maxHp * n.sleepHpRegenRatioPerSecond * dt);
    }

    if (this.restRemaining <= 0) {
      this.waitRemaining = this.rollPatrolWait() * 0.5;
      this.transition('idle');
    }
  }

  // ---------------- reaction ----------------

  private updateAlert(dt: number, ctx: MonsterAIContext): void {
    const m = this.monster;
    m.turnTowards(ctx.subject.position, m.def.stats.turnSpeedRadPerSecond * 1.5 * dt);
    if (this.stateElapsed >= m.def.behavior.alertSeconds) this.transition('combat');
  }

  private updateCombat(dt: number, ctx: MonsterAIContext, seesTarget: boolean): void {
    const m = this.monster;
    if (m.combat.isBusy) return;

    if (!seesTarget) {
      this.setGoal(this.perception.lastKnownPosition, 'last seen', 'idle');
      this.transition('investigate');
      return;
    }

    if (!this.hasFled && m.stats.hpRatio <= m.def.behavior.fleeHpRatio) {
      const nest = ctx.field.nearestPoi('nest', m.position);
      if (nest) {
        this.hasFled = true;
        this.setGoal(nest.position, nest.def.id, 'sleep');
        this.transition('flee');
        return;
      }
    }

    const target = ctx.subject.position;
    const distance = m.position.horizontalDistanceTo(target);
    const relativeAngle = m.combat.relativeAngleTo(target);
    this.intervalRemaining -= dt;

    if (this.intervalRemaining <= 0) {
      const chosen = this.chooseAttack(distance, relativeAngle);
      if (chosen) {
        this.lastChosenAttackId = chosen.id;
        m.combat.startAttack(chosen, target);
        this.intervalRemaining = this.rollInterval();
        return;
      }
    }

    // 攻撃できないときは位置取り: 正面へ向き、遠ければ詰める
    const speedMul = m.condition.speedMultiplier;
    m.turnTowards(target, m.def.stats.turnSpeedRadPerSecond * speedMul * dt);
    if (distance > m.def.combat.approachStopDistance) {
      const band = m.combat.rangeBandFor(distance);
      const speed = (band === 'far' ? m.def.stats.runSpeed : m.def.stats.walkSpeed) * speedMul;
      if (relativeAngle < 0.6) m.moveTowards(target, speed, dt);
    }
  }

  private updateInvestigate(dt: number, ctx: MonsterAIContext, seesTarget: boolean): void {
    const m = this.monster;
    if (seesTarget) {
      this.transition('combat');
      return;
    }
    if (!this.isAtGoal()) {
      this.moveAlongGoal(dt, m.def.stats.walkSpeed * m.condition.speedMultiplier);
      return;
    }
    if (this.stateElapsed >= m.def.behavior.investigateSeconds) {
      this.perception.forget();
      this.decideNextEcology(ctx);
      if (this.state === 'investigate') {
        this.waitRemaining = this.rollPatrolWait();
        this.transition('idle');
      }
    }
  }

  private updateFlee(dt: number): void {
    const m = this.monster;
    if (m.combat.isBusy) return;
    if (this.isAtGoal()) {
      this.perception.forget();
      this.restRemaining = m.def.behavior.fleeSleepSeconds;
      this.transition('sleep');
      return;
    }
    this.moveAlongGoal(dt, m.def.stats.runSpeed * m.condition.speedMultiplier);
  }

  // ---------------- helpers ----------------

  private setGoal(position: Vec3, label: string, then: MonsterAIState): void {
    this.goal.copy(position);
    this.goalLabel = label;
    this.travelThen = then;
  }

  private isAtGoal(): boolean {
    return this.monster.position.horizontalDistanceTo(this.goal) <= this.monster.def.behavior.arriveDistance;
  }

  private moveAlongGoal(dt: number, speed: number): void {
    const m = this.monster;
    m.turnTowards(this.goal, m.def.stats.turnSpeedRadPerSecond * dt);
    // 目的地の方を向いてから歩き出す（旋回中に横滑りしない）
    if (m.combat.relativeAngleTo(this.goal) < 0.8) m.moveTowards(this.goal, speed, dt);
  }

  private travelSpeed(): number {
    const m = this.monster;
    // 空腹・渇きが強いほど急ぐ
    const urgent = this.needs.hunger >= 90 || this.needs.thirst >= 90;
    return (urgent ? m.def.stats.runSpeed * 0.6 : m.def.stats.walkSpeed) * m.condition.speedMultiplier;
  }

  private activityFor(state: MonsterAIState): NeedsActivity {
    switch (state) {
      case 'eat':
      case 'drink':
      case 'sleep':
        return state;
      case 'combat':
      case 'alert':
      case 'flee':
      case 'hunt':
        return 'combat';
      default:
        return 'normal';
    }
  }

  private transition(to: MonsterAIState): void {
    if (this.state === to) return;
    this.stateChange.from = this.state;
    this.stateChange.to = to;
    this.pendingChange = this.stateChange;
    this.state = to;
    this.stateElapsed = 0;
    if (to === 'combat') this.intervalRemaining = Math.min(this.intervalRemaining, this.rollInterval());
  }

  private chooseAttack(distance: number, relativeAngle: number): MonsterAttackDefinition | null {
    const m = this.monster;
    this.candidates.length = 0;
    let totalWeight = 0;
    for (const attack of m.def.attacks) {
      if (m.condition.isAttackDisabled(attack.id)) continue;
      if (!m.combat.canUse(attack, distance, relativeAngle)) continue;
      this.candidates.push(attack);
      totalWeight += attack.weight;
    }
    if (this.candidates.length === 0) return null;
    let roll = this.rng.next() * totalWeight;
    for (const attack of this.candidates) {
      roll -= attack.weight;
      if (roll <= 0) return attack;
    }
    return this.candidates[this.candidates.length - 1] ?? null;
  }

  private rollInterval(): number {
    const c = this.monster.def.combat;
    return this.rng.range(c.attackIntervalMinSeconds, c.attackIntervalMaxSeconds) * this.monster.condition.attackIntervalMultiplier;
  }

  private rollPatrolWait(): number {
    const b = this.monster.def.behavior;
    return this.rng.range(b.patrolWaitMinSeconds, b.patrolWaitMaxSeconds);
  }
}
