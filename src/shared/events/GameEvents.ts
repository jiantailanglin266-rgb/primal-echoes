import type { DamageResult } from '@core/combat/DamageSystem';
import type { Vec3 } from '@shared/math/Vec3';

/**
 * core -> presentation/ui へ流れるイベントの型定義。
 * core はこの型で emit するだけで、誰が聞いているかを知らない。
 */
// interface ではなく type にしているのは、EventBus の Record 制約（暗黙のインデックスシグネチャ）を満たすため
export type GameEvents = {
  hit: {
    monsterId: string;
    partId: string;
    /** 接触点（ワールド座標のコピー）。ダメージ数字や VFX の発生位置。 */
    position: Vec3;
    result: DamageResult;
    hitStopSeconds: number;
  };
  monsterFlinched: { monsterId: string; partId: string };
  monsterStunned: { monsterId: string };
  partBroken: { monsterId: string; partId: string };
  partSevered: { monsterId: string; partId: string };
  monsterDied: { monsterId: string };
  monsterAttackStarted: { monsterId: string; attackId: string; telegraphSeconds: number };
  monsterStateChanged: { monsterId: string; from: string; to: string };
  monsterEnraged: { monsterId: string };
  monsterCalmed: { monsterId: string };
  monsterExhausted: { monsterId: string };
  monsterRecovered: { monsterId: string };
  playerHit: { damage: number; position: Vec3; attackId: string };
  playerDowned: { position: Vec3 };
};
