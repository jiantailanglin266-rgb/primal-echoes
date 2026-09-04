import type { PlayerBalance } from '@data/schemas/balance';
import type { WeaponDefinition } from '@data/schemas/weapon';
import type { ConsumableEffect } from '@data/schemas/item';
import type { HeightProvider } from '@core/world/Terrain';
import { PlayerCombat, type CombatContext } from '@core/combat/PlayerCombat';
import type { Vec3 } from '@shared/math/Vec3';
import { PlayerController, type KnockbackSpec } from './PlayerController';
import { PlayerStats } from './PlayerStats';
import { createEmptyIntent, type PlayerIntent } from './PlayerIntent';

/**
 * プレイヤー集約。Stats / Controller（移動）/ Combat（攻撃）の更新順序と相互制約を一箇所で決める。
 *
 * 1 ステップの流れ:
 *   Combat が「移動を止めるか・回避を許すか」を決める
 *   -> その制約で Controller を更新
 *   -> 回避が始まっていたら攻撃をキャンセル（回避キャンセル）
 *   -> 攻撃の踏み込みを反映
 *   -> Stats（スタミナ回復）
 */
export class Player {
  readonly stats: PlayerStats;
  readonly controller: PlayerController;
  combat: PlayerCombat;

  private readonly effectiveIntent = createEmptyIntent();
  private readonly combatContext: CombatContext = { isDodging: false, timeSinceDodgeEnd: Infinity };

  constructor(balance: PlayerBalance, weapon: WeaponDefinition, terrain: HeightProvider) {
    this.stats = new PlayerStats(balance);
    this.controller = new PlayerController(this.stats, terrain, balance);
    this.combat = new PlayerCombat(weapon, this.stats);
  }

  get isDowned(): boolean {
    return this.controller.state === 'downed';
  }

  /** 武器を持ち替える（強化後など）。攻撃中は呼ばない前提（拠点でのみ使う）。 */
  equipWeapon(weapon: WeaponDefinition): void {
    this.combat = new PlayerCombat(weapon, this.stats);
  }

  /**
   * 消耗品を使う。回避・攻撃中は使えない。
   * 回復は即時だが useSeconds のあいだ無防備になる（「安全な隙を見つけて飲む」判断を要求する）。
   * 戻り値: 使えたか。
   */
  useConsumable(effect: ConsumableEffect): boolean {
    const c = this.controller;
    if (!c.canAct || c.state === 'dodge' || this.combat.isBusy) return false;
    this.combat.cancel();
    c.startInteraction(effect.useSeconds);
    if (c.state !== 'interact') return false;
    this.stats.heal(effect.healAmount);
    return true;
  }

  /**
   * 被弾処理。戻り値: この被弾で戦闘不能になったか。
   * のけぞり中は攻撃・チャージも打ち切られる。
   */
  applyHit(damage: number, awayDirection: Vec3, knockback: KnockbackSpec): boolean {
    this.stats.takeDamage(damage);
    this.combat.cancel();
    this.controller.applyHit(awayDirection, knockback);
    if (!this.stats.isAlive) {
      this.controller.down();
      return true;
    }
    return false;
  }

  update(intent: PlayerIntent, dt: number): void {
    const controller = this.controller;
    const effective = this.effectiveIntent;

    if (!controller.canAct) {
      // のけぞり/戦闘不能中は入力を捨てる。攻撃状態は applyHit 時点で cancel 済み。
      effective.move.set(0, 0, 0);
      effective.dash = false;
      effective.dodge = false;
      controller.update(effective, dt);
      this.stats.update(dt);
      return;
    }

    this.combatContext.isDodging = controller.state === 'dodge';
    this.combatContext.timeSinceDodgeEnd = controller.timeSinceDodgeEnd;

    const combatResult = this.combat.update(intent, this.combatContext, dt);

    effective.move.copy(intent.move);
    effective.dash = intent.dash;
    effective.dodge = intent.dodge && combatResult.allowsDodge;

    if (combatResult.locksMovement) {
      if (combatResult.turnSpeedRadPerSecond > 0) {
        controller.turnTowards(intent.move, combatResult.turnSpeedRadPerSecond * dt);
      }
      effective.move.set(0, 0, 0);
      effective.dash = false;
    }

    const wasDodging = controller.state === 'dodge';
    controller.update(effective, dt);

    // 回避が新たに始まった = 回避キャンセル成立。攻撃/チャージを打ち切る。
    if (!wasDodging && controller.state === 'dodge' && this.combat.isBusy) {
      this.combat.cancel();
    }

    if (combatResult.forwardStep !== 0 && controller.state !== 'dodge') {
      controller.moveAlongForward(combatResult.forwardStep);
    }

    this.stats.update(dt);
  }
}
