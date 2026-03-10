import { create } from 'zustand';
import { gitSync, gitStatus, readSyncPat } from '../lib/tauri-commands';
import { useSettingsStore } from './settings-store';
import { useVaultStore } from './vault-store';
import { useToastStore } from './toast-store';

interface SyncState {
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline' | 'disconnected';
  lastSyncTime: number | null;
  lastError: string | null;
  unpushedCommits: number;
  conflictFiles: string[];

  triggerSync: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  syncStatus: 'disconnected',
  lastSyncTime: null,
  lastError: null,
  unpushedCommits: 0,
  conflictFiles: [],

  triggerSync: async () => {
    const { syncStatus } = get();
    if (syncStatus === 'syncing') return;

    const settings = useSettingsStore.getState();
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!settings.syncEnabled || !vaultPath) return;

    set({ syncStatus: 'syncing', lastError: null });

    try {
      const pat = await readSyncPat(vaultPath);
      if (!pat) {
        set({ syncStatus: 'error', lastError: 'No PAT configured — add your token in Sync settings' });
        return;
      }
      const result = await gitSync(vaultPath, pat);

      if (result.conflicts.length > 0) {
        useToastStore.getState().addToast(
          `Sync conflict: ${result.conflicts.length} file${result.conflicts.length > 1 ? 's' : ''} — check .conflict.md files`,
          'warning',
        );
      }

      set({
        syncStatus: result.push_status === 'offline' ? 'offline' : 'idle',
        lastSyncTime: Date.now(),
        conflictFiles: result.conflicts,
        unpushedCommits: result.push_status === 'offline' ? get().unpushedCommits + (result.committed_files.length > 0 ? 1 : 0) : 0,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('auth') || lowerMsg.includes('401') || lowerMsg.includes('403')) {
        useToastStore.getState().addToast('Sync failed: authentication error — check your PAT in settings', 'error');
      } else if (lowerMsg.includes('not found') || lowerMsg.includes('404')) {
        useToastStore.getState().addToast('Sync failed: repository not found — check the URL in settings', 'error');
      } else {
        useToastStore.getState().addToast(`Sync failed: ${msg}`, 'error');
      }
      set({ syncStatus: 'error', lastError: msg });
    }
  },

  refreshStatus: async () => {
    const settings = useSettingsStore.getState();
    const vaultPath = useVaultStore.getState().vaultPath;
    if (!vaultPath || !settings.syncEnabled) {
      set({ syncStatus: 'disconnected' });
      return;
    }
    // Don't overwrite status while a sync is in progress
    const { syncStatus: current } = get();
    if (current === 'syncing') return;
    try {
      const status = await gitStatus(vaultPath);
      if (!status.is_repo || !status.has_remote) {
        set({ syncStatus: 'disconnected' });
      } else {
        set({ unpushedCommits: status.unpushed_commits });
      }
    } catch {
      // Non-critical
    }
  },

  reset: () => set({
    syncStatus: 'disconnected',
    lastSyncTime: null,
    lastError: null,
    unpushedCommits: 0,
    conflictFiles: [],
  }),
}));
