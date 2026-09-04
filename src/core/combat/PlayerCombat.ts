import type { ChargeLevel, WeaponDefinition } from '@data/schemas/weapon';
import type { PlayerStats } from '@core/player/PlayerStats';
import { Vec3 } from '@shared/math/Vec3';
import { attackPhaseAt, attackTotalSeconds, type AttackData, type AttackPhase, type PhaseInfo } from './AttackData';

export type CombatState = 'idle' | 'charging' | 'attacking';
type AttackInput = 'light' | 'heavy';

/** 攻撃 1 回分の実行中インスタンス。 */
export interface ActiveAttack {
  attack: AttackData;
  /** 同一攻撃の多段ヒットを防ぐため、インスタンスごとに一意な id を振る。 */
  instanceId: number;
  elapsed: number;
  chargeLevel: number;
  motionValueMultiplier: number;
  partDamageMultiplier: number;
  hitStopSeconds: number;
  /** 既に当てた「対象+部位」キー。1 攻撃 1 部位 1 ヒット。 */
  hitKeys: Set<string>;
}

/** ワールド空間に変換済みのヒットボックス。HitDetection がこれとモンスター部位を照合する。 */
export interface WorldHitbox {
  center: Vec3;
  radius: number;
  source: ActiveAttack;
}

export interface CombatContext {
  isDodging: boolean;
  timeSinceDodgeEnd: number;
}

export interface CombatStepResult {
  /** 攻撃/チャージ中で移動入力を無視すべきか。 */
  locksMovement: boolean;
  /** このステップで前進させる距離（踏み込み）。 */
  forwardStep: number;
  /** 回避入力を受け付けてよいか。 */
  allowsDodge: boolean;
  /** 入力方向へ向き直れる速度（rad/s）。0 なら旋回不可。 */
  turnSpeedRadPerSecond: number;
}

/**
 * プレイヤーの攻撃状態機械。
 * - 攻撃は startup -> active -> recovery を必ず通り、途中キャンセルは
 *   「chainFromSeconds 以降の派生」と「dodgeCancelFromSeconds 以降の回避」だけ。
 * - 先行入力はバッファに 1 つだけ保持し、一定時間で失効させる。
 * - Heavy は押した瞬間にチャージ状態へ入り、離した時間で通常 Heavy / チャージ攻撃を分岐する。
 */
export class PlayerCombat {
  state: CombatState = 'idle';
  current: ActiveAttack | null = null;

  private buffered: { input: AttackInput; age: number } | null = null;
  private chargeElapsed = 0;
  /** チャージ開始時点のコンボ文脈（'idle' or 攻撃 id）。放った Heavy の派生元を決める。 */
  private chargeContext = 'idle';
  private nextInstanceId = 1;

  private readonly attacksById = new Map<string, AttackData>();
  private readonly phaseScratch: PhaseInfo = { phase: 'done', progress: 0 };
  private readonly result: CombatStepResult = {
    locksMovement: false,
    forwardStep: 0,
    allowsDodge: true,
    turnSpeedRadPerSecond: 0,
  };
  private readonly hitboxPool: WorldHitbox[] = [];

  constructor(
    readonly weapon: WeaponDefinition,
    private readonly stats: PlayerStats,
  ) {
    for (const attack of weapon.attacks) this.attacksById.set(attack.id, attack);
  }

  get isBusy(): boolean {
    return this.state !== 'idle';
  }

  get chargeLevel(): number {
    if (this.state !== 'charging') return -1;
    return this.resolveChargeLevelIndex();
  }

  get chargeHoldSeconds(): number {
    return this.state === 'charging' ? this.chargeElapsed : 0;
  }

  getPhase(out: PhaseInfo = this.phaseScratch): PhaseInfo {
    if (!this.current) {
      out.phase = 'done';
      out.progress = 0;
      return out;
    }
    return attackPhaseAt(this.current.attack, this.current.elapsed, out);
  }

  get phase(): AttackPhase | null {
    const info = this.getPhase();
    return info.phase === 'done' ? null : info.phase;
  }

  update(intent: { lightAttack: boolean; heavyAttack: boolean; heavyHeld: boolean }, ctx: CombatContext, dt: number): CombatStepResult {
    this.bufferInputs(intent, dt);
    this.result.forwardStep = 0;

    switch (this.state) {
      case 'attacking':
        this.updateAttacking(dt);
        break;
      case 'charging':
        this.updateCharging(intent.heavyHeld, dt);
        break;
      case 'idle':
        this.updateIdle(ctx);
        break;
    }

    this.fillResult();
    return this.result;
  }

  /** 回避キャンセル等で攻撃を打ち切る。 */
  cancel(): void {
    this.state = 'idle';
    this.current = null;
    this.chargeElapsed = 0;
    this.buffered = null;
  }

  /** active フェーズ中のヒットボックスをワールド座標で返す。それ以外は空。 */
  getActiveHitboxes(origin: Vec3, yaw: number, out: WorldHitbox[]): WorldHitbox[] {
    out.length = 0;
    const current = this.current;
    if (!current || this.getPhase().phase !== 'active') return out;

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    current.attack.hitboxes.forEach((hitbox, index) => {
      let slot = this.hitboxPool[index];
      if (!slot) {
        slot = { center: new Vec3(), radius: 0, source: current };
        this.hitboxPool[index] = slot;
      }
      const { x, y, z } = hitbox.offset;
      slot.center.set(origin.x + x * cos + z * sin, origin.y + y, origin.z - x * sin + z * cos);
      slot.radius = hitbox.radius;
      slot.source = current;
      out.push(slot);
    });
    return out;
  }

