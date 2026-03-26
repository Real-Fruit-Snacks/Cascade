import { describe, it, expect, vi, afterEach } from 'vitest';
import { emit, on } from './cascade-events';

// cascade-events dispatches on `window`, which is available in jsdom.

afterEach(() => {
  // No persistent state; window listeners are cleaned up by each test's
  // unsubscribe call or fall out of scope naturally.
});

describe('on()', () => {
  it('subscribes and receives a void event', () => {
    const handler = vi.fn();
    const unsub = on('cascade:new-file', handler);
    emit('cascade:new-file');
    expect(handler).toHaveBeenCalledOnce();
    unsub();
  });

  it('receives the detail payload for events with data', () => {
    const handler = vi.fn();
    const unsub = on('cascade:sidebar-view', handler);
    emit('cascade:sidebar-view', 'files');
    expect(handler).toHaveBeenCalledWith('files');
    unsub();
  });

  it('receives object payload correctly', () => {
    const handler = vi.fn();
    const unsub = on('cascade:reveal-in-tree', handler);
    emit('cascade:reveal-in-tree', { path: '/notes/hello.md' });
    expect(handler).toHaveBeenCalledWith({ path: '/notes/hello.md' });
    unsub();
  });

  it('returns a cleanup function that unsubscribes the handler', () => {
    const handler = vi.fn();
    const unsub = on('cascade:export', handler);
    unsub();
    emit('cascade:export');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not receive events emitted before subscribing', () => {
    const handler = vi.fn();
    emit('cascade:import');
    const unsub = on('cascade:import', handler);
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });
});

describe('emit()', () => {
  it('delivers to all active subscribers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = on('cascade:about', h1);
    const unsub2 = on('cascade:about', h2);
    emit('cascade:about');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    unsub1();
    unsub2();
  });

  it('delivers the same payload to multiple subscribers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = on('cascade:open-file', h1);
    const unsub2 = on('cascade:open-file', h2);
    emit('cascade:open-file', { path: '/a.md' });
    expect(h1).toHaveBeenCalledWith({ path: '/a.md' });
    expect(h2).toHaveBeenCalledWith({ path: '/a.md' });
    unsub1();
    unsub2();
  });

  it('does not deliver to a subscriber for a different event name', () => {
    const handler = vi.fn();
    const unsub = on('cascade:close-vault', handler);
    emit('cascade:new-file');
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it('can emit the same event multiple times', () => {
    const handler = vi.fn();
    const unsub = on('cascade:fs-change', handler);
    emit('cascade:fs-change');
    emit('cascade:fs-change');
    emit('cascade:fs-change');
    expect(handler).toHaveBeenCalledTimes(3);
    unsub();
  });
});

describe('on() unsubscribe', () => {
  it('unsubscribing one handler does not affect other handlers on the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = on('cascade:vault-changed', h1);
    const unsub2 = on('cascade:vault-changed', h2);
    unsub1();
    emit('cascade:vault-changed');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
    unsub2();
  });

  it('calling unsubscribe twice does not throw', () => {
    const unsub = on('cascade:open-settings', vi.fn());
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});
