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
  const ctrlOrMeta = needsCtrl ? mod : needsMeta ? false : !e.ctrlKey && !e.metaKey;
  const shift = needsShift ? e.shiftKey : !e.shiftKey;
  const alt = needsAlt ? e.altKey : !e.altKey;
  const meta = needsMeta ? e.metaKey : true;

  if (!ctrlOrMeta || !shift || !alt || !meta) return false;

  // Normalize key comparison
  const eventKey = e.key;
  // For letter keys: shortcut stores uppercase, event.key is case-sensitive
  return eventKey.toLowerCase() === key.toLowerCase() || eventKey === key;
}

export function useKeyboardShortcuts(): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip non-shortcut keystrokes early (no modifier held)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;

    // Dispatch shortcuts via command registry
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
