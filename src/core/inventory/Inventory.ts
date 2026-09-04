/**
 * 所持品。id -> 個数 の単純な帳簿。
 * アイテムの意味（名前・希少度）は data 側にあり、ここは数だけを扱う。
 */
export interface InventorySnapshot {
  items: Record<string, number>;
}

export class Inventory {
  private readonly counts = new Map<string, number>();

  count(itemId: string): number {
    return this.counts.get(itemId) ?? 0;
  }

  has(itemId: string, amount = 1): boolean {
    return this.count(itemId) >= amount;
  }

  add(itemId: string, amount = 1): number {
    if (amount <= 0) return this.count(itemId);
    const next = this.count(itemId) + amount;
    this.counts.set(itemId, next);
    return next;
  }

  /** 足りなければ何も減らさず false。 */
  remove(itemId: string, amount = 1): boolean {
    if (!this.has(itemId, amount)) return false;
    const next = this.count(itemId) - amount;
    if (next === 0) this.counts.delete(itemId);
    else this.counts.set(itemId, next);
    return true;
  }

  /** 表示・保存用。個数 0 のものは含まない。 */
  entries(): [string, number][] {
    return [...this.counts.entries()].filter(([, n]) => n > 0);
  }

  toSnapshot(): InventorySnapshot {
    return { items: Object.fromEntries(this.entries()) };
  }

  loadSnapshot(snapshot: InventorySnapshot): void {
    this.counts.clear();
    for (const [id, n] of Object.entries(snapshot.items)) {
      if (Number.isFinite(n) && n > 0) this.counts.set(id, Math.floor(n));
    }
  }

  clear(): void {
    this.counts.clear();
  }
}
