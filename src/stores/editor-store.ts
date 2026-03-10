import { create } from 'zustand';
import { EditorView } from '@codemirror/view';
import type { ViewMode } from '../types/index';
import * as cmd from '../lib/tauri-commands';
import { useVaultStore } from './vault-store';
import { useSettingsStore } from './settings-store';
import { useToastStore } from './toast-store';

export type TabType = 'markdown' | 'image' | 'pdf' | 'canvas';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const CANVAS_EXTENSIONS = new Set(['.canvas']);

export function getTabType(path: string): TabType {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (CANVAS_EXTENSIONS.has(ext)) return 'canvas';
  return 'markdown';
}

export interface Tab {
  path: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  isPinned?: boolean;
  cursorPos?: number;
  scrollTop?: number;
  type?: TabType;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface Pane {
  tabs: Tab[];
  activeTabIndex: number;
  editorViewRef: { current: EditorView | null };
}

interface EditorState {
  tabs: Tab[];
  activeTabIndex: number;
  justSaved: boolean;
  viewMode: ViewMode;
  editorViewRef: { current: EditorView | null };
  recentFiles: string[];
  isFileLoading: boolean;
  pendingScrollLine: number | null;
  pendingScrollHeading: string | null;
  pendingScrollBlockId: string | null;
  focusModeActive: boolean;
  dirtyPaths: Set<string>;

  // Split pane state
  panes: Pane[];
  activePaneIndex: number;
  splitDirection: SplitDirection | null;
}

interface EditorActions {
  openFile: (vaultRoot: string, path: string, newTab?: boolean, background?: boolean) => Promise<void>;
  addRecentFile: (vaultRoot: string, path: string) => void;
  loadRecentFiles: (vaultRoot: string) => void;
  openSpecialTab: (id: string) => void;
  closeTab: (index: number, force?: boolean) => void;
  closeActiveTab: () => void;
  hasDirtyTabs: () => boolean;
  closeFile: () => void; // backward-compat alias for closeActiveTab
  switchTab: (index: number) => void;
  nextTab: () => void;
  prevTab: () => void;
  moveTab: (from: number, to: number) => void;
  pinTab: (index: number) => void;
  unpinTab: (index: number) => void;
  updateContent: (content: string) => void;
  saveFile: (vaultRoot: string) => Promise<void>;
  handleExternalChange: (vaultRoot: string, relPath: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setEditorView: (view: EditorView | null) => void;
  toggleFocusMode: () => void;

  // Split pane actions
  splitPane: (direction: SplitDirection) => void;
  closeSplit: () => void;
  setActivePaneIndex: (index: number) => void;
  openFileInPane: (paneIndex: number, vaultRoot: string, path: string, newTab?: boolean) => Promise<void>;
  switchPaneTab: (paneIndex: number, tabIndex: number) => void;
  closePaneTab: (paneIndex: number, tabIndex: number, force?: boolean) => void;
  updatePaneContent: (paneIndex: number, content: string) => void;
  savePaneFile: (paneIndex: number, vaultRoot: string) => Promise<void>;
  setPaneEditorView: (paneIndex: number, view: EditorView | null) => void;
  moveTabToPane: (tabIndex: number, fromPane: number, toPane: number) => void;
}

// Derived values — computed from tabs[activeTabIndex]
interface EditorDerived {
  activeFilePath: string | null;
  content: string;
  isDirty: boolean;
}

let openFileSeq = 0;

/** Compute derived values from tabs + activeTabIndex */
function derived(tabs: Tab[], activeTabIndex: number): EditorDerived {
  const tab = tabs[activeTabIndex];
  return {
    activeFilePath: tab?.path ?? null,
    content: tab?.content ?? '',
    isDirty: tab?.isDirty ?? false,
  };
}

/** Find the position of a heading in the editor by matching heading text (case-insensitive). */
function findHeadingPosition(view: EditorView, heading: string): number | null {
  const doc = view.state.doc;
  const target = heading.toLowerCase().replace(/-/g, ' ').trim();
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const m = line.text.match(/^#{1,6}\s+(.+)/);
    if (m) {
      const text = m[1].trim().toLowerCase();
      if (text === target) return line.from;
    }
  }
  return null;
}

/** Find the position of a block ID (^blockid) in the editor. */
function findBlockIdPosition(view: EditorView, blockId: string): number | null {
  const doc = view.state.doc;
  const marker = `^${blockId}`;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text.trimEnd().endsWith(marker)) return line.from;
  }
  return null;
}

