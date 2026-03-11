import type { useEditorStore } from './editor-store';

const DRAFTS_KEY = 'cascade-drafts';

export function getDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
  } catch { return {}; }
}

export function saveDrafts(store: typeof useEditorStore) {
  const { tabs, panes, dirtyPaths } = store.getState();
  if (dirtyPaths.size === 0) return;
  const drafts = getDrafts();
  let changed = false;

  const allTabs = panes.length > 0
    ? panes.flatMap((p) => p.tabs)
    : tabs;

  for (const tab of allTabs) {
    if (tab.isDirty && !tab.path.startsWith('__') && (!tab.type || tab.type === 'markdown')) {
      if (drafts[tab.path] !== tab.content) {
        drafts[tab.path] = tab.content;
        changed = true;
      }
    } else if (drafts[tab.path] !== undefined) {
      delete drafts[tab.path];
      changed = true;
    }
  }

  if (changed) {
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* quota */ }
  }
}

export function consumeDraft(path: string): string | null {
  const drafts = getDrafts();
  const draft = drafts[path];
  if (draft !== undefined) {
    delete drafts[path];
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* quota */ }
    return draft;
  }
  return null;
}

export function clearDraft(path: string) {
  const drafts = getDrafts();
  if (drafts[path] !== undefined) {
    delete drafts[path];
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* quota */ }
  }
}
