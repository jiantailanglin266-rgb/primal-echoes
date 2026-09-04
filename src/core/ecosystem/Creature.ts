import type { CreatureDefinition } from '@data/schemas/creature';
import { Vec3 } from '@shared/math/Vec3';

export type CreatureState = 'graze' | 'wander' | 'flee' | 'approachCarcass' | 'feed' | 'dead';

/**
 * 小型生物 1 体。行動判断は EcosystemManager が行い、ここは状態のみ。
 */
export class Creature {
  readonly position = new Vec3();
  readonly previousPosition = new Vec3();
  yaw = 0;
  hp: number;
  state: CreatureState = 'graze';
  stateElapsed = 0;
  /** 群れの識別子。同じ群れの個体は先頭に追従する。 */
  readonly herdId: number;
  /** 群れの中での序列。0 が先頭。 */
  readonly herdIndex: number;
  /** ねぐら（うろつきの中心）。 */
  readonly home = new Vec3();
  readonly wanderTarget = new Vec3();
  wanderWait = 0;
  /** 逃走の起点（脅威の位置）。 */
  readonly threatPosition = new Vec3();
  calmRemaining = 0;
  /** 腐肉食が向かっている死骸の id。 */
  targetCarcassId: number | null = null;
  feedRemaining = 0;

  constructor(
    readonly id: string,
    readonly def: CreatureDefinition,
    herdId: number,
    herdIndex: number,
  ) {
    this.hp = def.maxHp;
    this.herdId = herdId;
    this.herdIndex = herdIndex;
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  /** 当たり判定球の中心（胴体の高さ）。 */
  getBodyCenter(out: Vec3): Vec3 {
    return out.set(this.position.x, this.position.y + this.def.height * 0.5, this.position.z);
  }

  getForward(out = new Vec3()): Vec3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}
