import { describe, expect, it, vi } from 'vitest';
import { Weather } from '@core/world/Weather';
import { GimmickManager } from '@core/world/GimmickManager';
import { Field } from '@core/world/Field';
import { Monster } from '@core/monster/Monster';
import { MonsterAI, type MonsterAIContext } from '@core/monster/MonsterAI';
import { loadBalance, loadValgaron, loadVerdantTempest } from '@data/DataRegistry';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance();
const fieldDef = loadVerdantTempest();

describe('Weather', () => {
  it('alternates clear and rain within configured durations and ramps intensity', () => {
    const weather = new Weather(fieldDef.weather, new Random(2));
    expect(weather.isRaining).toBe(false);
    let changes = 0;
    let elapsed = 0;
    while (changes < 2 && elapsed < 2000) {
      if (weather.update(DT)) changes++;
      elapsed += DT;
    }
    expect(changes).toBe(2);
    expect(elapsed).toBeGreaterThan(fieldDef.weather.clearMinSeconds + fieldDef.weather.rainMinSeconds);
    weather.force('rain');
    for (let i = 0; i < 60 * 5; i++) weather.update(DT);
    expect(weather.intensity).toBeGreaterThan(0.7);
    expect(weather.senseMultiplier).toBe(fieldDef.weather.rainSenseMultiplier);
  });
});

describe('GimmickManager (rockfall)', () => {
  function setup() {
    const field = new Field(fieldDef);
    const monster = new Monster('m', loadValgaron(), balance.combat, field.terrain);
    const hooks = { onTriggered: vi.fn(), onImpact: vi.fn() };
    const gimmicks = new GimmickManager(fieldDef.gimmicks, (x, z) => field.terrain.getHeight(x, z), hooks);
    const rock = gimmicks.gimmicks[0]!;
    return { field, monster, gimmicks, rock, hooks };
  }

  it('prompts within trigger radius, then topples a monster inside the impact radius after the delay', () => {
    const { monster, gimmicks, rock, hooks } = setup();
    const player = new Vec3(rock.position.x + 1, 0, rock.position.z);
    monster.teleport(rock.position.x + 2, rock.position.z + 1, 0);
    gimmicks.update(DT, player, false, [monster]);
    expect(gimmicks.prompt.available).toBe(true);
    expect(gimmicks.update(DT, player, true, [monster])).toBe(true);
    expect(hooks.onTriggered).toHaveBeenCalledTimes(1);
    expect(rock.usesLeft).toBe(0);
    const hpBefore = monster.stats.hp;
    for (let i = 0; i < Math.ceil(rock.def.delaySeconds / DT) + 1; i++) gimmicks.update(DT, player, false, [monster]);
    expect(hooks.onImpact).toHaveBeenCalledTimes(1);
    expect(monster.stats.hp).toBe(hpBefore - rock.def.damage);
    expect(monster.combat.state).toBe('toppled');
    // 使い切ったので再操作できない
    gimmicks.update(DT, player, true, [monster]);
    expect(gimmicks.prompt.available).toBe(false);
  });

  it('misses a monster outside the impact radius', () => {
    const { monster, gimmicks, rock, hooks } = setup();
    const player = new Vec3(rock.position.x, 0, rock.position.z);
    monster.teleport(rock.position.x + 30, rock.position.z, 0);
    gimmicks.update(DT, player, true, [monster]);
    for (let i = 0; i < Math.ceil(rock.def.delaySeconds / DT) + 1; i++) gimmicks.update(DT, player, false, [monster]);
    expect(hooks.onImpact).toHaveBeenCalledWith(expect.objectContaining({ hitMonsterIds: [] }));
    expect(monster.stats.hp).toBe(monster.stats.maxHp);
  });
});

describe('MonsterAI shelters from rain', () => {
  it('travels to the nest when it rains and stays there until it clears', () => {
    const field = new Field(fieldDef);
    const monster = new Monster('m', loadValgaron(), balance.combat, field.terrain);
    const spawn = field.getPoi('feeding_forest');
    monster.teleport(spawn.position.x, spawn.position.z, 0);
    const ai = new MonsterAI(monster, new Random(4));
    ai.needs.hunger = 0;
    ai.needs.thirst = 0;
    ai.needs.fatigue = 0;
    const weather = { isRaining: true, senseMultiplier: 0.7 };
    const ctx: MonsterAIContext = { field, subject: { position: new Vec3(400, 0, 400), isNoisy: false }, weather };
    for (let i = 0; i < 60 * 120; i++) {
      // 満腹・満水のまま（欲求で巣を離れないことを確認したい）
      ai.needs.hunger = 0;
      ai.needs.thirst = 0;
      ai.needs.fatigue = 0;
      ai.update(DT, ctx);
      monster.update(DT, ctx.subject.position);
    }
    const nest = field.getPoi('nest_cave');
    expect(monster.position.horizontalDistanceTo(nest.position)).toBeLessThan(monster.def.behavior.arriveDistance * 2 + 0.5);
    expect(ai.state).toBe('idle');
    expect(ai.goalLabel).toBe('shelter');

    weather.isRaining = false;
    let left = false;
    for (let i = 0; i < 60 * 60 && !left; i++) {
      ai.needs.hunger = 0;
      ai.needs.thirst = 0;
      ai.needs.fatigue = 0;
      ai.update(DT, ctx);
      monster.update(DT, ctx.subject.position);
      left = ai.state === 'travel';
    }
    expect(left).toBe(true);
  });
});
