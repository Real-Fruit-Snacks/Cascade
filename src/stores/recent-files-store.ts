import { create } from 'zustand';

interface RecentFilesState {
  recentFiles: string[];
}

interface RecentFilesActions {
  loadRecentFiles: (vaultRoot: string) => void;
  addRecentFile: (filePath: string, vaultRoot: string) => void;
}

export const useRecentFilesStore = create<RecentFilesState & RecentFilesActions>((set) => ({
  recentFiles: [],

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

  addRecentFile: (filePath: string, vaultRoot: string) => {
    if (filePath.startsWith('__')) return;
    const key = `cascade-recent-files:${vaultRoot}`;
    set((s) => {
      const filtered = s.recentFiles.filter((p) => p !== filePath);
      const updated = [filePath, ...filtered].slice(0, 20);
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* ignore quota errors */ }
      return { recentFiles: updated };
    });
  },
}));
