import type { PlayerBalance } from '@data/schemas/balance';
import type { WeaponDefinition } from '@data/schemas/weapon';
import type { HeightProvider } from '@core/world/Terrain';
import { PlayerCombat, type CombatContext } from '@core/combat/PlayerCombat';
import { PlayerController } from './PlayerController';
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
  readonly combat: PlayerCombat;

  private readonly effectiveIntent = createEmptyIntent();
  private readonly combatContext: CombatContext = { isDodging: false, timeSinceDodgeEnd: Infinity };

  constructor(balance: PlayerBalance, weapon: WeaponDefinition, terrain: HeightProvider) {
    this.stats = new PlayerStats(balance);
    this.controller = new PlayerController(this.stats, terrain, balance);
    this.combat = new PlayerCombat(weapon, this.stats);
  }

  update(intent: PlayerIntent, dt: number): void {
    const controller = this.controller;
    this.combatContext.isDodging = controller.state === 'dodge';
    this.combatContext.timeSinceDodgeEnd = controller.timeSinceDodgeEnd;

    const combatResult = this.combat.update(intent, this.combatContext, dt);

    const effective = this.effectiveIntent;
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