  // ---- internals ----

  private bufferInputs(intent: { lightAttack: boolean; heavyAttack: boolean }, dt: number): void {
    if (this.buffered) {
      this.buffered.age += dt;
      if (this.buffered.age > this.weapon.inputBufferSeconds) this.buffered = null;
    }
    // 後に押した入力を優先する（Light 連打中に Heavy を押したら Heavy を出したい）
    if (intent.lightAttack) this.buffered = { input: 'light', age: 0 };
    if (intent.heavyAttack) this.buffered = { input: 'heavy', age: 0 };
  }

  private updateAttacking(dt: number): void {
    const current = this.current;
    if (!current) {
      this.state = 'idle';
      return;
    }
    const attack = current.attack;
    const before = current.elapsed;
    current.elapsed += dt;

    // 踏み込み: startup 期間に均等配分
    if (attack.forwardStep > 0 && before < attack.startupSeconds) {
      const stepEnd = Math.min(current.elapsed, attack.startupSeconds);
      this.result.forwardStep = (attack.forwardStep * (stepEnd - before)) / attack.startupSeconds;
    }

    if (current.elapsed >= attack.chainFromSeconds && this.buffered) {
      const links = this.weapon.combo[attack.id];
      const input = this.buffered.input;
      if (input === 'light' && links?.light) {
        this.buffered = null;
        this.startAttack(links.light, null);
        return;
      }
      if (input === 'heavy' && links?.heavy) {
        this.buffered = null;
        this.beginCharge(attack.id);
        return;
      }
    }

    if (current.elapsed >= attackTotalSeconds(attack)) {
      this.state = 'idle';
      this.current = null;
    }
  }

  private updateCharging(heavyHeld: boolean, dt: number): void {
    this.chargeElapsed += dt;
    const hasStamina = this.stats.drainStamina(this.weapon.chargeStaminaPerSecond, dt);
    if (heavyHeld && hasStamina) return;

    const context = this.chargeContext;
    if (this.chargeElapsed < this.weapon.heavyTapThresholdSeconds) {
      const heavyId = this.weapon.combo[context]?.heavy;
      if (heavyId) this.startAttack(heavyId, null);
      else this.state = 'idle';
      return;
    }
    const level = this.weapon.charge.levels[this.resolveChargeLevelIndex()] as ChargeLevel;
    this.startAttack(this.weapon.charge.attackId, level);
  }

  private updateIdle(ctx: CombatContext): void {
    if (ctx.isDodging || !this.buffered) return;
    const input = this.buffered.input;
    this.buffered = null;

    if (input === 'heavy') {
      this.beginCharge('idle');
      return;
    }
    if (ctx.timeSinceDodgeEnd <= this.weapon.dodgeAttackWindowSeconds) {
      this.startAttack(this.weapon.dodgeAttackId, null);
      return;
    }
    const lightId = this.weapon.combo['idle']?.light;
    if (lightId) this.startAttack(lightId, null);
  }

  private beginCharge(context: string): void {
    this.state = 'charging';
    this.current = null;
    this.chargeElapsed = 0;
    this.chargeContext = context;
  }

  private startAttack(attackId: string, level: ChargeLevel | null): void {
    const attack = this.attacksById.get(attackId);
    if (!attack) throw new Error(`[PlayerCombat] unknown attack "${attackId}"`);

    // スタミナ不足なら攻撃は不発。バッファは既に消費済みなので連打しても出ない。
    if (!this.stats.tryConsumeStamina(attack.staminaCost)) {
      this.state = 'idle';
      this.current = null;
      return;
    }

    this.state = 'attacking';
    this.chargeElapsed = 0;
    this.current = {
      attack,
      instanceId: this.nextInstanceId++,
      elapsed: 0,
      chargeLevel: level ? this.weapon.charge.levels.indexOf(level) : -1,
      motionValueMultiplier: level?.motionValueMultiplier ?? 1,
      partDamageMultiplier: level?.partDamageMultiplier ?? 1,
      hitStopSeconds: level?.hitStopSeconds ?? attack.hitStopSeconds,
      hitKeys: new Set(),
    };
  }

  private resolveChargeLevelIndex(): number {
    const levels = this.weapon.charge.levels;
    let index = 0;
    for (let i = 0; i < levels.length; i++) {
      if (this.chargeElapsed >= (levels[i] as ChargeLevel).holdSeconds) index = i;
    }
    return index;
  }

  private fillResult(): void {
    const r = this.result;
    switch (this.state) {
      case 'idle':
        r.locksMovement = false;
        r.allowsDodge = true;
        r.turnSpeedRadPerSecond = 0;
        break;
      case 'charging':
        r.locksMovement = true;
        r.allowsDodge = true;
        r.turnSpeedRadPerSecond = this.weapon.startupTurnSpeedRadPerSecond;
        break;
      case 'attacking': {
        const current = this.current;
        const phase = this.getPhase().phase;
        r.locksMovement = true;
        r.allowsDodge = current !== null && current.elapsed >= current.attack.dodgeCancelFromSeconds;
        r.turnSpeedRadPerSecond = phase === 'startup' ? this.weapon.startupTurnSpeedRadPerSecond : 0;
        break;
      }
    }
  }
}
