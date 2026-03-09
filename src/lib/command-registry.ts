export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

class CommandRegistry {
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
    if (cmd) {
      cmd.run();
      return true;
    }
    return false;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const commandRegistry = new CommandRegistry();
