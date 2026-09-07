import { describe, expect, it } from 'vitest';
import { GameLoop } from '@app/GameLoop';
import { HitStop } from '@app/HitStop';

/** Hit Stop とスローモーションの時間スケールが衝突しないことを確認する（Juice の applyTimeScale と同じ手順）。 */
describe('HitStop restore scale', () => {
  it('restores to the scale set during the stop, not the one captured at trigger', () => {
    const loop = new GameLoop({ update: () => {}, render: () => {} });
    const hitStop = new HitStop(loop);
    hitStop.trigger(0.1);
    expect(loop.timeScale).toBe(0);
    // Hit Stop 中にスローが始まった
    hitStop.setRestoreTimeScale(0.3);
    hitStop.update(0.05);
    expect(loop.timeScale).toBe(0);
    hitStop.update(0.06);
    expect(loop.timeScale).toBe(0.3);
  });
});
