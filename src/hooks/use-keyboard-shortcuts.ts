import { useCallback, useEffect } from 'react';
import { commandRegistry } from '../lib/command-registry';

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');
  const needsMeta = parts.includes('Meta');

  // Ctrl and Meta are treated as interchangeable (Cmd on macOS = Ctrl on Win/Linux)
  // unless Meta is explicitly required in the shortcut
  const mod = e.ctrlKey || e.metaKey;
  let ctrlOrMetaOk: boolean;
  if (needsCtrl) {
    ctrlOrMetaOk = mod;
  } else if (needsMeta) {
    ctrlOrMetaOk = e.metaKey;
  } else {
    ctrlOrMetaOk = !e.ctrlKey && !e.metaKey;
  }
  const shiftOk = needsShift ? e.shiftKey : !e.shiftKey;
  const altOk = needsAlt ? e.altKey : !e.altKey;

  if (!ctrlOrMetaOk || !shiftOk || !altOk) return false;

  // Normalize key comparison
  const eventKey = e.key;
  // For letter keys: shortcut stores uppercase, event.key is case-sensitive
  return eventKey.toLowerCase() === key.toLowerCase() || eventKey === key;
}

export function useKeyboardShortcuts(): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip non-shortcut keystrokes early (no modifier held)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

    // Dispatch shortcuts via command registry.
    // O(N) over all commands is acceptable — the registry holds ~50 commands at most.
    const cmds = commandRegistry.getAll();
    for (const cmd of cmds) {
      if (!cmd.shortcut) continue;
      if (matchesShortcut(e, cmd.shortcut)) {
        e.preventDefault();
        cmd.run();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
