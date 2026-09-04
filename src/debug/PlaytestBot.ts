import type { PlayerIntent } from '@core/player/PlayerIntent';
import type { Player } from '@core/player/Player';
import type { Monster } from '@core/monster/Monster';
import type { Carcass } from '@core/ecosystem/Carcass';
import type { InputState } from '@input/InputState';
import { Vec3 } from '@shared/math/Vec3';

export interface BotStats {
  hitsLanded: number;
  damageDealt: number;
  damageTaken: number;
  dodges: number;
  downs: number;
  simSeconds: number;
  killedAtSeconds: number | null;
}

/**
 * 通しプレイ検証用の簡易ボット（`?bot=1`）。
 * 「近づく → 予備動作を見たら横に回避 → 隙に攻撃 → 討伐後に剥ぎ取り」だけを行う。
 * バランス調整の物差し（討伐時間・被ダメージ）を、手で遊ばずに再現可能にするためのもの。
 * 賢くしすぎると人間の基準から離れるので、反応は遅め・攻撃は雑にしてある。
 */
export class PlaytestBot {
  readonly stats: BotStats = { hitsLanded: 0, damageDealt: 0, damageTaken: 0, dodges: 0, downs: 0, simSeconds: 0, killedAtSeconds: null };
  /** 予備動作を見てから反応するまでの遅れ（人間らしさ）。 */
  reactionSeconds = 0.2;
  /** 攻撃を出す間隔。連打はせず、判定が終わってから次を押す。 */
  attackCadenceSeconds = 0.35;

  private readonly toMonster = new Vec3();
  private readonly side = new Vec3();
  private sinceAttack = 0;
  private telegraphSeen = 0;
  private sideSign = 1;
  private carveCooldown = 0;

  constructor(
    private readonly player: Player,
    private readonly monster: Monster,
  ) {}

