import type { CarveEntry } from '@data/schemas/item';
import type { Carcass } from '@core/ecosystem/Carcass';
import type { PlayerController } from '@core/player/PlayerController';
import type { Random } from '@shared/rng/Random';
import type { Inventory } from './Inventory';
import { rollCarve, type LootDrop } from './LootTable';

export interface CarvePrompt {
  /** 近くに剥ぎ取れる死骸があるか。 */
  available: boolean;
  carcassId: number;
  carvesRemaining: number;
  /** 剥ぎ取り中の進捗 0〜1（未実行なら 0）。 */
  progress: number;
}

export interface CarveResult {
  carcassId: number;
  sourceId: string;
  drop: LootDrop | null;
}

/**
 * 剥ぎ取り。死骸のそばで操作すると一定時間プレイヤーを拘束し、抽選表から素材を得る。
 * 「死骸 id -> 抽選表」の解決は外から渡す（モンスターと小型生物で表の在処が違うため）。
 */
export class CarveController {
  readonly prompt: CarvePrompt = { available: false, carcassId: 0, carvesRemaining: 0, progress: 0 };
  private active: Carcass | null = null;
  private elapsed = 0;

  constructor(
    private readonly player: PlayerController,
    private readonly inventory: Inventory,
    private readonly rng: Random,
    private readonly resolveTable: (sourceId: string) => readonly CarveEntry[] | null,
    private readonly carveSeconds: number,
    private readonly carveRange: number,
  ) {}

  get isCarving(): boolean {
    return this.active !== null;
  }

  /** 戻り値: このステップで剥ぎ取りが完了したらその結果。 */
  update(dt: number, interactPressed: boolean, carcasses: readonly Carcass[]): CarveResult | null {
    const p = this.player;

    if (this.active) {
      this.elapsed += dt;
      this.prompt.progress = Math.min(1, this.elapsed / this.carveSeconds);
      // 完了判定を先に置く: プレイヤー側の拘束タイマーと同じフレームで満了するため、
      // 先に「拘束が解けた = 中断」と判定すると剥ぎ取りが永遠に成功しない。
      if (this.elapsed >= this.carveSeconds - 1e-6) return this.finish();
      // 被弾などで拘束が解けたら中断
      if (p.state !== 'interact') {
        this.cancel();
        return null;
      }
      return null;
    }

    const nearest = this.findNearest(carcasses);
    this.prompt.available = nearest !== null && p.canAct;
    this.prompt.carcassId = nearest?.id ?? 0;
    this.prompt.carvesRemaining = nearest?.carvesRemaining ?? 0;
    this.prompt.progress = 0;

    if (nearest && interactPressed && p.canAct && p.state !== 'dodge') {
      this.active = nearest;
      this.elapsed = 0;
      p.startInteraction(this.carveSeconds);
    }
    return null;
  }

  cancel(): void {
    this.active = null;
    this.elapsed = 0;
    this.prompt.progress = 0;
  }

  private finish(): CarveResult {
    const carcass = this.active as Carcass;
    this.active = null;
    this.elapsed = 0;
    this.prompt.progress = 0;
    carcass.carvesRemaining = Math.max(0, carcass.carvesRemaining - 1);
    const table = this.resolveTable(carcass.sourceId);
    const drop = table ? rollCarve(table, this.rng) : null;
    if (drop) this.inventory.add(drop.itemId, drop.count);
    return { carcassId: carcass.id, sourceId: carcass.sourceId, drop };
  }

  private findNearest(carcasses: readonly Carcass[]): Carcass | null {
    let best: Carcass | null = null;
    let bestDist = this.carveRange;
    for (const c of carcasses) {
      if (c.carvesRemaining <= 0) continue;
      const d = c.position.horizontalDistanceTo(this.player.position);
      if (d <= bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }
}
