import type { NeedsConfig } from '@data/schemas/monster';
import { clamp } from '@shared/math/scalar';

export type NeedsActivity = 'normal' | 'eat' | 'drink' | 'sleep' | 'combat';

/**
 * 空腹・渇き・疲れ（0〜100）。時間で増え、対応する行動で減る。
 * 「モンスターが自分の都合で動く」ことの源泉。値は data 駆動。
 */
export class MonsterNeeds {
  hunger: number;
  thirst: number;
  fatigue: number;

  constructor(private readonly cfg: NeedsConfig) {
    this.hunger = cfg.initialHunger;
    this.thirst = cfg.initialThirst;
    this.fatigue = cfg.initialFatigue;
  }

  get wantsToEat(): boolean {
    return this.hunger >= this.cfg.eatThreshold;
  }

  get wantsToDrink(): boolean {
    return this.thirst >= this.cfg.drinkThreshold;
  }

  get wantsToSleep(): boolean {
    return this.fatigue >= this.cfg.sleepThreshold;
  }

  update(dt: number, activity: NeedsActivity): void {
    const c = this.cfg;
    const fatigueRate = activity === 'combat' ? c.fatiguePerSecond * c.combatFatigueMultiplier : c.fatiguePerSecond;

    this.hunger = clamp(this.hunger + (activity === 'eat' ? -(100 / c.eatSeconds) : c.hungerPerSecond) * dt, 0, 100);
    this.thirst = clamp(this.thirst + (activity === 'drink' ? -(100 / c.drinkSeconds) : c.thirstPerSecond) * dt, 0, 100);
    this.fatigue = clamp(this.fatigue + (activity === 'sleep' ? -(100 / c.sleepSeconds) : fatigueRate) * dt, 0, 100);
  }

  reset(): void {
    this.hunger = this.cfg.initialHunger;
    this.thirst = this.cfg.initialThirst;
    this.fatigue = this.cfg.initialFatigue;
  }
}
