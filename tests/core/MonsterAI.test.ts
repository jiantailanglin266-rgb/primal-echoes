import { beforeEach, describe, expect, it } from 'vitest';
import { Monster } from '@core/monster/Monster';
import { MonsterAI, type MonsterAIContext, type MonsterAIState } from '@core/monster/MonsterAI';
import { MonsterPerception } from '@core/monster/MonsterPerception';
import { Field } from '@core/world/Field';
import { loadBalance, loadValgaron, loadVerdantTempest } from '@data/DataRegistry';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance().combat;
const def = loadValgaron();

function setup(seed = 1) {
  const field = new Field(loadVerdantTempest());
  const monster = new Monster('m', def, balance, field.terrain);
  const spawn = field.getPoi('feeding_forest');
  monster.teleport(spawn.position.x, spawn.position.z, 0);
  const ai = new MonsterAI(monster, new Random(seed));
  // フィールド外の遠方。ベースキャンプ(0,-6)に置くと、巣へ向かう経路が視界に入り本当に発見される。
  const subject = { position: new Vec3(400, 0, 400), isNoisy: false };
  const ctx: MonsterAIContext = { field, subject };
  return { field, monster, ai, ctx };
}

function run(setupResult: ReturnType<typeof setup>, seconds: number, onStep?: (t: number) => void): MonsterAIState[] {
  const { monster, ai, ctx } = setupResult;
  const visited: MonsterAIState[] = [ai.state];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    onStep?.(i * DT);
    const change = ai.update(DT, ctx);
    monster.update(DT, ctx.subject.position);
    if (change) visited.push(change.to);
  }
  return visited;
}

describe('MonsterAI ecology layer', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup();
  });

  it('lives its own life when the player is far away: eats, drinks, travels', () => {
    // 初期空腹 55 -> 60 で餌場へ。渇き 20 -> 60 は約 30 秒
    const visited = run(s, 120);
    expect(visited).toContain('eat');
    expect(visited).toContain('drink');
    expect(visited).toContain('travel');
    expect(visited).not.toContain('combat');
    expect(s.ai.perception.detected).toBe(false);
  });

  it('eating restores stamina (exhaustion recovery path)', () => {
    s.monster.stats.stamina = 0;
    s.ai.needs.hunger = 100;
    run(s, def.behavior.needs.eatSeconds + 2);
    expect(s.monster.stats.stamina).toBeGreaterThan(def.behavior.needs.eatRestoresStamina * 0.8);
  });

  it('goes to the nest to sleep when tired and recovers hp', () => {
    s.ai.needs.fatigue = 100;
    s.ai.needs.hunger = 0;
    s.ai.needs.thirst = 0;
    s.monster.stats.hp = def.stats.maxHp * 0.5;
    const visited = run(s, 90);
    expect(visited).toContain('sleep');
    const nest = s.field.getPoi('nest_cave');
    expect(s.monster.position.horizontalDistanceTo(nest.position)).toBeLessThan(def.behavior.arriveDistance + 0.5);
    expect(s.monster.stats.hp).toBeGreaterThan(def.stats.maxHp * 0.5);
  });

  it('spots a player who walks into view, alerts, then fights', () => {
    s.ctx.subject.position.set(s.monster.position.x, 0, s.monster.position.z + 10); // 正面 10m
    const visited = run(s, 4);
    expect(visited).toContain('alert');
    expect(visited).toContain('combat');
  });

  it('does not notice a quiet player behind it beyond hearing range, but hears a noisy one', () => {
    // 生態層は移動で向きを変えるため、知覚単体で検証する
    const perception = new MonsterPerception(def.behavior.perception);
    const m = s.monster;
    const behind = { position: new Vec3(m.position.x, 0, m.position.z - 12), isNoisy: false }; // 背後 12m（静か: 聴覚 7m）
    expect(perception.update(DT, m, behind, false)).toBe(false);
    behind.isNoisy = true; // 走ると 14m まで聞こえる
    expect(perception.update(DT, m, behind, false)).toBe(true);
    // 睡眠中は感覚が鈍る（14 × 0.3 = 4.2m）
    const asleep = new MonsterPerception(def.behavior.perception);
    expect(asleep.update(DT, m, behind, true)).toBe(false);
  });

  it('wakes up and fights when attacked while sleeping', () => {
    s.ai.needs.fatigue = 100;
    s.ai.needs.hunger = 0;
    s.ai.needs.thirst = 0;
    run(s, 80);
    expect(s.ai.state).toBe('sleep');
    s.ai.notifyAttacked(new Vec3(s.monster.position.x, 0, s.monster.position.z + 5));
    expect(s.ai.state).toBe('combat');
  });

  it('investigates the last known position after losing the player, then returns to ecology', () => {
    s.ctx.subject.position.set(s.monster.position.x, 0, s.monster.position.z + 8);
    run(s, 3);
    expect(s.ai.state).toBe('combat');
    // 遠くへワープ（見失い範囲外）
    s.ctx.subject.position.set(150, 0, -150);
    const visited = run(s, def.behavior.perception.loseTargetSeconds + def.behavior.investigateSeconds + 20);
    expect(visited).toContain('investigate');
    expect(s.ai.isInEcology).toBe(true);
    expect(s.ai.perception.detected).toBe(false);
  });

  it('flees to the nest at low hp and sleeps there', () => {
    s.ctx.subject.position.set(s.monster.position.x, 0, s.monster.position.z + 8);
    run(s, 3);
    s.monster.stats.hp = def.stats.maxHp * def.behavior.fleeHpRatio * 0.9;
    const visited = run(s, 60, () => {
      // プレイヤーは追わない（その場に留まる）
    });
    expect(visited).toContain('flee');
    expect(visited).toContain('sleep');
    const nest = s.field.getPoi('nest_cave');
    expect(s.monster.position.horizontalDistanceTo(nest.position)).toBeLessThan(def.behavior.arriveDistance + 0.5);
  });

  it('transitions to dead when killed', () => {
    s.monster.stats.takeDamage(s.monster.stats.maxHp);
    run(s, 1);
    expect(s.ai.state).toBe('dead');
  });
});
