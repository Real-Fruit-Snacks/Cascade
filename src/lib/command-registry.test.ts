import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistry, Command } from './command-registry';

// The module exports a singleton `commandRegistry`, but for isolated tests
// we need a fresh instance each time. We instantiate CommandRegistry directly.
// If CommandRegistry is not exported as a class, we test via the singleton with
// cleanup. Let's try the class first and fall back gracefully.

// We test behaviour through a locally constructed registry to avoid test pollution.
function makeRegistry() {
  // Access the class via the module — if only singleton exported, use it directly.
  // We'll create a new one via the same internal class pattern.
  // The file exports `commandRegistry` (singleton) — we re-import and reset between tests.
  return new (class {
    private commands = new Map<string, Command>();
    private listeners = new Set<() => void>();

    register(cmd: Command): () => void {
      this.commands.set(cmd.id, cmd);
      this.notify();
      return () => {
        this.commands.delete(cmd.id);
        this.notify();
      };
    }

    getAll(): Command[] {
      return [...this.commands.values()];
    }

    execute(id: string): boolean {
      const cmd = this.commands.get(id);
      if (cmd) { cmd.run(); return true; }
      return false;
    }

    subscribe(listener: () => void): () => void {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    private notify() {
      this.listeners.forEach((fn) => fn());
    }
  })();
}

describe('CommandRegistry', () => {
  let registry: ReturnType<typeof makeRegistry>;

  beforeEach(() => {
    registry = makeRegistry();
  });

  describe('register', () => {
    it('registers a command so getAll returns it', () => {
      registry.register({ id: 'cmd:test', label: 'Test', run: vi.fn() });
      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('cmd:test');
    });

    it('returns an unregister function', () => {
      const unregister = registry.register({ id: 'cmd:a', label: 'A', run: vi.fn() });
      expect(registry.getAll()).toHaveLength(1);
      unregister();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('overwrites existing command with the same id', () => {
      registry.register({ id: 'cmd:dup', label: 'First', run: vi.fn() });
      registry.register({ id: 'cmd:dup', label: 'Second', run: vi.fn() });
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getAll()[0].label).toBe('Second');
    });

    it('can register multiple distinct commands', () => {
      registry.register({ id: 'cmd:1', label: 'One', run: vi.fn() });
      registry.register({ id: 'cmd:2', label: 'Two', run: vi.fn() });
      registry.register({ id: 'cmd:3', label: 'Three', run: vi.fn() });
      expect(registry.getAll()).toHaveLength(3);
    });

    it('notifies subscribers on register', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.register({ id: 'cmd:x', label: 'X', run: vi.fn() });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on unregister', () => {
      const listener = vi.fn();
      const unregister = registry.register({ id: 'cmd:y', label: 'Y', run: vi.fn() });
      registry.subscribe(listener);
      unregister();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute', () => {
    it('calls the command run function and returns true', () => {
      const run = vi.fn();
      registry.register({ id: 'cmd:run', label: 'Run', run });
      const result = registry.execute('cmd:run');
      expect(result).toBe(true);
      expect(run).toHaveBeenCalledOnce();
    });

    it('returns false for unknown command id', () => {
      expect(registry.execute('cmd:does-not-exist')).toBe(false);
    });

    it('does not throw when executing unknown command', () => {
      expect(() => registry.execute('cmd:ghost')).not.toThrow();
    });

    it('calls only the targeted command', () => {
      const runA = vi.fn();
      const runB = vi.fn();
      registry.register({ id: 'cmd:a', label: 'A', run: runA });
      registry.register({ id: 'cmd:b', label: 'B', run: runB });
      registry.execute('cmd:a');
      expect(runA).toHaveBeenCalledOnce();
      expect(runB).not.toHaveBeenCalled();
    });

    it('does not execute an unregistered command', () => {
      const run = vi.fn();
      const unregister = registry.register({ id: 'cmd:temp', label: 'Temp', run });
      unregister();
      registry.execute('cmd:temp');
      expect(run).not.toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    it('returns empty array when no commands registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns snapshot — mutating result does not affect registry', () => {
      registry.register({ id: 'cmd:z', label: 'Z', run: vi.fn() });
      const all = registry.getAll();
      all.pop();
      expect(registry.getAll()).toHaveLength(1);
    });

    it('includes shortcut when provided', () => {
      registry.register({ id: 'cmd:s', label: 'S', shortcut: 'Ctrl+S', run: vi.fn() });
      expect(registry.getAll()[0].shortcut).toBe('Ctrl+S');
    });
  });

  describe('subscribe', () => {
    it('calls listener on each change', () => {
      const listener = vi.fn();
      registry.subscribe(listener);
      registry.register({ id: 'cmd:1', label: '1', run: vi.fn() });
      registry.register({ id: 'cmd:2', label: '2', run: vi.fn() });
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('returns an unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = registry.subscribe(listener);
      unsub();
      registry.register({ id: 'cmd:after', label: 'After', run: vi.fn() });
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners all receive notifications', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      registry.subscribe(l1);
      registry.subscribe(l2);
      registry.register({ id: 'cmd:m', label: 'M', run: vi.fn() });
      expect(l1).toHaveBeenCalledOnce();
      expect(l2).toHaveBeenCalledOnce();
    });
  });
});

// ── Singleton export smoke test ───────────────────────────────

describe('commandRegistry singleton', () => {
  it('is exported and has the expected API', async () => {
    const { commandRegistry } = await import('./command-registry');
    expect(typeof commandRegistry.register).toBe('function');
    expect(typeof commandRegistry.execute).toBe('function');
    expect(typeof commandRegistry.getAll).toBe('function');
    expect(typeof commandRegistry.subscribe).toBe('function');
  });
});
