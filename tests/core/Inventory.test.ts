import { describe, expect, it } from 'vitest';
import { Inventory } from '@core/inventory/Inventory';
import { mergeDrops, rollCarve, rollPartBreakRewards, rollQuestRewards } from '@core/inventory/LootTable';
import { CarveController } from '@core/inventory/CarveController';
import { PlayerController } from '@core/player/PlayerController';
import { PlayerStats } from '@core/player/PlayerStats';
import { createEmptyIntent } from '@core/player/PlayerIntent';
import { Carcass } from '@core/ecosystem/Carcass';
import { assertItemReferences, loadBalance, loadCreatures, loadItems, loadQuests, loadValgaron } from '@data/DataRegistry';
import { Random } from '@shared/rng/Random';
import { Vec3 } from '@shared/math/Vec3';
import type { HeightProvider } from '@core/world/Terrain';

const DT = 1 / 60;
const balance = loadBalance();
const flat: HeightProvider = { getHeight: () => 0 };

describe('Inventory', () => {
  it('adds, removes and snapshots', () => {
    const inv = new Inventory();
    inv.add('a', 2);
    inv.add('a');
    expect(inv.count('a')).toBe(3);
    expect(inv.remove('a', 5)).toBe(false);
    expect(inv.remove('a', 3)).toBe(true);
    expect(inv.count('a')).toBe(0);
    inv.add('b', 1);
    const snap = inv.toSnapshot();
    const other = new Inventory();
    other.loadSnapshot(snap);
    expect(other.entries()).toEqual([['b', 1]]);
  });
});

describe('LootTable', () => {
  const items = loadItems();
  const valgaron = loadValgaron();

  it('all referenced item ids exist in the catalog', () => {
    assertItemReferences(items, valgaron.carves.map((c) => c.itemId), 'valgaron.carves');
    assertItemReferences(items, valgaron.partBreakRewards.map((r) => r.itemId), 'valgaron.partBreakRewards');
    for (const c of loadCreatures().values()) assertItemReferences(items, c.carves.map((x) => x.itemId), `${c.id}.carves`);
    for (const q of loadQuests()) assertItemReferences(items, q.rewards.map((r) => r.itemId), `${q.id}.rewards`);
  });

  it('rollCarve follows the weights roughly', () => {
    const rng = new Random(42);
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const d = rollCarve(valgaron.carves, rng)!;
      counts.set(d.itemId, (counts.get(d.itemId) ?? 0) + 1);
    }
    const total = valgaron.carves.reduce((s, c) => s + c.weight, 0);
    for (const c of valgaron.carves) {
      const expected = (c.weight / total) * 4000;
      expect(counts.get(c.itemId) ?? 0).toBeGreaterThan(expected * 0.7);
      expect(counts.get(c.itemId) ?? 0).toBeLessThan(expected * 1.3 + 10);
    }
  });

  it('part break rewards only apply to broken parts', () => {
    const always = new Random(1);
    const drops = rollPartBreakRewards(valgaron.partBreakRewards, ['head'], always);
    expect(drops.some((d) => d.itemId === 'valgaron_horn')).toBe(true);
    expect(drops.some((d) => d.itemId === 'valgaron_tail')).toBe(false);
  });

  it('quest rewards with chance 1 always drop and merge counts', () => {
    const quest = loadQuests()[0]!;
    const drops = rollQuestRewards(quest.rewards, new Random(9));
    expect(drops.some((d) => d.itemId === 'valgaron_scale' && d.count === 2)).toBe(true);
    const merged = mergeDrops([
      { itemId: 'x', count: 1 },
      { itemId: 'x', count: 2 },
      { itemId: 'y', count: 1 },
    ]);
    expect(merged).toEqual([
      { itemId: 'x', count: 3 },
      { itemId: 'y', count: 1 },
    ]);
  });
});

describe('CarveController', () => {
  function setup() {
    const stats = new PlayerStats(balance.player);
    const player = new PlayerController(stats, flat, balance.player);
    const inventory = new Inventory();
    const valgaron = loadValgaron();
    const controller = new CarveController(
      player,
      inventory,
      new Random(3),
      (sourceId) => (sourceId === 'valgaron' ? valgaron.carves : null),
      balance.carve.durationSeconds,
      balance.carve.rangeMeters,
    );
    const carcass = new Carcass(1, 'valgaron', new Vec3(1.5, 0, 0), 100, 3, true);
    return { player, inventory, controller, carcass };
  }

  it('shows a prompt near a carcass and carves after the duration, locking the player', () => {
    const { player, inventory, controller, carcass } = setup();
    controller.update(DT, false, [carcass]);
    expect(controller.prompt.available).toBe(true);
    expect(controller.prompt.carvesRemaining).toBe(3);

    let result = controller.update(DT, true, [carcass]);
    expect(result).toBeNull();
    expect(player.state).toBe('interact');
    expect(player.canAct).toBe(false);

    const intent = createEmptyIntent();
    intent.move.set(0, 0, 1);
    const steps = Math.ceil(balance.carve.durationSeconds / DT) + 1;
    for (let i = 0; i < steps && !result; i++) {
      player.update(intent, DT);
      result = controller.update(DT, false, [carcass]);
    }
    expect(result).not.toBeNull();
    expect(result!.drop).not.toBeNull();
    expect(inventory.count(result!.drop!.itemId)).toBe(result!.drop!.count);
    expect(carcass.carvesRemaining).toBe(2);
    expect(player.position.z).toBeCloseTo(0, 3); // 拘束中は動けない
  });

  it('does not prompt when the carcass is out of range or exhausted', () => {
    const { controller, carcass } = setup();
    carcass.position.set(10, 0, 0);
    controller.update(DT, true, [carcass]);
    expect(controller.prompt.available).toBe(false);
    carcass.position.set(1, 0, 0);
    carcass.carvesRemaining = 0;
    controller.update(DT, true, [carcass]);
    expect(controller.prompt.available).toBe(false);
  });

  it('is interrupted when the player is hit', () => {
    const { player, controller, carcass } = setup();
    controller.update(DT, true, [carcass]);
    expect(controller.isCarving).toBe(true);
    player.applyHit(new Vec3(0, 0, -1), { distance: 1, durationSeconds: 0.3 });
    player.update(createEmptyIntent(), DT);
    controller.update(DT, false, [carcass]);
    expect(controller.isCarving).toBe(false);
    expect(carcass.carvesRemaining).toBe(3);
  });
});
