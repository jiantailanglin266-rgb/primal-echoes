import type { MonsterAttackDefinition, RangeBand } from '@data/schemas/monster';
import { transformPoint } from '@core/combat/shapes';
import { wrapAngle } from '@shared/math/scalar';
import { Vec3 } from '@shared/math/Vec3';
import type { Monster } from './Monster';

export type MonsterCombatState = 'idle' | 'attacking' | 'flinch' | 'stunned' | 'toppled';
export type MonsterAttackPhase = 'telegraph' | 'startup' | 'active' | 'recovery';

export interface MonsterActiveAttack {
  def: MonsterAttackDefinition;
  instanceId: number;
  elapsed: number;
  hasHitPlayer: boolean;
  /** 攻撃開始時点の位置（lunge の起点）。 */
  startPosition: Vec3;
  /** 追尾先（startup 終了時点で確定）。 */
  target: Vec3;
  landingResolved: boolean;
  projectileSpawned: boolean;
}

export interface MonsterHitbox {
  center: Vec3;
  radius: number;
  attack: MonsterActiveAttack;
}

export interface MonsterCombatHooks {
  /** 投射物を生成する。core 内の ProjectileManager に繋ぐ。 */
  spawnProjectile: (attack: MonsterAttackDefinition, origin: Vec3, target: Vec3) => void;
  /** 攻撃開始（テレグラフ開始）の通知。UI/音の合図に使う。 */
  onAttackStarted?: (attack: MonsterAttackDefinition) => void;
}

/**
 * モンスターの攻撃実行と被リアクション（怯み/気絶/転倒）。
 * 「どの攻撃を選ぶか」は MonsterAI の責務で、ここは選ばれた攻撃のタイムラインを正確に回すだけ。
 * telegraph -> startup -> active -> recovery を必ず通り、途中で止まるのは怯み/気絶だけ。
 */
export class MonsterCombat {
  state: MonsterCombatState = 'idle';
  current: MonsterActiveAttack | null = null;
  /** 怒り時などにダメージへ掛ける倍率。T09 で更新する。 */
  damageMultiplier = 1;

  private reactionRemaining = 0;
  private readonly cooldowns = new Map<string, number>();
  private nextInstanceId = 1;
  private readonly hitboxPool: MonsterHitbox[] = [];
  private readonly scratch = new Vec3();

  constructor(
    private readonly monster: Monster,
    private readonly hooks: MonsterCombatHooks,
  ) {}

  get isBusy(): boolean {
    return this.state !== 'idle';
  }

  get isAttacking(): boolean {
    return this.state === 'attacking' && this.current !== null;
  }

  /** 怯み・気絶・転倒中（プレイヤーの攻撃チャンス）。 */
  get isIncapacitated(): boolean {
    return this.state === 'flinch' || this.state === 'stunned' || this.state === 'toppled';
  }

  get reactionSecondsLeft(): number {
    return this.reactionRemaining;
  }

  get phase(): MonsterAttackPhase | null {
    const c = this.current;
    if (!c || this.state !== 'attacking') return null;
    const phase = phaseAt(c.def, c.elapsed);
    return phase === 'done' ? null : phase;
  }

  /** 現在フェーズ内の進捗 0〜1（描画用）。 */
  get phaseProgress(): number {
    const c = this.current;
    if (!c) return 0;
    const d = c.def;
    let t = c.elapsed;
    if (t < d.telegraphSeconds) return t / Math.max(d.telegraphSeconds, 1e-6);
    t -= d.telegraphSeconds;
    if (t < d.startupSeconds) return t / Math.max(d.startupSeconds, 1e-6);
    t -= d.startupSeconds;
    if (t < d.activeSeconds) return t / Math.max(d.activeSeconds, 1e-6);
    t -= d.activeSeconds;
    return Math.min(1, t / Math.max(d.recoverySeconds, 1e-6));
  }

  rangeBandFor(distance: number): RangeBand {
    const c = this.monster.def.combat;
    if (distance <= c.nearRangeMeters) return 'near';
    if (distance <= c.middleRangeMeters) return 'middle';
    return 'far';
  }

  /** ターゲットへの相対角（絶対値, rad）。0 が正面、π が真後ろ。 */
  relativeAngleTo(target: Vec3): number {
    const yawToTarget = Math.atan2(target.x - this.monster.position.x, target.z - this.monster.position.z);
    return Math.abs(wrapAngle(yawToTarget - this.monster.yaw));
  }

  cooldownRemaining(attackId: string): number {
    return this.cooldowns.get(attackId) ?? 0;
  }

  canUse(attack: MonsterAttackDefinition, distance: number, relativeAngle: number): boolean {
    if (this.isBusy) return false;
    if (this.cooldownRemaining(attack.id) > 0) return false;
    if (!attack.ranges.includes(this.rangeBandFor(distance))) return false;
    if (relativeAngle < attack.facingArc.minRad || relativeAngle > attack.facingArc.maxRad) return false;
    return true;
  }

  startAttack(attack: MonsterAttackDefinition, target: Vec3): void {
    this.state = 'attacking';
    this.current = {
      def: attack,
      instanceId: this.nextInstanceId++,
      elapsed: 0,
      hasHitPlayer: false,
      startPosition: this.monster.position.clone(),
      target: target.clone(),
      landingResolved: false,
      projectileSpawned: false,
    };
    this.monster.stats.stamina = Math.max(0, this.monster.stats.stamina - attack.staminaCost);
    this.hooks.onAttackStarted?.(attack);
  }

