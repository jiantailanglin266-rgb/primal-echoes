import { describe, expect, it } from 'vitest';
import { MemorySaveStorage, SaveManager, createEmptySave } from '@core/save/SaveManager';

describe('SaveManager', () => {
  it('round-trips save data', () => {
    const storage = new MemorySaveStorage();
    const manager = new SaveManager(storage);
    expect(manager.load()).toBeNull();
    const data = createEmptySave();
    data.inventory.items['valgaron_scale'] = 4;
    data.crafting.weaponLevels['titan_blade'] = 1;
    data.questClears['vs01_hunt_valgaron'] = 2;
    data.settings.masterVolume = 0.3;
    manager.save(data);
    const loaded = manager.load()!;
    expect(loaded.inventory.items['valgaron_scale']).toBe(4);
    expect(loaded.crafting.weaponLevels['titan_blade']).toBe(1);
    expect(loaded.questClears['vs01_hunt_valgaron']).toBe(2);
    expect(loaded.settings.masterVolume).toBe(0.3);
    expect(loaded.savedAt).not.toBe(data.savedAt);
    expect(manager.hasSave()).toBe(true);
  });

  it('treats corrupt or foreign data as no save', () => {
    const storage = new MemorySaveStorage();
    const manager = new SaveManager(storage);
    storage.write('primal-echoes.save', '{not json');
    expect(manager.load()).toBeNull();
    storage.write('primal-echoes.save', JSON.stringify({ version: 99 }));
    expect(manager.load()).toBeNull();
    storage.write('primal-echoes.save', JSON.stringify({ version: 1, inventory: { items: { a: 'x' } }, settings: { masterVolume: 5 } }));
    const loaded = manager.load()!;
    expect(loaded.inventory.items).toEqual({});
    expect(loaded.settings.masterVolume).toBe(1);
  });

  it('clear removes the save', () => {
    const storage = new MemorySaveStorage();
    const manager = new SaveManager(storage);
    manager.save(createEmptySave());
    manager.clear();
    expect(manager.load()).toBeNull();
  });
});

describe('legacy item ids', () => {
  it('renames aether materials to echo materials and merges counts', () => {
    const storage = new MemorySaveStorage();
    storage.write('primal-echoes.save', JSON.stringify({ version: 1, inventory: { items: { aether_shard: 2, echo_shard: 1, aether_core: 1 } }, crafting: { weaponLevels: {} }, questClears: {}, equippedWeaponId: 'titan_blade', settings: { masterVolume: 0.5 }, savedAt: null }));
    const loaded = new SaveManager(storage).load();
    expect(loaded?.inventory.items).toEqual({ echo_shard: 3, echo_core: 1 });
  });
});
