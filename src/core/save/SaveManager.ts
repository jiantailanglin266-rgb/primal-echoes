import type { InventorySnapshot } from '@core/inventory/Inventory';
import type { CraftingProgress } from '@core/crafting/CraftingManager';

export const SAVE_VERSION = 1 as const;

export interface SaveSettings {
  masterVolume: number;
}

export interface SaveDataV1 {
  version: typeof SAVE_VERSION;
  savedAt: string;
  inventory: InventorySnapshot;
  crafting: CraftingProgress;
  /** クエスト id -> クリア回数。 */
  questClears: Record<string, number>;
  /** 装備中の武器 id。 */
  equippedWeaponId: string;
  settings: SaveSettings;
}

export type SaveData = SaveDataV1;

/** 保存先の抽象。ブラウザでは localStorage、テストではメモリ。 */
export interface SaveStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemorySaveStorage implements SaveStorage {
  private readonly map = new Map<string, string>();
  read(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export class LocalStorageSaveStorage implements SaveStorage {
  read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  write(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 容量超過やプライベートモードでは保存できない。ゲームは続行させる。
    }
  }
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 同上
    }
  }
}

export function createEmptySave(): SaveDataV1 {
  return {
    version: SAVE_VERSION,
    savedAt: new Date(0).toISOString(),
    inventory: { items: {} },
    crafting: { weaponLevels: {} },
    questClears: {},
    equippedWeaponId: 'titan_blade',
    settings: { masterVolume: 0.6 },
  };
}

/**
 * セーブデータの読み書き。壊れたデータは「無い」扱いにしてゲームを止めない。
 * バージョンが上がったら migrate() に変換を追加する。
 */
export class SaveManager {
  constructor(
    private readonly storage: SaveStorage,
    private readonly key = 'primal-echoes.save',
  ) {}

  load(): SaveData | null {
    const raw = this.storage.read(this.key);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return migrate(parsed);
    } catch {
      return null;
    }
  }

  save(data: SaveData): void {
    this.storage.write(this.key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  }

  clear(): void {
    this.storage.remove(this.key);
  }

  hasSave(): boolean {
    return this.storage.read(this.key) !== null;
  }
}

function migrate(parsed: unknown): SaveData | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Partial<SaveDataV1> & { version?: number };
  if (obj.version !== SAVE_VERSION) return null;
  const base = createEmptySave();
  return {
    version: SAVE_VERSION,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : base.savedAt,
    inventory: isRecordOfNumbers(obj.inventory?.items) ? { items: migrateItemIds(obj.inventory.items) } : base.inventory,
    crafting: isRecordOfNumbers(obj.crafting?.weaponLevels) ? { weaponLevels: obj.crafting.weaponLevels } : base.crafting,
    questClears: isRecordOfNumbers(obj.questClears) ? obj.questClears : base.questClears,
    equippedWeaponId: typeof obj.equippedWeaponId === 'string' ? obj.equippedWeaponId : base.equippedWeaponId,
    settings: {
      masterVolume: typeof obj.settings?.masterVolume === 'number' ? clamp01(obj.settings.masterVolume) : base.settings.masterVolume,
    },
  };
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'number' && Number.isFinite(v));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** 改名前の素材 id（エーテル → 残響）を新 id に読み替える。同じ新 id があれば合算する。 */
const LEGACY_ITEM_IDS: Record<string, string> = { aether_shard: 'echo_shard', aether_core: 'echo_core' };

function migrateItemIds(items: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(items)) {
    const next = LEGACY_ITEM_IDS[id] ?? id;
    out[next] = (out[next] ?? 0) + n;
  }
  return out;
}