export const useEditorStore = create<EditorState & EditorActions & EditorDerived>((set, get) => ({
  // Core state
  tabs: [],
  activeTabIndex: -1,
  justSaved: false,
  viewMode: useSettingsStore.getState().defaultViewMode,
  editorViewRef: { current: null },
  recentFiles: [],
  isFileLoading: false,
  pendingScrollLine: null,
  pendingScrollHeading: null,
  pendingScrollBlockId: null,
  focusModeActive: false,
  dirtyPaths: new Set<string>(),

  // Split pane state
  panes: [],
  activePaneIndex: 0,
  splitDirection: null,

  // Derived values (recomputed on every state change that touches tabs/activeTabIndex)
  activeFilePath: null,
  content: '',
  isDirty: false,

  loadRecentFiles: (vaultRoot: string) => {
    const key = `cascade-recent-files:${vaultRoot}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ recentFiles: parsed.filter((p): p is string => typeof p === 'string') });
          return;
        }
      }
    } catch { /* ignore corrupt localStorage */ }
    set({ recentFiles: [] });
  },

  addRecentFile: (vaultRoot: string, path: string) => {
    if (path.startsWith('__')) return;
    const key = `cascade-recent-files:${vaultRoot}`;
    set((s) => {
      const filtered = s.recentFiles.filter((p) => p !== path);
      const updated = [path, ...filtered].slice(0, 20);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore quota errors */ }
      return { recentFiles: updated };
    });
  },

  openFile: async (vaultRoot: string, path: string, newTab?: boolean, background?: boolean) => {
    // If already open in a tab, just switch to it (unless background)
    const { tabs } = get();
    const existing = tabs.findIndex((t) => t.path === path);
    if (existing !== -1) {
      if (!background) {
        set({ activeTabIndex: existing, isFileLoading: false, ...derived(tabs, existing) });
        get().addRecentFile(vaultRoot, path);
        // If there's a pending scroll line, scroll to it now
        const scrollLine = get().pendingScrollLine;
        if (scrollLine !== null) {
          set({ pendingScrollLine: null });
          // Use setTimeout to let modal close first
          setTimeout(() => {
            const view = get().editorViewRef.current;
            if (!view) return;
            const totalLines = view.state.doc.lines;
            const clampedLine = Math.max(1, Math.min(scrollLine, totalLines));
            const lineInfo = view.state.doc.line(clampedLine);
            view.dispatch({
              selection: { anchor: lineInfo.from },
              effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
            });
            view.focus();
          }, 100);
        }
        // If there's a pending heading anchor, scroll to it
        const scrollHeading = get().pendingScrollHeading;
        if (scrollHeading !== null) {
          set({ pendingScrollHeading: null });
          setTimeout(() => {
            const view = get().editorViewRef.current;
            if (!view) return;
            const pos = findHeadingPosition(view, scrollHeading);
            if (pos !== null) {
              view.dispatch({
                selection: { anchor: pos },
                effects: EditorView.scrollIntoView(pos, { y: 'center' }),
              });
              view.focus();
            }
          }, 100);
        }
        // If there's a pending block ID, scroll to it
        const scrollBlock = get().pendingScrollBlockId;
        if (scrollBlock !== null) {
          set({ pendingScrollBlockId: null });
          setTimeout(() => {
            const view = get().editorViewRef.current;
            if (!view) return;
            const pos = findBlockIdPosition(view, scrollBlock);
            if (pos !== null) {
              view.dispatch({
                selection: { anchor: pos },
                effects: EditorView.scrollIntoView(pos, { y: 'center' }),
              });
              view.focus();
            }
          }, 100);
        }
      }
      return;
    }

    const seq = ++openFileSeq;
    if (!background) set({ isFileLoading: true });
    try {
      const tabType = getTabType(path);

      // For image/pdf tabs, don't read file content — just store the path
      if (tabType !== 'markdown' && useSettingsStore.getState().enableMediaViewer) {
        if (seq !== openFileSeq) return;
        const tab: Tab = { path, content: '', savedContent: '', isDirty: false, type: tabType };

        if (newTab || tabs.length === 0) {
          set((s) => {
            const newTabs = [...s.tabs, tab];
            if (background) return { tabs: newTabs };
            const newIndex = newTabs.length - 1;
            return { tabs: newTabs, activeTabIndex: newIndex, isFileLoading: false, ...derived(newTabs, newIndex) };
          });
        } else {
          set((s) => {
            const newTabs = s.tabs.map((t, i) => (i === s.activeTabIndex ? tab : t));
            return { tabs: newTabs, isFileLoading: false, ...derived(newTabs, s.activeTabIndex) };
          });
        }
        if (!background) get().addRecentFile(vaultRoot, path);
        return;
      }

      const text = await cmd.readFile(vaultRoot, path);
      if (seq !== openFileSeq) return;
      // Warn and abort for very large files (>5MB) to prevent UI freeze
      const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
      if (text.length > FILE_SIZE_LIMIT) {
        set({ isFileLoading: false });
        const sizeMB = (text.length / (1024 * 1024)).toFixed(1);
        useToastStore.getState().addToast(
          `File is too large to open (${sizeMB} MB). Maximum supported size is 5 MB.`,
          'warning',
        );
        return;
      }
      // Recover draft if one exists from a previous crash
      const draft = consumeDraft(path);
      const hasDraft = draft !== null && draft !== text;
      const tab: Tab = { path, content: hasDraft ? draft : text, savedContent: text, isDirty: hasDraft };

      // Apply the user's default view mode when opening a new file
      const defaultMode = useSettingsStore.getState().defaultViewMode;

      if (newTab || tabs.length === 0) {
        // Open in a new tab
        set((s) => {
          const newTabs = [...s.tabs, tab];
          const dirtyPaths = hasDraft ? new Set([...s.dirtyPaths, path]) : s.dirtyPaths;
          if (background) {
            return { tabs: newTabs, dirtyPaths };
          }
          const newIndex = newTabs.length - 1;
          return { tabs: newTabs, activeTabIndex: newIndex, viewMode: defaultMode, dirtyPaths, isFileLoading: false, ...derived(newTabs, newIndex) };
        });
      } else {
        // Replace the active tab (use functional set to avoid stale state after await)
        set((s) => {
          const newTabs = s.tabs.map((t, i) => (i === s.activeTabIndex ? tab : t));
          const dirtyPaths = hasDraft ? new Set([...s.dirtyPaths, path]) : s.dirtyPaths;
          return { tabs: newTabs, viewMode: defaultMode, dirtyPaths, isFileLoading: false, ...derived(newTabs, s.activeTabIndex) };
        });
      }
      if (hasDraft) {
        const name = path.replace(/\\/g, '/').split('/').pop() ?? path;
        useToastStore.getState().addToast(`Recovered unsaved changes for "${name}"`, 'info');
      }
      if (!background) get().addRecentFile(vaultRoot, path);
    } catch (e) {
      set({ isFileLoading: false });
      console.error('Failed to open file:', path, e);
      const fileName = path.replace(/\\/g, '/').split('/').pop() ?? path;
      useToastStore.getState().addToast(`Failed to open "${fileName}"`, 'error');
    }
  },

  openSpecialTab: (id: string) => {
    const { tabs } = get();
    const existing = tabs.findIndex((t) => t.path === id);
    if (existing !== -1) {
      set({ activeTabIndex: existing, ...derived(tabs, existing) });
      return;
    }
    const tab: Tab = { path: id, content: '', savedContent: '', isDirty: false };
    const newTabs = [...tabs, tab];
    const newIndex = newTabs.length - 1;
    set({ tabs: newTabs, activeTabIndex: newIndex, ...derived(newTabs, newIndex) });
  },

  hasDirtyTabs: () => {
    const { tabs, panes } = get();
    if (tabs.some((t) => t.isDirty)) return true;
    return panes.some((p) => p.tabs.some((t) => t.isDirty));
  },

  closeTab: (index: number, force?: boolean) => {
    const { tabs, activeTabIndex } = get();
    if (index < 0 || index >= tabs.length) return;

    const tab = tabs[index];
    // Pinned tabs cannot be closed unless explicitly unpinned first
    if (tab.isPinned) return;
    if (tab.isDirty && !force) return;

    const newTabs = tabs.filter((_, i) => i !== index);

    if (newTabs.length === 0) {
      set({ tabs: [], activeTabIndex: -1, ...derived([], -1) });
      return;
    }

    let newActive = activeTabIndex;
    if (index < activeTabIndex) {
      newActive = activeTabIndex - 1;
    } else if (index === activeTabIndex) {
      // Switch to the tab to the left, or the new last tab
      newActive = Math.min(activeTabIndex, newTabs.length - 1);
    }

    set({ tabs: newTabs, activeTabIndex: newActive, ...derived(newTabs, newActive) });
  },

  closeActiveTab: () => {
    const { activeTabIndex } = get();
    if (activeTabIndex === -1) return;
    get().closeTab(activeTabIndex);
  },

  closeFile: () => {
    get().closeActiveTab();
  },

  switchTab: (index: number) => {
    const { tabs, activeTabIndex, editorViewRef } = get();
    if (index < 0 || index >= tabs.length) return;
    // Auto-save dirty file on tab switch (focus-change mode)
    if (get().isDirty) {
      const s = useSettingsStore.getState();
      if (s.autoSaveEnabled && s.autoSaveMode === 'focus-change') {
        const vaultPath = useVaultStore.getState().vaultPath;
        if (vaultPath) get().saveFile(vaultPath);
      }
    }
    // Save current tab's cursor and scroll before switching
    const view = editorViewRef.current;
    if (view && activeTabIndex >= 0 && activeTabIndex < tabs.length) {
      const newTabs = [...tabs];
      newTabs[activeTabIndex] = {
        ...newTabs[activeTabIndex],
        cursorPos: view.state.selection.main.head,
        scrollTop: view.scrollDOM.scrollTop,
      };
      set({ tabs: newTabs, activeTabIndex: index, ...derived(newTabs, index) });
      return;
    }
    set({ activeTabIndex: index, ...derived(tabs, index) });
  },

  nextTab: () => {
    const { tabs, activeTabIndex } = get();
    if (tabs.length === 0) return;
    const next = (activeTabIndex + 1) % tabs.length;
    set({ activeTabIndex: next, ...derived(tabs, next) });
  },

  prevTab: () => {
    const { tabs, activeTabIndex } = get();
    if (tabs.length === 0) return;
    const prev = (activeTabIndex - 1 + tabs.length) % tabs.length;
    set({ activeTabIndex: prev, ...derived(tabs, prev) });
  },

  moveTab: (from: number, to: number) => {
    const { tabs, activeTabIndex } = get();
    if (from === to || from < 0 || from >= tabs.length || to < 0 || to >= tabs.length) return;
    const pinnedCount = tabs.filter((t) => t.isPinned).length;
    const movingTab = tabs[from];
    // Enforce pin boundaries: pinned tabs stay in pinned zone, unpinned in unpinned zone
    if (movingTab.isPinned && to >= pinnedCount) return;
    if (!movingTab.isPinned && to < pinnedCount) return;
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(from, 1);
    newTabs.splice(to, 0, moved);
    // Track where the active tab ended up
    let newActive = activeTabIndex;
    if (activeTabIndex === from) {
      newActive = to;
    } else if (from < activeTabIndex && to >= activeTabIndex) {
      newActive = activeTabIndex - 1;
    } else if (from > activeTabIndex && to <= activeTabIndex) {
      newActive = activeTabIndex + 1;
    }
    set({ tabs: newTabs, activeTabIndex: newActive, ...derived(newTabs, newActive) });
  },

  pinTab: (index: number) => {
    set((s) => {
      if (index < 0 || index >= s.tabs.length) return s;
      const tab = s.tabs[index];
      if (tab.isPinned) return s;
      // Remove from current position and insert at end of pinned zone
      const pinnedCount = s.tabs.filter((t) => t.isPinned).length;
      const newTabs = s.tabs.filter((_, i) => i !== index);
      newTabs.splice(pinnedCount, 0, { ...tab, isPinned: true });
      // Find where active tab moved
      let newActive = s.activeTabIndex;
      if (s.activeTabIndex === index) {
        newActive = pinnedCount;
      } else {
        const removed = index;
        const inserted = pinnedCount;
        if (removed < newActive) newActive--;
        if (inserted <= newActive) newActive++;
      }
      return { tabs: newTabs, activeTabIndex: newActive, ...derived(newTabs, newActive) };
    });
  },

  unpinTab: (index: number) => {
    set((s) => {
      if (index < 0 || index >= s.tabs.length) return s;
      const tab = s.tabs[index];
      if (!tab.isPinned) return s;
      // Remove from pinned zone, insert at start of unpinned zone
      const pinnedCount = s.tabs.filter((t) => t.isPinned).length;
      const insertAt = pinnedCount - 1; // after removing, pinned zone shrinks by 1
      const newTabs = s.tabs.filter((_, i) => i !== index);
      newTabs.splice(insertAt, 0, { ...tab, isPinned: false });
      let newActive = s.activeTabIndex;
      if (s.activeTabIndex === index) {
        newActive = insertAt;
      } else {
        const removed = index;
        const inserted = insertAt;
        newActive = s.activeTabIndex;
        if (removed < newActive) newActive--;
        if (inserted <= newActive) newActive++;
      }
      return { tabs: newTabs, activeTabIndex: newActive, ...derived(newTabs, newActive) };
    });
  },

  updateContent: (newContent: string) => {
    set((s) => {
      if (s.activeTabIndex === -1) return s;
      const tab = s.tabs[s.activeTabIndex];
      if (tab.content === newContent) return s;
      const newDirty = newContent !== tab.savedContent;
      // Mutate in-place and create a new array ref only — avoids spreading every tab object
      const newTabs = s.tabs.slice();
      newTabs[s.activeTabIndex] = { ...tab, content: newContent, isDirty: newDirty };
      // Update dirtyPaths only when isDirty flips
      let dirtyPaths = s.dirtyPaths;
      if (newDirty !== tab.isDirty) {
        dirtyPaths = new Set(s.dirtyPaths);
        if (newDirty) dirtyPaths.add(tab.path);
        else dirtyPaths.delete(tab.path);
      }
      return { tabs: newTabs, content: newContent, isDirty: newDirty, dirtyPaths };
    });
  },

  saveFile: async (vaultRoot: string) => {
    const { tabs, activeTabIndex } = get();
    if (activeTabIndex === -1) return;
    let tab = tabs[activeTabIndex];
    if (!tab) return;
    // Skip save for non-markdown tabs (images, PDFs)
    if (tab.type && tab.type !== 'markdown') return;

    // Auto-update TOC if enabled
    if (useSettingsStore.getState().enableTableOfContents && useSettingsStore.getState().tocAutoUpdate && tab.path.endsWith('.md')) {
      try {
        const { updateTocInDoc } = await import('../lib/toc');
        const result = updateTocInDoc(tab.content);
        if (result) {
          const newContent = tab.content.slice(0, result.from) + result.insert + tab.content.slice(result.to);
          tab = { ...tab, content: newContent };
          // Also update the editor view
          const view = get().editorViewRef.current;
          if (view) {
            view.dispatch({ changes: { from: result.from, to: result.to, insert: result.insert } });
          }
        }
      } catch { /* ignore TOC errors during save */ }
    }

    try {
      await cmd.writeFile(vaultRoot, tab.path, tab.content);
    } catch (e) {
      console.error('Failed to save file:', tab.path, e);
      const fileName = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
      useToastStore.getState().addToast(`Failed to save "${fileName}"`, 'error');
      return;
    }
    const updated: Tab = { ...tab, savedContent: tab.content, isDirty: false };
    const newTabs = tabs.map((t, i) => (i === activeTabIndex ? updated : t));
    const dirtyPaths = new Set(get().dirtyPaths);
    dirtyPaths.delete(tab.path);
    set({ tabs: newTabs, justSaved: true, dirtyPaths, ...derived(newTabs, activeTabIndex) });
    setTimeout(() => set({ justSaved: false }), 1500);
    clearDraft(tab.path);
    useVaultStore.getState().updateFileTags(tab.path, tab.content);
    useVaultStore.getState().updateFileLinks(tab.path, tab.content);
  },

  handleExternalChange: async (vaultRoot: string, relPath: string) => {
    // Check if file is open before async read
    if (get().tabs.findIndex((t) => t.path === relPath) === -1) return;

    let newContent: string;
    try {
      newContent = await cmd.readFile(vaultRoot, relPath);
    } catch {
      return; // file may have been deleted — ignore
    }

    // Re-read state after async to avoid stale references
    const { tabs, activeTabIndex } = get();
    const tabIndex = tabs.findIndex((t) => t.path === relPath);
    if (tabIndex === -1) return;
    const tab = tabs[tabIndex];

    // If content hasn't actually changed (e.g. same save), skip
    if (newContent === tab.savedContent) return;

    if (tab.isDirty) {
      // Tab has unsaved edits — show conflict dialog
      window.dispatchEvent(new CustomEvent('cascade:file-conflict', {
        detail: { path: relPath, externalContent: newContent },
      }));
    } else {
      // No local edits — silently reload
      const updated: Tab = { ...tab, content: newContent, savedContent: newContent, isDirty: false };
      const newTabs = tabs.map((t, i) => (i === tabIndex ? updated : t));
      set({
        tabs: newTabs,
        ...(tabIndex === activeTabIndex ? derived(newTabs, activeTabIndex) : {}),
      });
    }
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  setEditorView: (view: EditorView | null) => {
    get().editorViewRef.current = view;
  },

  toggleFocusMode: () => {
    set((s) => ({ focusModeActive: !s.focusModeActive }));
  },

  // --- Split pane actions ---

  splitPane: (direction: SplitDirection) => {
    const { panes, tabs, activeTabIndex, activeFilePath, editorViewRef } = get();

    // Already split — max 2 panes
    if (panes.length === 2) return;

    if (panes.length === 0) {
      // First split: migrate current single-pane state into panes[0], create panes[1]
      const pane0: Pane = {
        tabs: [...tabs],
        activeTabIndex,
        editorViewRef,
      };
      // Second pane: open the same file as the first pane (or empty)
      const pane1Tabs: Tab[] = [];
      let pane1Active = -1;
      if (activeFilePath && activeTabIndex >= 0 && tabs[activeTabIndex]) {
        const tab = tabs[activeTabIndex];
        pane1Tabs.push({ ...tab });
        pane1Active = 0;
      }
      const pane1: Pane = {
        tabs: pane1Tabs,
        activeTabIndex: pane1Active,
        editorViewRef: { current: null },
      };
      set({ panes: [pane0, pane1], activePaneIndex: 1, splitDirection: direction });
    } else {
      // panes.length === 1 — add a second pane
      const activePaneTabs = panes[0].tabs;
      const activePaneIdx = panes[0].activeTabIndex;
      const activeTab = activePaneTabs[activePaneIdx];
      const pane1Tabs: Tab[] = activeTab ? [{ ...activeTab }] : [];
      const pane1: Pane = {
        tabs: pane1Tabs,
        activeTabIndex: pane1Tabs.length > 0 ? 0 : -1,
        editorViewRef: { current: null },
      };
      set({ panes: [...panes, pane1], activePaneIndex: 1, splitDirection: direction });
    }
  },

  closeSplit: () => {
    const { panes, activePaneIndex } = get();
    if (panes.length < 2) {
      // No split active — reset to single pane mode
      if (panes.length === 1) {
        set({
          tabs: panes[0].tabs,
          activeTabIndex: panes[0].activeTabIndex,
          editorViewRef: panes[0].editorViewRef,
          panes: [],
          activePaneIndex: 0,
          splitDirection: null,
          ...derived(panes[0].tabs, panes[0].activeTabIndex),
        });
      }
      return;
    }

    // Keep the active pane, discard the other
    const keepIdx = activePaneIndex;
    const kept = panes[keepIdx];
    set({
      tabs: kept.tabs,
      activeTabIndex: kept.activeTabIndex,
      editorViewRef: kept.editorViewRef,
      panes: [],
      activePaneIndex: 0,
      splitDirection: null,
      ...derived(kept.tabs, kept.activeTabIndex),
    });
  },

  setActivePaneIndex: (index: number) => {
    const { panes } = get();
    if (index < 0 || index >= panes.length) return;
    set({ activePaneIndex: index });
  },

  openFileInPane: async (paneIndex: number, vaultRoot: string, path: string, newTab?: boolean) => {
    const { panes } = get();
    if (paneIndex < 0 || paneIndex >= panes.length) return;
    const pane = panes[paneIndex];

    // Check if already open in this pane
    const existing = pane.tabs.findIndex((t) => t.path === path);
    if (existing !== -1) {
      const newPanes = panes.map((p, i) => i === paneIndex ? { ...p, activeTabIndex: existing } : p);
      set({ panes: newPanes, activePaneIndex: paneIndex });
      return;
    }

    const tabType = getTabType(path);
    let tab: Tab;

    if (tabType !== 'markdown' && useSettingsStore.getState().enableMediaViewer) {
      tab = { path, content: '', savedContent: '', isDirty: false, type: tabType };
    } else {
      try {
        const text = await cmd.readFile(vaultRoot, path);
        const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
        if (text.length > FILE_SIZE_LIMIT) {
          useToastStore.getState().addToast(`File is too large to open`, 'warning');
          return;
        }
        const draft = consumeDraft(path);
        const hasDraft = draft !== null && draft !== text;
        tab = { path, content: hasDraft ? draft : text, savedContent: text, isDirty: hasDraft };
      } catch (e) {
        console.error('Failed to open file in pane:', path, e);
        return;
      }
    }

    // Re-read panes after async
    const currentPanes = get().panes;
    if (paneIndex >= currentPanes.length) return;
    const currentPane = currentPanes[paneIndex];

    let newPaneTabs: Tab[];
    let newPaneActiveIdx: number;
    if (newTab || currentPane.tabs.length === 0) {
      newPaneTabs = [...currentPane.tabs, tab];
      newPaneActiveIdx = newPaneTabs.length - 1;
    } else {
      newPaneTabs = currentPane.tabs.map((t, i) => i === currentPane.activeTabIndex ? tab : t);
      newPaneActiveIdx = currentPane.activeTabIndex;
    }

    const newPanes = currentPanes.map((p, i) =>
      i === paneIndex ? { ...p, tabs: newPaneTabs, activeTabIndex: newPaneActiveIdx } : p
    );
    set({ panes: newPanes, activePaneIndex: paneIndex });
    get().addRecentFile(vaultRoot, path);
  },

  switchPaneTab: (paneIndex: number, tabIndex: number) => {
    const { panes } = get();
    if (paneIndex < 0 || paneIndex >= panes.length) return;
    const pane = panes[paneIndex];
    if (tabIndex < 0 || tabIndex >= pane.tabs.length) return;

    // Save cursor/scroll from current editor view before switching
    const view = pane.editorViewRef.current;
    let updatedTabs = pane.tabs;
    if (view && pane.activeTabIndex >= 0 && pane.activeTabIndex < pane.tabs.length) {
      updatedTabs = [...pane.tabs];
      updatedTabs[pane.activeTabIndex] = {
        ...updatedTabs[pane.activeTabIndex],
        cursorPos: view.state.selection.main.head,
        scrollTop: view.scrollDOM.scrollTop,
      };
    }

    const newPanes = panes.map((p, i) =>
      i === paneIndex ? { ...p, tabs: updatedTabs, activeTabIndex: tabIndex } : p
    );
    set({ panes: newPanes, activePaneIndex: paneIndex });
  },

  closePaneTab: (paneIndex: number, tabIndex: number, force?: boolean) => {
    const { panes } = get();
    if (paneIndex < 0 || paneIndex >= panes.length) return;
    const pane = panes[paneIndex];
    if (tabIndex < 0 || tabIndex >= pane.tabs.length) return;

    const tab = pane.tabs[tabIndex];
    if (tab.isPinned) return;
    if (tab.isDirty && !force) return;

    const newTabs = pane.tabs.filter((_, i) => i !== tabIndex);
    let newActive = pane.activeTabIndex;
    if (newTabs.length === 0) {
      newActive = -1;
    } else if (tabIndex < pane.activeTabIndex) {
      newActive = pane.activeTabIndex - 1;
    } else if (tabIndex === pane.activeTabIndex) {
      newActive = Math.min(pane.activeTabIndex, newTabs.length - 1);
    }

    const newPanes = panes.map((p, i) =>
      i === paneIndex ? { ...p, tabs: newTabs, activeTabIndex: newActive } : p
    );
    set({ panes: newPanes });
  },

  updatePaneContent: (paneIndex: number, newContent: string) => {
    set((s) => {
      if (paneIndex < 0 || paneIndex >= s.panes.length) return s;
      const pane = s.panes[paneIndex];
      if (pane.activeTabIndex === -1) return s;
      const tab = pane.tabs[pane.activeTabIndex];
      if (tab.content === newContent) return s;
      const newDirty = newContent !== tab.savedContent;
      const newTabs = pane.tabs.slice();
      newTabs[pane.activeTabIndex] = { ...tab, content: newContent, isDirty: newDirty };
      let dirtyPaths = s.dirtyPaths;
      if (newDirty !== tab.isDirty) {
        dirtyPaths = new Set(s.dirtyPaths);
        if (newDirty) dirtyPaths.add(tab.path);
        else dirtyPaths.delete(tab.path);
      }
      const newPanes = s.panes.map((p, i) =>
        i === paneIndex ? { ...p, tabs: newTabs } : p
      );
      return { panes: newPanes, dirtyPaths };
    });
  },

  savePaneFile: async (paneIndex: number, vaultRoot: string) => {
    const { panes } = get();
    if (paneIndex < 0 || paneIndex >= panes.length) return;
    const pane = panes[paneIndex];
    if (pane.activeTabIndex === -1) return;
    let tab = pane.tabs[pane.activeTabIndex];
    if (!tab) return;
    if (tab.type && tab.type !== 'markdown') return;

    try {
      await cmd.writeFile(vaultRoot, tab.path, tab.content);
    } catch (e) {
      console.error('Failed to save file:', tab.path, e);
      const fileName = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
      useToastStore.getState().addToast(`Failed to save "${fileName}"`, 'error');
      return;
    }
    const updated: Tab = { ...tab, savedContent: tab.content, isDirty: false };
    // Re-read panes after async
    const currentPanes = get().panes;
    if (paneIndex >= currentPanes.length) return;
    const currentPane = currentPanes[paneIndex];
    const newTabs = currentPane.tabs.map((t, i) => (i === currentPane.activeTabIndex ? updated : t));
    const dirtyPaths = new Set(get().dirtyPaths);
    dirtyPaths.delete(tab.path);
    const newPanes = currentPanes.map((p, i) =>
      i === paneIndex ? { ...p, tabs: newTabs } : p
    );
    set({ panes: newPanes, dirtyPaths });
    clearDraft(tab.path);
    useVaultStore.getState().updateFileTags(tab.path, tab.content);
    useVaultStore.getState().updateFileLinks(tab.path, tab.content);
  },

  setPaneEditorView: (paneIndex: number, view: EditorView | null) => {
    const { panes } = get();
    if (paneIndex < 0 || paneIndex >= panes.length) return;
    panes[paneIndex].editorViewRef.current = view;
  },

  moveTabToPane: (tabIndex: number, fromPane: number, toPane: number) => {
    const { panes } = get();
    if (fromPane === toPane) return;
    if (fromPane < 0 || fromPane >= panes.length || toPane < 0 || toPane >= panes.length) return;
    const srcPane = panes[fromPane];
    if (tabIndex < 0 || tabIndex >= srcPane.tabs.length) return;

    const tab = srcPane.tabs[tabIndex];
    const newSrcTabs = srcPane.tabs.filter((_, i) => i !== tabIndex);
    let newSrcActive = srcPane.activeTabIndex;
    if (newSrcTabs.length === 0) {
      newSrcActive = -1;
    } else if (tabIndex <= srcPane.activeTabIndex) {
      newSrcActive = Math.max(0, srcPane.activeTabIndex - 1);
    }

    const dstPane = panes[toPane];
    const newDstTabs = [...dstPane.tabs, tab];
    const newDstActive = newDstTabs.length - 1;

    const newPanes = panes.map((p, i) => {
      if (i === fromPane) return { ...p, tabs: newSrcTabs, activeTabIndex: newSrcActive };
      if (i === toPane) return { ...p, tabs: newDstTabs, activeTabIndex: newDstActive };
      return p;
    });
    set({ panes: newPanes, activePaneIndex: toPane });
  },
}));

// --- Auto-save drafts to localStorage ---

const DRAFTS_KEY = 'cascade-drafts';

function getDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
  } catch { return {}; }
}

function saveDrafts() {
  const { tabs, panes } = useEditorStore.getState();
  const drafts = getDrafts();
  let changed = false;

  // Collect all tabs from both single-pane and split-pane modes
  const allTabs = panes.length > 0
    ? panes.flatMap((p) => p.tabs)
    : tabs;

  // Save dirty tabs (skip non-markdown tabs)
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

/** Check if a draft exists for a file path and return it, clearing from storage. */
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

/** Clear a single draft (called after successful save). */
export function clearDraft(path: string) {
  const drafts = getDrafts();
  if (drafts[path] !== undefined) {
    delete drafts[path];
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* quota */ }
  }
}

// Auto-save drafts every 5 seconds
setInterval(saveDrafts, 5000);

// Save drafts and session on page unload
window.addEventListener('beforeunload', () => {
  saveDrafts();
  const vaultRoot = useVaultStore.getState().vaultPath;
  if (vaultRoot) saveSession(vaultRoot);
});

// --- Session persistence ---

const SESSION_KEY_PREFIX = 'cascade-session:';

interface SessionData {
  tabs: { path: string; cursorPos?: number; scrollTop?: number }[];
  activeTabIndex: number;
}

export function saveSession(vaultRoot: string) {
  const { tabs, activeTabIndex } = useEditorStore.getState();
  const session: SessionData = {
    tabs: tabs
      .filter((t) => !t.path.startsWith('__'))
      .map((t) => ({ path: t.path, cursorPos: t.cursorPos, scrollTop: t.scrollTop })),
    activeTabIndex,
  };
  try {
    localStorage.setItem(SESSION_KEY_PREFIX + vaultRoot, JSON.stringify(session));
  } catch { /* quota */ }
}

export async function restoreSession(vaultRoot: string) {
  const raw = localStorage.getItem(SESSION_KEY_PREFIX + vaultRoot);
  if (!raw) return;
  try {
    const session: SessionData = JSON.parse(raw);
    if (!Array.isArray(session.tabs) || session.tabs.length === 0) return;

    const store = useEditorStore.getState();
    // Open all tabs in parallel, then switch to the active one
    await Promise.all(
      session.tabs.map((tabData) => store.openFile(vaultRoot, tabData.path, true, true)),
    );
    // Set active tab
    const idx = Math.min(session.activeTabIndex, session.tabs.length - 1);
    if (idx >= 0) {
      store.switchTab(idx);
    }
  } catch { /* ignore corrupt session data */ }
}
