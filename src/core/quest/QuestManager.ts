import type { QuestDefinition } from '@data/schemas/quest';
import type { QuestBalance } from '@data/schemas/balance';

export type QuestState = 'inactive' | 'active' | 'returning' | 'completed' | 'failed';
export type QuestFailReason = 'timeLimit' | 'downs' | null;

export interface QuestTickResult {
  /** このステップで状態が変わったか。 */
  changed: boolean;
  /** 戦闘不能から復帰すべきタイミング。 */
  respawnNow: boolean;
}

/**
 * クエスト 1 本の進行。時間・力尽き回数・目標達成を管理する。
 * 討伐後は「帰還猶予（剥ぎ取り時間）」を挟んでから完了にする。
 * 世界の状態（モンスターの死亡など）は通知で受け取り、自分では覗かない。
 */
export class QuestManager {
  state: QuestState = 'inactive';
  elapsed = 0;
  downs = 0;
  failReason: QuestFailReason = null;
  /** 討伐から帰還までの残り秒。 */
  returnRemaining = 0;
  /** 戦闘不能中の復帰カウントダウン。 */
  respawnRemaining = 0;
  /** 討伐までにかかった秒数（完了時に確定）。 */
  clearTimeSeconds = 0;
  brokenPartIds: string[] = [];

  private readonly result: QuestTickResult = { changed: false, respawnNow: false };

  constructor(
    readonly def: QuestDefinition,
    private readonly balance: QuestBalance,
  ) {}

  get isRunning(): boolean {
    return this.state === 'active' || this.state === 'returning';
  }

  get timeRemaining(): number {
    return Math.max(0, this.def.timeLimitSeconds - this.elapsed);
  }

  get isTimeWarning(): boolean {
    return this.isRunning && this.timeRemaining <= this.balance.timeWarningSeconds;
  }

  get isPlayerDown(): boolean {
    return this.respawnRemaining > 0;
  }

  get objectiveText(): string {
    switch (this.state) {
      case 'active':
        return `${this.def.target.monsterId === 'valgaron' ? 'ヴァルガロン' : this.def.target.monsterId} を討伐せよ`;
      case 'returning':
        return `討伐完了。帰還まで ${Math.ceil(this.returnRemaining)} 秒（剥ぎ取り可能）`;
      case 'completed':
        return 'クエスト達成';
      case 'failed':
        return 'クエスト失敗';
      default:
        return '';
    }
  }

  start(): void {
    this.state = 'active';
    this.elapsed = 0;
    this.downs = 0;
    this.failReason = null;
    this.returnRemaining = 0;
    this.respawnRemaining = 0;
    this.clearTimeSeconds = 0;
    this.brokenPartIds = [];
  }

  /** 目標モンスター討伐の通知。 */
  notifyMonsterDied(monsterId: string): void {
    if (this.state !== 'active') return;
    if (monsterId !== this.def.target.monsterId) return;
    this.state = 'returning';
    this.clearTimeSeconds = this.elapsed;
    this.returnRemaining = this.def.returnDelaySeconds;
  }

  notifyPartBroken(partId: string): void {
    if (!this.isRunning) return;
    if (!this.brokenPartIds.includes(partId)) this.brokenPartIds.push(partId);
  }

  /** 戦闘不能の通知。規定回数で失敗、そうでなければ復帰カウント開始。 */
  notifyPlayerDowned(): void {
    if (this.state !== 'active') return;
    this.downs += 1;
    if (this.downs >= this.def.maxDowns) {
      this.fail('downs');
      return;
    }
    this.respawnRemaining = this.balance.respawnDelaySeconds;
  }

  /** 途中帰還（拠点へ戻る）。 */
  abandon(): void {
    if (this.isRunning) this.fail(null);
  }

  update(dt: number): QuestTickResult {
    const r = this.result;
    r.changed = false;
    r.respawnNow = false;
    if (!this.isRunning) return r;

    this.elapsed += dt;

    if (this.respawnRemaining > 0) {
      this.respawnRemaining -= dt;
      if (this.respawnRemaining <= 0) {
        this.respawnRemaining = 0;
        r.respawnNow = true;
      }
    }

    if (this.state === 'active' && this.elapsed >= this.def.timeLimitSeconds) {
      this.fail('timeLimit');
      r.changed = true;
      return r;
    }

    if (this.state === 'returning') {
      this.returnRemaining -= dt;
      if (this.returnRemaining <= 0) {
        this.state = 'completed';
        r.changed = true;
      }
    }
    return r;
  }

  reset(): void {
    this.state = 'inactive';
    this.elapsed = 0;
    this.downs = 0;
    this.failReason = null;
    this.returnRemaining = 0;
    this.respawnRemaining = 0;
    this.brokenPartIds = [];
  }

  private fail(reason: QuestFailReason): void {
    this.state = 'failed';
    this.failReason = reason;
    this.respawnRemaining = 0;
  }
}
