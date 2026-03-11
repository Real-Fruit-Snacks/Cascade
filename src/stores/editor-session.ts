import type { SplitDirection } from './editor-types';
import type { useEditorStore } from './editor-store';

const SESSION_KEY_PREFIX = 'cascade-session:';

interface SessionTabData {
  path: string;
  cursorPos?: number;
  scrollTop?: number;
}

interface SessionPaneData {
  tabs: SessionTabData[];
  activeTabIndex: number;
}

interface SessionData {
  tabs: SessionTabData[];
  activeTabIndex: number;
  panes?: SessionPaneData[];
  activePaneIndex?: number;
  splitDirection?: SplitDirection | null;
}

export function saveSession(vaultRoot: string, store: typeof useEditorStore) {
  const { tabs, activeTabIndex, panes, activePaneIndex, splitDirection } = store.getState();
  const session: SessionData = {
    tabs: tabs
      .filter((t) => !t.path.startsWith('__'))
      .map((t) => ({ path: t.path, cursorPos: t.cursorPos, scrollTop: t.scrollTop })),
    activeTabIndex,
    panes: panes.length > 0
      ? panes.map((p) => ({
          tabs: p.tabs
            .filter((t) => !t.path.startsWith('__'))
            .map((t) => ({ path: t.path, cursorPos: t.cursorPos, scrollTop: t.scrollTop })),
          activeTabIndex: p.activeTabIndex,
        }))
      : undefined,
    activePaneIndex: panes.length > 0 ? activePaneIndex : undefined,
    splitDirection: panes.length > 0 ? splitDirection : undefined,
  };
  try {
    localStorage.setItem(SESSION_KEY_PREFIX + vaultRoot, JSON.stringify(session));
  } catch { /* quota */ }
}

export async function restoreSession(vaultRoot: string, store: typeof useEditorStore) {
  const raw = localStorage.getItem(SESSION_KEY_PREFIX + vaultRoot);
  if (!raw) return;
  try {
    const session: SessionData = JSON.parse(raw);
    if (!Array.isArray(session.tabs) || session.tabs.length === 0) return;

    const state = store.getState();
    await Promise.all(
      session.tabs.map((tabData) => state.openFile(vaultRoot, tabData.path, true, true)),
    );
    const idx = Math.min(session.activeTabIndex, session.tabs.length - 1);
    if (idx >= 0) {
      state.switchTab(idx);
    }

    if (Array.isArray(session.panes) && session.panes.length >= 2 && session.splitDirection) {
      state.splitPane(session.splitDirection);
      const restoredPanes = session.panes;
      for (let pi = 1; pi < restoredPanes.length; pi++) {
        const paneData = restoredPanes[pi];
        for (const tabData of paneData.tabs) {
          await state.openFileInPane(pi, vaultRoot, tabData.path, true);
        }
        if (paneData.activeTabIndex >= 0) {
          state.switchPaneTab(pi, paneData.activeTabIndex);
        }
      }
      if (typeof session.activePaneIndex === 'number') {
        state.setActivePaneIndex(session.activePaneIndex);
      }
    }
  } catch { /* ignore corrupt session data */ }
}