  /** クールダウンは攻撃「終了」から数える（開始から数えると攻撃時間より短い値が無意味になる）。 */
  private finishAttack(): void {
    const c = this.current;
    if (c) this.cooldowns.set(c.def.id, c.def.cooldownSeconds);
    this.current = null;
  }

  /** 怯み/気絶/転倒。進行中の攻撃は打ち切る。より重い反応で上書きされる。 */
  interrupt(kind: 'flinch' | 'stunned' | 'toppled', seconds: number): void {
    const severity = { flinch: 1, stunned: 3, toppled: 2 } as const;
    const currentSeverity = this.state === 'flinch' || this.state === 'stunned' || this.state === 'toppled' ? severity[this.state] : 0;
    if (severity[kind] < currentSeverity) return;
    this.state = kind;
    this.finishAttack();
    this.reactionRemaining = Math.max(this.reactionRemaining * (severity[kind] === currentSeverity ? 1 : 0), seconds);
  }

  update(dt: number, target: Vec3): void {
    for (const [id, remaining] of this.cooldowns) {
      if (remaining <= 0) continue;
      const next = remaining - dt;
      // 浮動小数の積み残しで「あと 1e-16 秒」が残り続けないよう、微小値は 0 に丸める
      this.cooldowns.set(id, next <= 1e-6 ? 0 : next);
    }

    if (this.isIncapacitated) {
      this.reactionRemaining -= dt;
      if (this.reactionRemaining <= 0) {
        this.reactionRemaining = 0;
        this.state = 'idle';
      }
      return;
    }

    const c = this.current;
    if (!c || this.state !== 'attacking') return;

    const d = c.def;
    const before = c.elapsed;
    c.elapsed += dt;
    const phaseBefore = phaseAt(d, before);
    const phaseNow = phaseAt(d, c.elapsed);

    // テレグラフ中は追尾（向き直り）。見てから回避できるよう、startup 以降は向きを固定する。
    if (phaseNow === 'telegraph' && d.telegraphTurnMultiplier > 0) {
      c.target.copy(target);
      this.monster.turnTowards(target, this.monster.def.stats.turnSpeedRadPerSecond * d.telegraphTurnMultiplier * dt);
    }
    if (phaseNow === 'startup') {
      // startup の間だけターゲット位置を記録し続け、active 開始時点の狙いにする
      c.target.copy(target);
    }

    if (phaseNow === 'active') {
      this.applyMotion(c, phaseBefore !== 'active', dt);
    }

    if (phaseNow === 'done') {
      this.state = 'idle';
      this.finishAttack();
    }
  }

  private applyMotion(c: MonsterActiveAttack, activeJustBegan: boolean, dt: number): void {
    const m = c.def.motion;
    switch (m.kind) {
      case 'charge':
        this.monster.moveForward((m.speed ?? 0) * dt);
        break;
      case 'lunge':
        if (!c.landingResolved) {
          c.landingResolved = true;
          const maxDistance = m.maxDistance ?? 0;
          const landing = this.scratch.copy(c.target).sub(c.startPosition);
          landing.y = 0;
          const dist = landing.length();
          if (dist > maxDistance) landing.scale(maxDistance / Math.max(dist, 1e-6));
          this.monster.moveBy(landing.x, landing.z);
        }
        break;
      case 'projectile':
        if (activeJustBegan && !c.projectileSpawned && m.spawnOffset) {
          c.projectileSpawned = true;
          const origin = transformPoint(m.spawnOffset, this.monster.position, this.monster.yaw, new Vec3());
          this.hooks.spawnProjectile(c.def, origin, c.target);
        }
        break;
      case 'none':
        break;
    }
  }

  /** active 中のヒットボックス（ワールド座標）。 */
  getActiveHitboxes(out: MonsterHitbox[]): MonsterHitbox[] {
    out.length = 0;
    const c = this.current;
    if (!c || this.phase !== 'active') return out;
    c.def.hitboxes.forEach((hb, index) => {
      let slot = this.hitboxPool[index];
      if (!slot) {
        slot = { center: new Vec3(), radius: 0, attack: c };
        this.hitboxPool[index] = slot;
      }
      transformPoint(hb.offset, this.monster.position, this.monster.yaw, slot.center);
      slot.radius = hb.radius;
      slot.attack = c;
      out.push(slot);
    });
    return out;
  }

  reset(): void {
    this.state = 'idle';
    this.current = null;
    this.reactionRemaining = 0;
    this.cooldowns.clear();
    this.damageMultiplier = 1;
  }
}

export function monsterAttackTotalSeconds(d: MonsterAttackDefinition): number {
  return d.telegraphSeconds + d.startupSeconds + d.activeSeconds + d.recoverySeconds;
}

function phaseAt(d: MonsterAttackDefinition, elapsed: number): MonsterAttackPhase | 'done' {
  let t = elapsed;
  if (t < d.telegraphSeconds) return 'telegraph';
  t -= d.telegraphSeconds;
  if (t < d.startupSeconds) return 'startup';
  t -= d.startupSeconds;
  if (t < d.activeSeconds) return 'active';
  t -= d.activeSeconds;
  if (t < d.recoverySeconds) return 'recovery';
  return 'done';
}
