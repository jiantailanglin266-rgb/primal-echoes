import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EcosystemManager, type EcosystemEventSink } from '@core/ecosystem/EcosystemManager';
import { Field } from '@core/world/Field';
import { Monster } from '@core/monster/Monster';
import { MonsterAI, type MonsterAIContext } from '@core/monster/MonsterAI';
import { loadBalance, loadCreatures, loadValgaron, loadVerdantTempest } from '@data/DataRegistry';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';

const DT = 1 / 60;
const balance = loadBalance();
const creatureDefs = loadCreatures();

function setup(seed = 1) {
  const field = new Field(loadVerdantTempest());
  const sink: EcosystemEventSink = { creatureKilled: vi.fn(), carcassSpawned: vi.fn() };
  const eco = new EcosystemManager(field, creatureDefs, new Random(seed), sink);
  eco.spawnAll();
  const far = new Vec3(400, 0, 400);
  const ctx = { player: { position: far, isNoisy: false }, monsters: [] as { position: Vec3; isAlive: boolean }[] };
  return { field, eco, sink, ctx };
}

function run(s: ReturnType<typeof setup>, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) s.eco.update(DT, s.ctx);
}

describe('EcosystemManager', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup();
  });

  it('spawns herds and singles according to the field definition', () => {
    const grasts = s.eco.creatures.filter((c) => c.def.id === 'grast');
    const skarvs = s.eco.creatures.filter((c) => c.def.id === 'skarv');
    expect(grasts.length).toBe(2 * creatureDefs.get('grast')!.herdSize);
    expect(skarvs.length).toBe(3);
    expect(new Set(grasts.map((g) => g.herdId)).size).toBe(2);
  });

  it('herbivores wander around their home when undisturbed', () => {
    const grast = s.eco.creatures.find((c) => c.def.id === 'grast')!;
    run(s, 30);
    expect(grast.isAlive).toBe(true);
    expect(grast.position.horizontalDistanceTo(grast.home)).toBeLessThan(grast.def.wanderRadius + grast.def.herdSpacing * 3);
    expect(['graze', 'wander']).toContain(grast.state);
  });

  it('a herd flees from a noisy player and calms down after it leaves', () => {
    const herd = s.eco.creatures.filter((c) => c.def.id === 'grast' && c.herdId === 1);
    const leader = herd[0]!;
    s.ctx.player.position.set(leader.position.x + 8, 0, leader.position.z);
    s.ctx.player.isNoisy = true;
    run(s, 1);
    expect(herd.every((c) => c.state === 'flee')).toBe(true);
    const distAfter = leader.position.horizontalDistanceTo(s.ctx.player.position);
    expect(distAfter).toBeGreaterThan(8);

    s.ctx.player.position.set(400, 0, 400);
    run(s, leader.def.calmSeconds + 2);
    expect(herd.every((c) => c.state !== 'flee')).toBe(true);
  });

  it('a quiet player can approach closer than a noisy one', () => {
    const grast = s.eco.creatures.find((c) => c.def.id === 'grast' && c.herdIndex === 0)!;
    s.ctx.player.position.set(grast.position.x + grast.def.fleeRangePlayer * 0.7, 0, grast.position.z);
    s.ctx.player.isNoisy = false;
    run(s, 0.5);
    expect(grast.state).not.toBe('flee');
    s.ctx.player.isNoisy = true;
    run(s, 0.5);
    expect(grast.state).toBe('flee');
  });

  it('scavengers gather at a carcass and consume it', () => {
    const skarv = s.eco.creatures.find((c) => c.def.id === 'skarv')!;
    const carcass = s.eco.addCarcass('grast', new Vec3(skarv.position.x + 20, 0, skarv.position.z), 40, 1, false);
    run(s, 12);
    expect(['approachCarcass', 'feed']).toContain(skarv.state);
    run(s, 60);
    expect(carcass.meatSeconds).toBeLessThan(40);
    // 3 匹が食べ続ければ 40 秒ぶんの肉は 60 秒で尽きる
    expect(s.eco.carcasses.includes(carcass)).toBe(false);
  });

  it('player damage kills a creature and leaves a carcass', () => {
    const grast = s.eco.creatures.find((c) => c.def.id === 'grast')!;
    expect(s.eco.damageCreature(grast, grast.def.maxHp - 1)).toBe(false);
    expect(grast.state).toBe('flee');
    expect(s.eco.damageCreature(grast, 5)).toBe(true);
    expect(grast.isAlive).toBe(false);
    expect(s.sink.creatureKilled).toHaveBeenCalledWith(grast, 'player');
    expect(s.eco.carcasses.length).toBe(1);
    expect(s.eco.carcasses[0]!.carvesRemaining).toBe(1);
  });

  it('persistent carcasses stay even after their meat is gone', () => {
    const carcass = s.eco.addCarcass('valgaron', new Vec3(), 10, 3, true);
    carcass.feed(999);
    run(s, 1);
    expect(s.eco.carcasses.includes(carcass)).toBe(true);
  });
});

describe('Valgaron hunts prey', () => {
  it('kills a nearby grast when arriving hungry at the feeding ground, then eats', () => {
    const s = setup(3);
    const monster = new Monster('m', loadValgaron(), balance.combat, s.field.terrain);
    const feeding = s.field.getPoi('feeding_forest');
    // 餌場の少し外に置き、空腹で餌場へ向かわせる
    monster.teleport(feeding.position.x - 12, feeding.position.z, Math.PI / 2);
    const ai = new MonsterAI(monster, new Random(5));
    ai.needs.hunger = 100;
    const ctx: MonsterAIContext = { field: s.field, subject: { position: new Vec3(400, 0, 400), isNoisy: false }, prey: s.eco };
    s.ctx.monsters.push(monster);

    const states = new Set<string>();
    for (let i = 0; i < 60 * 40; i++) {
      const change = ai.update(DT, ctx);
      if (change) states.add(change.to);
      monster.update(DT, ctx.subject.position);
      s.eco.update(DT, s.ctx);
      if (ai.state === 'eat') break;
    }
    expect(states.has('hunt')).toBe(true);
    expect(ai.state).toBe('eat');
    const dead = s.eco.creatures.filter((c) => !c.isAlive);
    expect(dead.length).toBe(1);
    expect(s.sink.creatureKilled).toHaveBeenCalledWith(dead[0], 'monster');
    expect(s.eco.carcasses.length).toBe(1);
  });
});