  update(dt: number, input: InputState, intent: PlayerIntent, carcasses: readonly Carcass[]): void {
    this.stats.simSeconds += dt;
    this.sinceAttack += dt;
    this.carveCooldown = Math.max(0, this.carveCooldown - dt);

    intent.move.set(0, 0, 0);
    intent.dash = false;
    intent.dodge = false;
    intent.lightAttack = false;
    intent.heavyAttack = false;
    intent.heavyHeld = false;
    input.interactPressed = false;
    input.useItemPressed = false;

    const p = this.player;
    const m = this.monster;
    if (!p.controller.canAct) return;

    if (!m.isAlive) {
      this.carveNearest(input, intent, carcasses);
      return;
    }

    this.toMonster.copy(m.position).sub(p.controller.position);
    this.toMonster.y = 0;
    const distance = this.toMonster.length();
    if (distance > 1e-3) this.toMonster.scale(1 / distance);
    // 側面へ回り込む方向（右手側）
    this.side.set(this.toMonster.z, 0, -this.toMonster.x).scale(this.sideSign);

    const combat = m.combat;
    const telegraphing = combat.phase === 'telegraph' || combat.phase === 'startup';
    if (telegraphing) this.telegraphSeen += dt;
    else this.telegraphSeen = 0;

    const attackReach = this.currentAttackReach();
    // 無敵は回避開始 0.04〜0.32 秒。判定が出る直前（0.2 秒前）に転がるのが正解で、
    // 予備動作を見た瞬間に転がると無敵が切れてから当たる。
    const current = combat.current;
    const timeToActive = current ? current.def.telegraphSeconds + current.def.startupSeconds - current.elapsed : Infinity;
    const threatened = telegraphing && distance < attackReach + 2 && this.telegraphSeen >= this.reactionSeconds && timeToActive <= 0.22;

    // 体力が減ったら、相手が攻撃していない隙に距離を取って回復薬を飲む
    if (p.stats.hpRatio < 0.45 && !telegraphing && combat.phase !== 'active' && !p.combat.isBusy) {
      if (distance < 9) {
        intent.move.copy(this.toMonster).scale(-1);
        intent.dash = p.stats.stamina > 20;
        return;
      }
      input.useItemPressed = true;
      return;
    }

    if (threatened && p.stats.stamina >= 25) {
      // 横へ転がる。突進など前方攻撃は横、尾は前へ抜ける
      const dir = combat.current?.def.id === 'vg_tail_sweep' ? this.toMonster : this.side;
      intent.move.copy(dir);
      // 回避は 1 回の予備動作につき 1 度だけ押す（押しっぱなしにしない）
      if (p.controller.state !== 'dodge') {
        intent.dodge = true;
        this.stats.dodges++;
        if (Math.random() < 0.3) this.sideSign *= -1;
      }
      return;
    }

    const openWindow = combat.isIncapacitated || combat.phase === 'recovery' || combat.state === 'idle';
    const inRange = distance <= 5.2;
    // 正面（顎の前）に立たない。側面の前脚を狙う位置へ回り込む。
    const relativeAngle = combat.relativeAngleTo(p.controller.position);
    const inFront = relativeAngle < 0.75;

    if (!inRange) {
      intent.move.copy(this.toMonster);
      if (inFront && distance < 12) intent.move.addScaled(this.side, 0.9).normalize();
      intent.dash = distance > 14 && p.stats.stamina > 30;
      return;
    }

    if (p.combat.isBusy) {
      // 硬直中に次の弱攻撃を先行入力して派生させる（軽い武器はこれが本体）
      if (p.combat.phase === 'recovery' && openWindow && p.combat.state === 'attacking') intent.lightAttack = true;
      return;
    }

    if (inFront && !combat.isIncapacitated && p.controller.state !== 'dodge') {
      // 側面へずれてから殴る
      intent.move.copy(this.side).scale(0.8).addScaled(this.toMonster, 0.15);
      return;
    }

    if (openWindow && this.sinceAttack >= this.attackCadenceSeconds) {
      this.sinceAttack = 0;
      // 隙が大きいときは溜め、そうでなければ弱攻撃
      if (combat.isIncapacitated && p.stats.stamina > 40) {
        intent.heavyAttack = true;
        intent.heavyHeld = true;
      } else {
        intent.lightAttack = true;
      }
      return;
    }
    if (p.combat.state === 'charging') {
      // 溜め中: 1 段階目で放つ（長押しし続けると被弾する）
      intent.heavyHeld = p.combat.chargeHoldSeconds < 1.05;
      return;
    }
    // 攻撃できないときは少し側面へ寄る
    intent.move.copy(this.side).scale(0.5).addScaled(this.toMonster, 0.2);
    // 距離を詰めすぎない（胴体に押し込まれると判定に包まれる）
    if (distance < 3.2) intent.move.copy(this.toMonster).scale(-0.6).addScaled(this.side, 0.4);
  }

  private currentAttackReach(): number {
    const attack = this.monster.combat.current?.def;
    if (!attack) return 0;
    let reach = 0;
    for (const hb of attack.hitboxes) reach = Math.max(reach, Math.hypot(hb.offset.x, hb.offset.z) + hb.radius);
    if (attack.motion.kind === 'charge') reach += (attack.motion.speed ?? 0) * attack.activeSeconds;
    if (attack.motion.kind === 'lunge') reach += attack.motion.maxDistance ?? 0;
    if (attack.motion.kind === 'projectile') reach = 40;
    return reach;
  }

  private carveNearest(input: InputState, intent: PlayerIntent, carcasses: readonly Carcass[]): void {
    let best: Carcass | null = null;
    let bestDist = Infinity;
    for (const c of carcasses) {
      if (c.carvesRemaining <= 0) continue;
      const d = c.position.horizontalDistanceTo(this.player.controller.position);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (!best) return;
    if (bestDist > 2.2) {
      intent.move.copy(best.position).sub(this.player.controller.position);
      intent.move.y = 0;
      intent.move.normalize();
      return;
    }
    if (this.carveCooldown <= 0 && this.player.controller.state !== 'interact') {
      input.interactPressed = true;
      this.carveCooldown = 0.5;
    }
  }
}
