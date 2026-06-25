import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../main/events/bus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('step:completed', handler);
    bus.emit('step:completed', { stepId: 's1' });

    expect(handler).toHaveBeenCalledWith({ stepId: 's1' });
  });

  it('should support multiple handlers for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('step:moved', h1);
    bus.on('step:moved', h2);
    bus.emit('step:moved', { stepId: 's1', fromPhase: 'p1', toPhase: 'p2' });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should unsubscribe with off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('step:completed', handler);
    bus.off('step:completed', handler);
    bus.emit('step:completed', { stepId: 's1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not throw if handler errors', () => {
    const bus = new EventBus();
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();

    bus.on('step:completed', badHandler);
    bus.on('step:completed', goodHandler);

    expect(() => bus.emit('step:completed', { stepId: 's1' })).not.toThrow();
    expect(goodHandler).toHaveBeenCalled();
  });
});
