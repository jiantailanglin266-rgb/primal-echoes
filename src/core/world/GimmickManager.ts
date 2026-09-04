import type { GimmickDefinition } from '@data/schemas/field';
import type { Monster, MonsterHitOutcome } from '@core/monster/Monster';
import { createDamageResult } from '@core/combat/DamageSystem';
import { Vec3 } from '@shared/math/Vec3';

export interface GimmickState {
  def: GimmickDefinition;
  position: Vec3;
  usesLeft: number;
  /** 作動中: 効果発生までの残り秒。0 以下なら待機。 */
  countdown: number;
  armed: boolean;
}

export interface GimmickPrompt {
  available: boolean;
  gimmickId: string;
  name: string;
}

export interface GimmickImpact {
  gimmickId: string;
  position: Vec3;
  hitMonsterIds: string[];
}

export interface GimmickHooks {
  onTriggered?: (gimmick: GimmickState) => void;
  onImpact?: (impact: GimmickImpact) => void;
}

/**
 * 環境ギミック（VS0.2 は落石のみ）。
 * プレイヤーが近くで操作 -> 遅れて範囲内の大型モンスターへ大ダメージ + 転倒。
 * 「モンスターを地形へ誘導する」遊びを作るための最小構成。
 */
export class GimmickManager {
  readonly gimmicks: GimmickState[];
  readonly prompt: GimmickPrompt = { available: false, gimmickId: '', name: '' };
  private readonly outcome: MonsterHitOutcome = { broke: false, severed: false, flinched: false, died: false, stunned: false, enraged: false, toppled: false };

  constructor(
    defs: readonly GimmickDefinition[],
    heightAt: (x: number, z: number) => number,
    private readonly hooks: GimmickHooks = {},
  ) {
    this.gimmicks = defs.map((def) => ({
      def,
      position: new Vec3(def.position.x, heightAt(def.position.x, def.position.z), def.position.z),
      usesLeft: def.uses,
      countdown: 0,
      armed: false,
    }));
  }

  reset(): void {
    for (const g of this.gimmicks) {
      g.usesLeft = g.def.uses;
      g.countdown = 0;
      g.armed = false;
    }
  }

  /** 戻り値: このステップで操作が成立したか。 */
  update(dt: number, playerPosition: Vec3, interactPressed: boolean, monsters: readonly Monster[]): boolean {
    let triggered = false;
    const nearest = this.findUsable(playerPosition);
    this.prompt.available = nearest !== null;
    this.prompt.gimmickId = nearest?.def.id ?? '';
    this.prompt.name = nearest?.def.name ?? '';

    if (nearest && interactPressed) {
      nearest.armed = true;
      nearest.countdown = nearest.def.delaySeconds;
      nearest.usesLeft -= 1;
      this.hooks.onTriggered?.(nearest);
      triggered = true;
    }

    for (const g of this.gimmicks) {
      if (!g.armed) continue;
      g.countdown -= dt;
      if (g.countdown > 0) continue;
      g.armed = false;
      this.impact(g, monsters);
    }
    return triggered;
  }

  private findUsable(playerPosition: Vec3): GimmickState | null {
    let best: GimmickState | null = null;
    let bestDist = Infinity;
    for (const g of this.gimmicks) {
      if (g.usesLeft <= 0 || g.armed) continue;
      const d = g.position.horizontalDistanceTo(playerPosition);
      if (d <= g.def.triggerRadius && d < bestDist) {
        bestDist = d;
        best = g;
      }
    }
    return best;
  }

  private impact(g: GimmickState, monsters: readonly Monster[]): void {
    const hitIds: string[] = [];
    for (const m of monsters) {
      if (!m.isAlive) continue;
      if (m.position.horizontalDistanceTo(g.position) > g.def.impactRadius + m.def.stats.bodyRadius) continue;
      // 転倒させたいので、脚部のうち反応が topple の部位へ怯み蓄積を入れる。無ければ胴体。
      const leg = m.parts.find((p) => p.def.reaction === 'topple' && !p.isSevered) ?? m.parts[0];
      if (!leg) continue;
      const result = createDamageResult();
      result.total = g.def.damage;
      result.partDamage = g.def.damage * 0.5;
      result.flinchDamage = g.def.flinchDamage;
      result.damageType = 'impact';
      m.applyHit(leg.id, result, this.outcome);
      hitIds.push(m.id);
    }
    this.hooks.onImpact?.({ gimmickId: g.def.id, position: g.position.clone(), hitMonsterIds: hitIds });
  }
}
