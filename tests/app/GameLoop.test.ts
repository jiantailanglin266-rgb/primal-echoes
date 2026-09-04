import { describe, expect, it, vi } from 'vitest';
import { GameLoop } from '@app/GameLoop';

const FIXED = 1 / 60;

function makeLoop(overrides: Partial<{ maxSubStepsPerFrame: number; maxFrameDeltaSeconds: number }> = {}) {
  const update = vi.fn();
  const render = vi.fn();
  const loop = new GameLoop({ update, render }, { fixedDeltaSeconds: FIXED, ...overrides });
  return { loop, update, render };
}

describe('GameLoop (fixed timestep)', () => {
  it('runs exactly one update per fixed delta and renders once per frame', () => {
    const { loop, update, render } = makeLoop();
    const steps = loop.advance(FIXED);
    expect(steps).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(FIXED);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('accumulates partial frames until a full step is available', () => {
    const { loop, update } = makeLoop();
    loop.advance(FIXED * 0.4);
    expect(update).not.toHaveBeenCalled();
    loop.advance(FIXED * 0.7);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('runs multiple updates for a long frame', () => {
    const { loop, update } = makeLoop();
    loop.advance(FIXED * 3.5);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('caps sub steps and discards the backlog to avoid a death spiral', () => {
    const { loop, update } = makeLoop({ maxSubStepsPerFrame: 5, maxFrameDeltaSeconds: 10 });
    loop.advance(FIXED * 50);
    expect(update).toHaveBeenCalledTimes(5);
    // 次のフレームは正常に 1 ステップだけ進む（溜まった遅れを引きずらない）
    update.mockClear();
    loop.advance(FIXED);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('passes interpolation alpha in [0,1) to render', () => {
    const { loop, render } = makeLoop();
    loop.advance(FIXED * 1.5);
    const [alpha] = render.mock.calls[0] as [number, number];
    expect(alpha).toBeCloseTo(0.5);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('applies timeScale to simulation dt (hit stop)', () => {
    const { loop, update } = makeLoop();
    loop.timeScale = 0;
    loop.advance(FIXED);
    expect(update).toHaveBeenCalledWith(0);
    expect(loop.simulationTime).toBe(0);
    loop.timeScale = 0.5;
    loop.advance(FIXED);
    expect(update).toHaveBeenLastCalledWith(FIXED * 0.5);
  });

  it('ignores negative frame deltas', () => {
    const { loop, update } = makeLoop();
    loop.advance(-1);
    expect(update).not.toHaveBeenCalled();
  });
});
