import { beforeEach, describe, expect, it } from 'vitest';
import { QuestManager } from '@core/quest/QuestManager';
import { loadBalance, loadQuests } from '@data/DataRegistry';

const DT = 1 / 60;
const balance = loadBalance().quest;
const def = loadQuests()[0]!;

function run(q: QuestManager, seconds: number): { changed: number; respawns: number } {
  let changed = 0;
  let respawns = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = q.update(DT);
    if (r.changed) changed++;
    if (r.respawnNow) respawns++;
  }
  return { changed, respawns };
}

describe('QuestManager', () => {
  let quest: QuestManager;

  beforeEach(() => {
    quest = new QuestManager(def, balance);
    quest.start();
  });

  it('starts active with the full time limit', () => {
    expect(quest.state).toBe('active');
    expect(quest.timeRemaining).toBeCloseTo(def.timeLimitSeconds);
    expect(quest.objectiveText).toContain('討伐');
  });

  it('completes after the target dies and the return delay passes', () => {
    run(quest, 10);
    quest.notifyMonsterDied('valgaron');
    expect(quest.state).toBe('returning');
    expect(quest.clearTimeSeconds).toBeCloseTo(10, 0);
    const r = run(quest, def.returnDelaySeconds + DT);
    expect(quest.state).toBe('completed');
    expect(r.changed).toBe(1);
  });

  it('ignores deaths of non-target monsters', () => {
    quest.notifyMonsterDied('other');
    expect(quest.state).toBe('active');
  });

  it('fails when the time limit expires', () => {
    quest.elapsed = def.timeLimitSeconds - 1;
    run(quest, 1.1);
    expect(quest.state).toBe('failed');
    expect(quest.failReason).toBe('timeLimit');
    expect(quest.isRunning).toBe(false);
  });

  it('schedules a respawn on down and fails at max downs', () => {
    quest.notifyPlayerDowned();
    expect(quest.downs).toBe(1);
    expect(quest.isPlayerDown).toBe(true);
    const r = run(quest, balance.respawnDelaySeconds + DT);
    expect(r.respawns).toBe(1);
    expect(quest.isPlayerDown).toBe(false);

    for (let i = quest.downs; i < def.maxDowns; i++) quest.notifyPlayerDowned();
    expect(quest.state).toBe('failed');
    expect(quest.failReason).toBe('downs');
  });

  it('records broken parts once each', () => {
    quest.notifyPartBroken('head');
    quest.notifyPartBroken('head');
    quest.notifyPartBroken('tail');
    expect(quest.brokenPartIds).toEqual(['head', 'tail']);
  });

  it('warns when time is running low', () => {
    expect(quest.isTimeWarning).toBe(false);
    quest.elapsed = def.timeLimitSeconds - balance.timeWarningSeconds + 1;
    expect(quest.isTimeWarning).toBe(true);
  });

  it('abandon fails the quest without a reason', () => {
    quest.abandon();
    expect(quest.state).toBe('failed');
    expect(quest.failReason).toBeNull();
  });
});
