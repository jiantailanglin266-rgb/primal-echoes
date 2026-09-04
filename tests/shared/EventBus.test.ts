import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@shared/events/EventBus';

type TestEvents = {
  hit: { damage: number };
  died: undefined;
};

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('hit', listener);
    bus.emit('hit', { damage: 42 });
    expect(listener).toHaveBeenCalledWith({ damage: 42 });
  });

  it('unsubscribes via returned disposer and off()', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    const disposeA = bus.on('hit', a);
    bus.on('hit', b);
    disposeA();
    bus.off('hit', b);
    bus.emit('hit', { damage: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(bus.listenerCount('hit')).toBe(0);
  });

  it('once fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.once('died', listener);
    bus.emit('died', undefined);
    bus.emit('died', undefined);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is safe to unsubscribe during emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const first = vi.fn(() => bus.off('hit', second));
    bus.on('hit', first);
    bus.on('hit', second);
    expect(() => bus.emit('hit', { damage: 1 })).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
  });
});
